# @onettl/web

The OneTTL **web reference client** — the exact ES modules onettl.com serves at `/static/*.js`. This package is not published to npm; it exists so the browser-side trust surface is public and verifiable.

| File | Served at | Role |
|---|---|---|
| `src/create.js` | `/static/create.js` | Create-page controller. Encrypts the secret; the key never leaves the page except as the URL `#k=` fragment. |
| `src/view.js` | `/static/view.js` | Viewer-page controller. Decrypts only when the recipient explicitly reveals — loading the page must never consume the secret. |
| `src/dom.js` | `/static/dom.js` | Tiny DOM/clipboard helper. Deliberately kept out of the crypto module so the served crypto stays pure. |
| `src/crypto.js` | `/static/crypto.js` | Symlink to [`@onettl/crypto`](../crypto) — the one crypto implementation. Not a copy. |

These modules import each other by relative same-origin path (`./crypto.js`, `./dom.js`), exactly as the browser loads them. To confirm production serves these bytes, see [VERIFY.md](../../VERIFY.md).

## License

MIT.
