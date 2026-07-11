// Config resolution for the CLI. File at ~/.config/onettl/config.json, with
// ONETTL_API / ONETTL_TOKEN env overrides taking precedence.

import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const DIR = join(homedir(), ".config", "onettl");
const FILE = join(DIR, "config.json");

export function loadConfig() {
  let file = {};
  try {
    file = JSON.parse(readFileSync(FILE, "utf8"));
  } catch {
    /* no file yet */
  }
  return {
    api: process.env.ONETTL_API || file.api || "https://onettl.com",
    token: process.env.ONETTL_TOKEN || file.token || null,
    path: FILE,
  };
}

export function saveConfig(patch) {
  let file = {};
  try {
    file = JSON.parse(readFileSync(FILE, "utf8"));
  } catch {
    /* ignore */
  }
  const merged = { ...file, ...patch };
  mkdirSync(DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify(merged, null, 2), { mode: 0o600 });
  return FILE;
}
