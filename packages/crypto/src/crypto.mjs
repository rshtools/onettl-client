// OneTTL crypto core — the single, isomorphic source of truth for the
// zero-knowledge scheme. Runs unchanged in the browser and in Node 18+ (both
// expose Web Crypto as the global `crypto`). This is the future public
// `@onettl/crypto` package: the web client, the CLI, and any other client
// depend on it; the server never does (it only stores ciphertext + returns it).
//
// WIRE FORMAT v1 (ratified — do not change these constants without minting a new
// `encryption_mode` string; already-issued one-time links must keep decrypting):
//   • data key:     AES-GCM-256, random, lives ONLY in the URL `#k=` fragment
//   • blob layout:  IV(12) || AES-GCM ciphertext(+128-bit tag)   [prepended IV]
//   • passphrase:   OUTER layer — AES-GCM(pbkdf2Key, dataKeyBlob), same layout
//   • KDF:          PBKDF2, 600k iters, SHA-256, 16-byte random salt
//   • b64url:       RFC 4648 §5, unpadded
//   • mode string:  "aesgcm" (no passphrase) | "aesgcm_pbkdf2" (passphrase)

export const FORMAT_VERSION = 1;
export const PBKDF2_ITERS = 600_000;
export const IV_BYTES = 12;
export const SALT_BYTES = 16;
export const MODE_PLAIN = "aesgcm";
export const MODE_PBKDF2 = "aesgcm_pbkdf2";

const te = new TextEncoder();
const td = new TextDecoder();

// ---- base64url (pure; identical bytes in browser + Node, no btoa/Buffer) ----

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const B64INV = (() => {
  const t = new Int16Array(128).fill(-1);
  for (let i = 0; i < B64.length; i++) t[B64.charCodeAt(i)] = i;
  return t;
})();

export function bytesToB64url(bytes) {
  let out = "";
  const len = bytes.length;
  let i = 0;
  for (; i + 3 <= len; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
  }
  const rem = len - i;
  if (rem === 1) {
    const n = bytes[i] << 16;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
  } else if (rem === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63];
  }
  return out;
}

export function b64urlToBytes(s) {
  s = s.replace(/=+$/, "");
  const len = s.length;
  const out = new Uint8Array((len * 3) >> 2);
  let o = 0;
  let i = 0;
  for (; i + 4 <= len; i += 4) {
    const n =
      (B64INV[s.charCodeAt(i)] << 18) |
      (B64INV[s.charCodeAt(i + 1)] << 12) |
      (B64INV[s.charCodeAt(i + 2)] << 6) |
      B64INV[s.charCodeAt(i + 3)];
    out[o++] = (n >> 16) & 255;
    out[o++] = (n >> 8) & 255;
    out[o++] = n & 255;
  }
  const rem = len - i;
  if (rem === 2) {
    const n = (B64INV[s.charCodeAt(i)] << 18) | (B64INV[s.charCodeAt(i + 1)] << 12);
    out[o++] = (n >> 16) & 255;
  } else if (rem === 3) {
    const n =
      (B64INV[s.charCodeAt(i)] << 18) |
      (B64INV[s.charCodeAt(i + 1)] << 12) |
      (B64INV[s.charCodeAt(i + 2)] << 6);
    out[o++] = (n >> 16) & 255;
    out[o++] = (n >> 8) & 255;
  }
  return out;
}

// ---- primitives ------------------------------------------------------------

function concat(a, b) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

async function aesEncrypt(key, data) {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data));
  return concat(iv, ct);
}

async function aesDecrypt(key, blob) {
  const iv = blob.slice(0, IV_BYTES);
  const ct = blob.slice(IV_BYTES);
  return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct));
}

async function derivePassphraseKey(pass, salt, usages) {
  const base = await crypto.subtle.importKey("raw", te.encode(pass), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERS, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    usages,
  );
}

// ---- composition (the public API both web + CLI call) ----------------------

// Encrypt plaintext under a fresh random data key. Returns everything the caller
// needs: the ciphertext + mode (+salt) to upload, and the keyFragment for `#k=`.
// The data key never leaves the caller except as the fragment it prints locally.
export async function encryptSecret(plaintext, passphrase) {
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const rawKey = new Uint8Array(await crypto.subtle.exportKey("raw", key));
  let blob = await aesEncrypt(key, te.encode(plaintext));
  const out = { ciphertext: null, encryption_mode: MODE_PLAIN, keyFragment: bytesToB64url(rawKey) };
  if (passphrase) {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
    const pk = await derivePassphraseKey(passphrase, salt, ["encrypt"]);
    blob = await aesEncrypt(pk, blob); // OUTER passphrase layer wraps the data-key blob
    out.encryption_mode = MODE_PBKDF2;
    out.salt = bytesToB64url(salt);
  }
  out.ciphertext = bytesToB64url(blob);
  return out;
}

// Inverse of encryptSecret. `openResponse` is { ciphertext, encryption_mode, salt? }
// as returned by POST /open; `keyFragment` is the b64url from the URL `#k=`.
export async function decryptSecret(openResponse, keyFragment, passphrase) {
  let blob = b64urlToBytes(openResponse.ciphertext);
  if ((openResponse.encryption_mode || MODE_PLAIN) === MODE_PBKDF2) {
    const pk = await derivePassphraseKey(passphrase, b64urlToBytes(openResponse.salt), ["decrypt"]);
    blob = await aesDecrypt(pk, blob); // strip outer passphrase layer → data-key blob
  }
  const key = await crypto.subtle.importKey("raw", b64urlToBytes(keyFragment), { name: "AES-GCM" }, false, ["decrypt"]);
  return td.decode(await aesDecrypt(key, blob));
}
