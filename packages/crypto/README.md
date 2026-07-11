# @onettl/crypto

The zero-knowledge crypto core behind [OneTTL](https://onettl.com). One isomorphic ES module — the **same bytes** run in the browser and in Node 18+, both over the global Web Crypto API. This is the single source of truth for the scheme: the web client imports it, the CLI inlines it, and onettl.com serves it verbatim.

- **Cipher:** AES-GCM-256, random per-secret data key.
- **Passphrase (optional):** outer AES-GCM layer keyed by PBKDF2 — 600,000 iterations, SHA-256, 16-byte random salt.
- **Blob layout:** `IV(12) || ciphertext(+128-bit tag)`; unpadded base64url.
- **Wire format v1 — frozen.** The constants are ratified; changing them mints a new mode string so old links keep decrypting.

The key lives only in the caller's hands (in OneTTL, in the URL `#k=` fragment). It is never part of what you'd upload to a server.

## Install

```sh
npm install @onettl/crypto
```

## Use

```js
import { encryptSecret, decryptSecret } from "@onettl/crypto";

// Encrypt. Returns what you'd store server-side plus the key to keep client-side.
const { ciphertext, encryption_mode, salt, keyFragment } =
  await encryptSecret("hunter2", /* passphrase? */ undefined);

// Store { ciphertext, encryption_mode, salt } on the server; put keyFragment in the URL #fragment.

// Decrypt. openResponse is what the server hands back: { ciphertext, encryption_mode, salt? }.
const plaintext = await decryptSecret(
  { ciphertext, encryption_mode, salt },
  keyFragment,
  /* passphrase? */ undefined,
);
```

Pass a `passphrase` to both calls to enable the outer PBKDF2 layer. The passphrase and everything derived from it stay on the caller's machine.

## API

| Export | Description |
|---|---|
| `encryptSecret(plaintext, passphrase?)` | → `{ ciphertext, encryption_mode, salt?, keyFragment }` (base64url strings). |
| `decryptSecret(openResponse, keyFragment, passphrase?)` | → plaintext string. Inverse of `encryptSecret`. |
| `bytesToB64url(u8)` / `b64urlToBytes(s)` | Pure-`Uint8Array` unpadded base64url, identical in browser and Node. |
| `PBKDF2_ITERS`, `FORMAT_VERSION`, `MODE_PLAIN`, `MODE_PBKDF2`, … | Ratified v1 constants. |

## Verify against production

The bytes onettl.com serves at `/static/crypto.js` are identical to `src/crypto.mjs` in this package — see [VERIFY.md](../../VERIFY.md). Threat model: [THREATMODEL.md](../../THREATMODEL.md).

## License

MIT.
