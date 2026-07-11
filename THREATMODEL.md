# OneTTL threat model

This document states precisely what OneTTL protects, what it does not, and where the trust boundary sits. It is the companion to the client source in this repository — the code here is meant to be read against these claims.

## The scheme (wire format v1)

A secret is encrypted before it leaves your machine:

- **Data key:** AES-GCM-256, randomly generated per secret. It lives **only** in the URL fragment (`#k=…`), which browsers never send to the server.
- **Blob layout:** `IV(12) || AES-GCM ciphertext(+128-bit tag)`.
- **Optional passphrase:** an outer AES-GCM layer keyed by PBKDF2 (600,000 iterations, SHA-256, 16-byte random salt) over the passphrase. The server never sees the passphrase or anything derived from it.
- **Encoding:** unpadded base64url (RFC 4648 §5).
- **Mode string:** `aesgcm` (no passphrase) or `aesgcm_pbkdf2` (passphrase).

The canonical, executable definition is [`packages/crypto/src/crypto.mjs`](packages/crypto/src/crypto.mjs). The constants are frozen: changing them requires minting a new `encryption_mode` string so already-issued links keep decrypting.

## Trust boundary

```
   YOUR MACHINE (this repo)          │        ONETTL SERVER (not in this repo)
                                     │
  plaintext ──▶ encryptSecret ──▶ ciphertext ──────▶ stored as opaque bytes
       ▲                              │                      │
       │                          key stays                  │  one read, then deleted
   decryptSecret ◀── ciphertext ◀─── here (URL #fragment) ◀──┘
                                     │
   key is NEVER sent across ─────────┘
```

Everything left of the line is in this repository. The server receives ciphertext and metadata (TTL, mode string, timestamps) and returns the ciphertext at most once. It has no key, no passphrase, and no plaintext.

## What OneTTL protects against

- **A curious or compromised server.** The operator cannot read stored secrets — they hold ciphertext and no key.
- **A stored-data breach.** A dump of the database yields ciphertext without keys.
- **Link re-use.** A one-time link is consumed on first read (server-enforced) and the record is deleted; TTL expiry deletes it regardless.
- **In-transit interception of the ciphertext.** Interception of the stored blob alone is useless without the fragment key.

## What OneTTL does NOT protect against

- **Anyone who has the full link.** The key is *in* the link. Whoever receives the complete URL can decrypt it once. Transmit links over a channel you trust, and prefer adding a passphrase for high-value secrets.
- **A malicious server swapping the client.** A dishonest server could serve different JavaScript than what's published here. This is the residual risk that [VERIFY.md](VERIFY.md) exists to close: inspect the served bytes, or use the pinned CLI, which the server cannot alter.
- **A compromised endpoint.** Malware, a keylogger, or a hostile browser extension on the sender's or recipient's device sees plaintext before/after crypto. No web service can prevent this.
- **Traffic analysis / metadata.** The server necessarily learns timing, IP (hashed), sizes, and TTLs. This is not hidden.
- **Brute-force of a weak passphrase.** PBKDF2-600k raises the cost, but a guessable passphrase on an exfiltrated blob is still guessable. Use a strong one.

## The residual risk, stated plainly

For the **web** client, you are trusting that onettl.com serves the code in this repo at the moment you use it. That trust is *checkable but not automatic* — see [VERIFY.md](VERIFY.md). For the **CLI**, you install a pinned, published artifact from npm; the server has no opportunity to substitute it. If your threat model doesn't tolerate the web-delivery gap, use the CLI.

## Reporting

Found a flaw in the scheme or the code? See [SECURITY.md](SECURITY.md).
