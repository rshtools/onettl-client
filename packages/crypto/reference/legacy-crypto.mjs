// Client-side crypto for the OneTTL CLI. Mirrors the browser flow exactly
// (AES-GCM-256 data key in the URL fragment; optional PBKDF2-600k passphrase
// layer). Plaintext and keys NEVER leave this process except as ciphertext +
// the fragment key that the CLI prints locally. Uses Node's global WebCrypto.

export const PBKDF2_ITERS = 600_000;
const te = new TextEncoder();

export function bytesToB64url(bytes) {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return Buffer.from(bin, "binary").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64urlToBytes(s) {
  return new Uint8Array(Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64"));
}

function concat(a, b) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

async function aesEncrypt(key, data) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data));
  return concat(iv, ct);
}

async function aesDecrypt(key, blob) {
  const iv = blob.slice(0, 12);
  const ct = blob.slice(12);
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

// Returns { ciphertext, encryption_mode, salt?, keyFragment }.
export async function encryptSecret(plaintext, passphrase) {
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const rawKey = new Uint8Array(await crypto.subtle.exportKey("raw", key));
  let blob = await aesEncrypt(key, te.encode(plaintext));
  const out = { ciphertext: null, encryption_mode: "aesgcm", keyFragment: bytesToB64url(rawKey) };
  if (passphrase) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const pk = await derivePassphraseKey(passphrase, salt, ["encrypt"]);
    blob = await aesEncrypt(pk, blob);
    out.encryption_mode = "aesgcm_pbkdf2";
    out.salt = bytesToB64url(salt);
  }
  out.ciphertext = bytesToB64url(blob);
  return out;
}

// Inverse of encryptSecret — used by tests and a future `onettl open`.
export async function decryptSecret(openResponse, keyFragment, passphrase) {
  let blob = b64urlToBytes(openResponse.ciphertext);
  if ((openResponse.encryption_mode || "aesgcm") === "aesgcm_pbkdf2") {
    const pk = await derivePassphraseKey(passphrase, b64urlToBytes(openResponse.salt), ["decrypt"]);
    blob = await aesDecrypt(pk, blob);
  }
  const key = await crypto.subtle.importKey("raw", b64urlToBytes(keyFragment), { name: "AES-GCM" }, false, ["decrypt"]);
  return new TextDecoder().decode(await aesDecrypt(key, blob));
}

// Parse a human TTL (60s, 10m, 1h, 24h, 7d, 30d) into seconds.
export function parseTtl(input) {
  if (input == null) return 86_400;
  const m = String(input).trim().match(/^(\d+)\s*([smhd])?$/i);
  if (!m) throw new Error(`invalid --ttl: ${input} (use forms like 60s, 10m, 1h, 24h, 7d, 30d)`);
  const n = parseInt(m[1], 10);
  const unit = (m[2] || "s").toLowerCase();
  const mult = unit === "s" ? 1 : unit === "m" ? 60 : unit === "h" ? 3600 : 86_400;
  return n * mult;
}
