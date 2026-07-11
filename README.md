# OneTTL client

The **client trust surface** for [OneTTL](https://onettl.com) — one-time secret links that are encrypted and decrypted entirely on your machine. This repository contains *everything that runs on your side of the wire*, and nothing that runs on the server.

OneTTL is zero-knowledge: a secret is encrypted in your browser (or your terminal) with a key that lives only in the URL fragment (`#k=…`). The fragment is never sent to the server. The server stores ciphertext it cannot read, hands it back once, and deletes it. **This repo is how you check that claim for yourself** — the code here is the exact code onettl.com serves.

## What's here

| Package | Published as | What it is |
|---|---|---|
| [`packages/crypto`](packages/crypto) | `@onettl/crypto` (npm) | The single, isomorphic crypto core — AES-GCM-256 / PBKDF2-600k. One module, byte-for-byte identical in the browser and in Node 18+. The audited unit. |
| [`packages/web`](packages/web) | *(reference, not published)* | The `create.js` / `view.js` / `dom.js` ES modules onettl.com serves at `/static/*.js`. The pages that touch your plaintext and your key. |
| [`packages/cli`](packages/cli) | `onettl` (npm) | The terminal client. `npm i -g onettl`. Same crypto core, inlined at build time — no second copy to drift. |

The server (Cloudflare Worker, Durable Objects, storage, billing) is **not** here and is not open source. It never needs to be trusted with plaintext, so it is not part of the trust surface. See [THREATMODEL.md](THREATMODEL.md) for exactly where the trust boundary sits.

## One implementation, no drift

The zero-knowledge scheme is defined **once**, in `packages/crypto/src/crypto.mjs`. The web client imports it; the CLI inlines it at build; the server serves those exact bytes. There is no hand-synced second copy to fall out of step. The wire format is versioned (v1) and frozen — see the header of the crypto core.

## Verify what onettl.com actually serves

Open-sourcing the client proves nothing unless you can confirm the live site serves *this* code. It does, and you can check:

- The site serves the crypto module as a plain, same-origin file at `/static/crypto.js` — inspectable in your browser's devtools.
- Those served bytes are **byte-identical** to `packages/crypto/src/crypto.mjs` in this repo.
- The most paranoid path skips the browser entirely: install the pinned CLI from npm.

Full instructions, including how to diff the served asset against this source: **[VERIFY.md](VERIFY.md)**.

## Develop

```sh
npm install          # links the workspace packages
npm test             # crypto round-trip + CLI tests
npm run build:cli    # rebuild the CLI bundle (inlines @onettl/crypto)
```

## License

MIT — see [LICENSE](LICENSE).

Security contact and disclosure policy: [SECURITY.md](SECURITY.md).
