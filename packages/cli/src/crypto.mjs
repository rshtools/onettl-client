// Client-side crypto for the OneTTL CLI. The zero-knowledge scheme lives in the
// shared, isomorphic crypto core (`@onettl/crypto`); this file re-exports it so
// the CLI and the browser client run the exact same code. Only `parseTtl` (a
// CLI-side argument helper, not crypto) stays local.
export {
  PBKDF2_ITERS,
  bytesToB64url,
  b64urlToBytes,
  encryptSecret,
  decryptSecret,
} from "@onettl/crypto";

// Parse a human TTL (60s, 10m, 1h, 24h, 7d, 30d) into seconds.
export function parseTtl(input) {
  if (input == null) return 86_400;
  const m = String(input).trim().match(/^(\d+)\s*([smhd])?$/i);
  if (!m) throw new Error(`invalid --ttl: ${input} (use forms like 60s, 10m, 1h, 24h, 7d, 30d)`);
  const n = parseInt(m[1], 10);
  const unit = (m[2] || "s").toLowerCase();
  const mult = unit === "s" ? 1 : unit === "m" ? 60 : unit === "h" ? 3600 : 86_400;
  return n * mult;
}
