# Security policy

OneTTL's whole value is that the code in this repository does what it says. Reports that show it doesn't are the most valuable thing you can send us.

## Reporting a vulnerability

Email **security@onettl.com** with:

- what you found and where (file, function, or the served asset),
- how to reproduce it, and
- the impact you believe it has.

Please report privately first and give us a reasonable window to fix before public disclosure. We'll acknowledge, keep you updated, and credit you if you'd like.

## In scope

- The crypto core (`packages/crypto`) — the scheme, the implementation, the encoding.
- The web reference client (`packages/web`) — anything that could leak the key or plaintext to the server.
- The CLI (`packages/cli`) — anything that weakens the client-side guarantee.
- **A mismatch between what onettl.com serves and what's published here** (see [VERIFY.md](VERIFY.md)). This is explicitly in scope and important.

## Out of scope

- The closed server / Worker internals (report server-side issues to the same address, but they're not part of this public trust surface).
- Risks the [threat model](THREATMODEL.md) already documents as accepted: possession of a full link, endpoint compromise, weak user-chosen passphrases, delivery-time trust in the browser (use the CLI to remove it).

## Supported

The `main` branch and the latest published `@onettl/crypto` and `onettl` releases.
