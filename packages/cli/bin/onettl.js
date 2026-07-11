#!/usr/bin/env node
// OneTTL CLI (D16). `onettl send|status|revoke|list|login`. Encryption happens
// client-side here — plaintext never leaves this process except as ciphertext.

import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { loadConfig, saveConfig } from "../src/config.mjs";
import { encryptSecret, parseTtl } from "../src/crypto.mjs";
import { createClient, buildCreateBody, ApiError } from "../src/api.mjs";

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) flags[key] = true;
      else {
        flags[key] = next;
        i++;
      }
    } else positional.push(a);
  }
  return { positional, flags };
}

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  return new Promise((resolve) => rl.question(question, (a) => {
    rl.close();
    resolve(a.trim());
  }));
}

function die(msg, code = 1) {
  console.error(`onettl: ${msg}`);
  process.exit(code);
}

const HELP = `onettl — one-time secret links for developers

Usage:
  onettl login [TOKEN]              save a Personal Access Token
  onettl send [TEXT]               create a secret (reads stdin if no TEXT)
    --ttl 10m|1h|24h|7d|30d|60s    time to live (default 24h)
    --opens N                      max opens (default 1)
    --json                         mark payload as JSON
    --label "..."                  dashboard label
    --passphrase "..."             add a passphrase layer (share separately)
  onettl status <id>               show a secret's metadata
  onettl revoke <id>               revoke a pending secret
  onettl list [--status active|consumed|expired|revoked]

Config: ~/.config/onettl/config.json  (env: ONETTL_API, ONETTL_TOKEN)

Examples:
  cat .env.staging | onettl send --ttl 10m --opens 1
  kubectl get secret api-key -o json | onettl send --json --ttl 60s`;

async function main() {
  const [, , cmd, ...rest] = process.argv;
  const { positional, flags } = parseArgs(rest);
  const cfg = loadConfig();

  if (!cmd || cmd === "help" || flags.help) {
    console.log(HELP);
    return;
  }

  if (cmd === "login") {
    let token = positional[0];
    if (!token) {
      console.error(`Create a token at ${cfg.api}/app/tokens then paste it here.`);
      token = await prompt("PAT (ottl_...): ");
    }
    if (!token || !token.startsWith("ottl_")) die("that doesn't look like a OneTTL PAT (expected ottl_...)");
    const path = saveConfig({ token, api: cfg.api });
    console.error(`Saved token to ${path}`);
    return;
  }

  const client = createClient({ api: cfg.api, token: cfg.token });

  try {
    if (cmd === "send") {
      let text = positional.join(" ");
      if (!text) text = readStdin();
      text = text.replace(/\n$/, "");
      if (!text) die("nothing to send (pass TEXT or pipe via stdin)");
      const ttl = parseTtl(flags.ttl);
      const opens = flags.opens ? parseInt(flags.opens, 10) : 1;
      const secretType = flags.json ? "json" : "text";
      const passphrase = typeof flags.passphrase === "string" ? flags.passphrase : undefined;
      if (secretType === "json") {
        try {
          JSON.parse(text);
        } catch {
          die("--json given but the payload is not valid JSON");
        }
      }
      const enc = await encryptSecret(text, passphrase);
      const label = typeof flags.label === "string" ? flags.label : undefined;
      const res = await client.createSecret(buildCreateBody({ enc, ttl, opens, secretType, label }));
      const url = `${res.url || `${client.base}/s/${res.id}`}#k=${enc.keyFragment}`;
      console.log(url);
      if (passphrase) console.error("Note: recipient also needs the passphrase (share it separately).");
      return;
    }

    if (cmd === "status") {
      const id = positional[0] || die("usage: onettl status <id>");
      const s = await client.status(id);
      console.log(JSON.stringify(s, null, 2));
      return;
    }

    if (cmd === "revoke") {
      const id = positional[0] || die("usage: onettl revoke <id>");
      await client.revoke(id);
      console.error(`revoked ${id}`);
      return;
    }

    if (cmd === "list") {
      const status = typeof flags.status === "string" ? flags.status : undefined;
      const res = await client.list(status);
      for (const s of res.secrets) {
        console.log(`${s.id}\t${s.status}\t${s.open_count}/${s.max_opens}\t${s.secret_type}\t${s.label || ""}`);
      }
      return;
    }

    die(`unknown command '${cmd}' (try: onettl help)`);
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401) die("unauthorized — run `onettl login` with a valid token");
      die(`${err.code || "error"}: ${err.message}`);
    }
    die(err.message || String(err));
  }
}

main();
