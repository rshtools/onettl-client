// Bundles the CLI into a single self-contained onettl.cjs. bin/onettl.js imports
// the shared crypto core (via src/crypto.mjs → @onettl/crypto), so esbuild inlines
// that ONE implementation — no separate hand-maintained copy. Run: npm run build
// (from packages/cli) or `node build.mjs`.
import { build } from "esbuild";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
const ENTRY = join(root, "bin", "onettl.js");
const BUNDLE = join(root, "onettl.cjs");

// Node 18 does not always expose a global WebCrypto; the crypto core uses the
// global `crypto`, so shim it from node:crypto before any module code runs.
const banner =
  "// GENERATED bundle — do not edit. Change bin/src or @onettl/crypto,\n" +
  "// then run: node build.mjs\n" +
  "globalThis.crypto ??= require('node:crypto').webcrypto;";

await build({
  entryPoints: [ENTRY],
  outfile: BUNDLE,
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node18",
  banner: { js: banner },
});

// esbuild keeps the entry's shebang and the banner has none; strip any shebang
// lines and prepend exactly one so it stays a valid, executable line 1.
const SHEBANG = "#!/usr/bin/env node";
let code = await readFile(BUNDLE, "utf8");
code = SHEBANG + "\n" + code.split("\n").filter((l) => l !== SHEBANG).join("\n");
await writeFile(BUNDLE, code);
console.error(`built ${BUNDLE}`);
