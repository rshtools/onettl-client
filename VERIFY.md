# Verifying that onettl.com serves this code

OneTTL's zero-knowledge claim only holds if the client running in your browser is the client published here. This page shows how to check that — from a five-second glance to a byte-for-byte diff — and explains the one gap you can't close in a browser (and how the CLI closes it).

## Level 0 — the crypto is a plain file you can read

onettl.com serves the crypto core as an ordinary same-origin module:

```
https://onettl.com/static/crypto.js
```

No bundling, no minification, no obfuscation. Open it in a browser tab or devtools **Sources** panel and read it. It is the same code as [`packages/crypto/src/crypto.mjs`](packages/crypto/src/crypto.mjs) in this repo.

## Level 1 — diff the served bytes against this source

The served `/static/crypto.js` is **byte-identical** to the crypto core in this repository. Check it yourself:

```sh
# Fetch what the live site serves and hash it
curl -s https://onettl.com/static/crypto.js | shasum -a 256

# Hash the source in this repo
shasum -a 256 packages/crypto/src/crypto.mjs
```

The two hashes match. If they ever don't, that is exactly the signal to stop and ask why — please [report it](SECURITY.md).

The DOM helper is served verbatim too:

```sh
curl -s https://onettl.com/static/dom.js | shasum -a 256      # == packages/web/src/dom.js
```

> **Cloudflare edge-caches `/static/*.js` aggressively** (`cache-control: immutable`). If a
> direct hash doesn't match, append a throwaway query to bypass the cache and re-check:
> `curl -s "https://onettl.com/static/crypto.js?cb=$RANDOM" | shasum -a 256`.

### create.js and view.js — one deterministic transform

The create and view controllers ([`packages/web/src`](packages/web/src)) are served with a **single, deterministic rewrite**: each relative `import` gets a cache-busting version query appended, e.g.

```js
// in the repo:                     // as served:
import { encryptSecret }            import { encryptSecret }
  from './crypto.js';                 from './crypto.js?v=18hu8te';
```

That `?v=…` is a content hash of all assets — it exists so a cached module can never pair with mismatched HTML after a deploy. It changes nothing about what the code *does*. To confirm the served controller is this repo's source, diff it and check that the **only** differences are `?v=<hash>` suffixes on import lines:

```sh
diff <(curl -s "https://onettl.com/static/create.js?cb=$RANDOM") packages/web/src/create.js
diff <(curl -s "https://onettl.com/static/view.js?cb=$RANDOM")   packages/web/src/view.js
```

For an exact hash match with nothing to reason about, use `crypto.js` and `dom.js` above — or the CLI below, which has no version-rewrite step at all.

## Level 2 — the gap a browser can't close, and the fix

Even with matching hashes, a dishonest server *could* serve different bytes to a different visitor, or swap them after you checked. In a browser, delivery is inherently trust-on-use.

If that residual risk matters to you, **skip the browser**:

```sh
npm install -g onettl        # a pinned, published artifact
onettl --help
```

The CLI is built from this repository with the crypto core inlined ([`packages/cli`](packages/cli)). You install a specific version from npm; the OneTTL server has no opportunity to substitute the code that runs. This is the strongest verifiability OneTTL offers, and it's the recommended path for high-value secrets.

## What we deliberately do *not* claim

- We do not claim fully reproducible builds of the deployed Worker. The Worker is closed and is not the trust surface (see [THREATMODEL.md](THREATMODEL.md)); the client is.
- We do not claim the browser path removes trust-on-use. It reduces it to something inspectable; the CLI removes it.

Being precise about this is the point. If a page ever promises more than it can prove, treat that as the bug.
