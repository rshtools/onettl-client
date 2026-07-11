#!/usr/bin/env node
// GENERATED bundle — do not edit. Change bin/src or @onettl/crypto,
// then run: node build.mjs
globalThis.crypto ??= require('node:crypto').webcrypto;

// packages/cli/bin/onettl.js
var import_node_fs2 = require("node:fs");
var import_node_readline = require("node:readline");

// packages/cli/src/config.mjs
var import_node_os = require("node:os");
var import_node_path = require("node:path");
var import_node_fs = require("node:fs");
var DIR = (0, import_node_path.join)((0, import_node_os.homedir)(), ".config", "onettl");
var FILE = (0, import_node_path.join)(DIR, "config.json");
function loadConfig() {
  let file = {};
  try {
    file = JSON.parse((0, import_node_fs.readFileSync)(FILE, "utf8"));
  } catch {
  }
  return {
    api: process.env.ONETTL_API || file.api || "https://onettl.com",
    token: process.env.ONETTL_TOKEN || file.token || null,
    path: FILE
  };
}
function saveConfig(patch) {
  let file = {};
  try {
    file = JSON.parse((0, import_node_fs.readFileSync)(FILE, "utf8"));
  } catch {
  }
  const merged = { ...file, ...patch };
  (0, import_node_fs.mkdirSync)(DIR, { recursive: true });
  (0, import_node_fs.writeFileSync)(FILE, JSON.stringify(merged, null, 2), { mode: 384 });
  return FILE;
}

// packages/crypto/src/crypto.mjs
var PBKDF2_ITERS = 6e5;
var IV_BYTES = 12;
var SALT_BYTES = 16;
var MODE_PLAIN = "aesgcm";
var MODE_PBKDF2 = "aesgcm_pbkdf2";
var te = new TextEncoder();
var td = new TextDecoder();
var B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
var B64INV = (() => {
  const t = new Int16Array(128).fill(-1);
  for (let i = 0; i < B64.length; i++) t[B64.charCodeAt(i)] = i;
  return t;
})();
function bytesToB64url(bytes) {
  let out = "";
  const len = bytes.length;
  let i = 0;
  for (; i + 3 <= len; i += 3) {
    const n = bytes[i] << 16 | bytes[i + 1] << 8 | bytes[i + 2];
    out += B64[n >> 18 & 63] + B64[n >> 12 & 63] + B64[n >> 6 & 63] + B64[n & 63];
  }
  const rem = len - i;
  if (rem === 1) {
    const n = bytes[i] << 16;
    out += B64[n >> 18 & 63] + B64[n >> 12 & 63];
  } else if (rem === 2) {
    const n = bytes[i] << 16 | bytes[i + 1] << 8;
    out += B64[n >> 18 & 63] + B64[n >> 12 & 63] + B64[n >> 6 & 63];
  }
  return out;
}
function concat(a, b) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}
async function aesEncrypt(key, data) {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data));
  return concat(iv, ct);
}
async function derivePassphraseKey(pass, salt, usages) {
  const base = await crypto.subtle.importKey("raw", te.encode(pass), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERS, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    usages
  );
}
async function encryptSecret(plaintext, passphrase) {
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const rawKey = new Uint8Array(await crypto.subtle.exportKey("raw", key));
  let blob = await aesEncrypt(key, te.encode(plaintext));
  const out = { ciphertext: null, encryption_mode: MODE_PLAIN, keyFragment: bytesToB64url(rawKey) };
  if (passphrase) {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
    const pk = await derivePassphraseKey(passphrase, salt, ["encrypt"]);
    blob = await aesEncrypt(pk, blob);
    out.encryption_mode = MODE_PBKDF2;
    out.salt = bytesToB64url(salt);
  }
  out.ciphertext = bytesToB64url(blob);
  return out;
}

// packages/cli/src/crypto.mjs
function parseTtl(input) {
  if (input == null) return 86400;
  const m = String(input).trim().match(/^(\d+)\s*([smhd])?$/i);
  if (!m) throw new Error(`invalid --ttl: ${input} (use forms like 60s, 10m, 1h, 24h, 7d, 30d)`);
  const n = parseInt(m[1], 10);
  const unit = (m[2] || "s").toLowerCase();
  const mult = unit === "s" ? 1 : unit === "m" ? 60 : unit === "h" ? 3600 : 86400;
  return n * mult;
}

// packages/cli/src/api.mjs
var ApiError = class extends Error {
  constructor(status, code, message) {
    super(message || code || `HTTP ${status}`);
    this.status = status;
    this.code = code;
  }
};
function createClient({ api, token, fetchImpl = fetch }) {
  const base = (api || "https://onettl.com").replace(/\/+$/, "");
  async function req(method, path, body) {
    const headers = { "content-type": "application/json", "x-onettl-created-via": "cli" };
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetchImpl(`${base}${path}`, {
      method,
      headers,
      body: body !== void 0 ? JSON.stringify(body) : void 0
    });
    const text = await res.text();
    let json = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
    }
    if (!res.ok) throw new ApiError(res.status, json.error, json.message);
    return json;
  }
  return {
    base,
    createSecret: (payload) => req("POST", "/api/v1/secrets", payload),
    status: (id) => req("GET", `/api/v1/secrets/${id}/status`),
    revoke: (id) => req("POST", `/api/v1/secrets/${id}/revoke`, {}),
    list: (status) => req("GET", `/api/v1/secrets${status ? `?status=${status}` : ""}`)
  };
}
function buildCreateBody({ enc, ttl, opens, secretType, label }) {
  const body = {
    ciphertext: enc.ciphertext,
    encryption_mode: enc.encryption_mode,
    ttl,
    max_opens: opens,
    secret_type: secretType,
    passphraseProtected: enc.encryption_mode === "aesgcm_pbkdf2"
  };
  if (enc.salt) body.salt = enc.salt;
  if (label) body.label = label;
  return body;
}

// packages/cli/bin/onettl.js
function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === void 0 || next.startsWith("--")) flags[key] = true;
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
    return (0, import_node_fs2.readFileSync)(0, "utf8");
  } catch {
    return "";
  }
}
function prompt(question) {
  const rl = (0, import_node_readline.createInterface)({ input: process.stdin, output: process.stderr });
  return new Promise((resolve) => rl.question(question, (a) => {
    rl.close();
    resolve(a.trim());
  }));
}
function die(msg, code = 1) {
  console.error(`onettl: ${msg}`);
  process.exit(code);
}
var HELP = `onettl \u2014 one-time secret links for developers

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
      const passphrase = typeof flags.passphrase === "string" ? flags.passphrase : void 0;
      if (secretType === "json") {
        try {
          JSON.parse(text);
        } catch {
          die("--json given but the payload is not valid JSON");
        }
      }
      const enc = await encryptSecret(text, passphrase);
      const label = typeof flags.label === "string" ? flags.label : void 0;
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
      const status = typeof flags.status === "string" ? flags.status : void 0;
      const res = await client.list(status);
      for (const s of res.secrets) {
        console.log(`${s.id}	${s.status}	${s.open_count}/${s.max_opens}	${s.secret_type}	${s.label || ""}`);
      }
      return;
    }
    die(`unknown command '${cmd}' (try: onettl help)`);
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401) die("unauthorized \u2014 run `onettl login` with a valid token");
      die(`${err.code || "error"}: ${err.message}`);
    }
    die(err.message || String(err));
  }
}
main();
