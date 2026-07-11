# onettl

One-time secret links from your terminal. Share a password, API key, or `.env`
as a link that self-destructs after it's opened.

**Zero-knowledge:** the secret is encrypted on your machine with AES-GCM-256.
The key only ever appears inside the link's `#` fragment — onettl.com never
receives the key or the plaintext. Links open at `https://onettl.com/s/<id>`.
Zero dependencies. Requires Node 18+.

## Install

```sh
npx onettl send ./.env
```

Or install it:

```sh
npm install -g onettl
# or, no npm needed:
curl -fsSL https://onettl.com/cli -o onettl && chmod +x onettl
```

## Usage

```sh
onettl send [file] [--ttl 24h] [--opens 1] [--json] [--label name]
onettl list
onettl revoke <id>
```

The secret is read from `[file]` or stdin. `send` prints a single line — the
one-time link — so it pipes cleanly.

```sh
onettl send ./.env
printf %s "hunter2" | onettl send --ttl 1h
cat creds.json | onettl send --json --label staging
```

`--ttl` accepts `30m`, `2h`, `7d`, or seconds. `--opens` allows more than one
open on paid plans (free is capped at one).

## Auth

Set `ONETTL_TOKEN` to attach secrets to your account (create a token at
<https://onettl.com/app/tokens>). Without a token, secrets are created
anonymously and won't appear in your dashboard. `list` and `revoke` need a token.

```sh
export ONETTL_TOKEN=ottl_...
onettl list
onettl revoke <id>
```

| Env | |
| --- | --- |
| `ONETTL_TOKEN` | personal access token |
| `ONETTL_API` | API base (default `https://onettl.com`) |

## License

MIT
