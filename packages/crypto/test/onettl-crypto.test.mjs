// Proves the unified crypto core is byte-format-identical to the pre-refactor
// implementation, so existing one-time links keep decrypting. Run: node --test
import { test } from "node:test";
import assert from "node:assert/strict";

import * as core from "../src/crypto.mjs";
// Frozen snapshot of the shipping pre-refactor CLI crypto. This is the format
// oracle — do NOT edit it; it exists to catch any drift in the unified core.
import * as legacy from "../reference/legacy-crypto.mjs";

const PLAIN = "API_KEY=sk_live_abc123\nDB_URL=postgres://u:p@h/db";
const PASS = "correct horse battery";

// Known-answer vectors captured from the pre-refactor code (same wire format as
// the browser client). The unified core MUST decrypt these forever.
const KAT_PLAIN = {
  ciphertext:
    "EfKwmSt33susyMa39WaTXDRdJolNynd5d4zAN8j5njJ4sQ_AdIt2Wsx5O3svyCbjv_oRt8N8GqH186p6fk-aySbtklQfdbUVajp6oH4",
  encryption_mode: "aesgcm",
  keyFragment: "_sBV3R4Xqfq7vnv4YUnHcf8lfDoZ1eqzbOJDv7g6AOI",
};
const KAT_PBKDF2 = {
  ciphertext:
    "ZVoo1uJoUXw3BDE9dUhxd-EwEyaaEeFEqvU0iHLk4IMI-gVe_V1QiuReViZNSVzf7MPZtP3KgrlxwevtLabLXaC5UwkoUieFOJZ8b5EPpvpZuse9ihLXW9L38iNrMQ_Jyat_iD9lyNHM",
  encryption_mode: "aesgcm_pbkdf2",
  keyFragment: "apap4U8Xo7JveU03p3UHqIOzdTI86XSSCsAIZ9RAudI",
  salt: "kQMoO8Wz5mR2BAqhMIKb5w",
};

// ---- b64url: pure impl produces identical bytes to the legacy Buffer impl ----

test("b64url encode matches legacy for all byte values and lengths", () => {
  for (let len = 0; len <= 130; len++) {
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = (i * 37 + len * 11) & 255;
    assert.equal(core.bytesToB64url(bytes), legacy.bytesToB64url(bytes), `len ${len}`);
  }
});

test("b64url round-trips and decodes legacy output", () => {
  for (let len = 0; len <= 130; len++) {
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = (i * 53 + 7) & 255;
    const enc = core.bytesToB64url(bytes);
    assert.deepEqual([...core.b64urlToBytes(enc)], [...bytes], `core round-trip len ${len}`);
    assert.deepEqual([...core.b64urlToBytes(legacy.bytesToB64url(bytes))], [...bytes], `decode legacy len ${len}`);
  }
});

// ---- frozen known-answer vectors (format stability, forever) ----------------

test("core decrypts pre-refactor aesgcm vector", async () => {
  assert.equal(await core.decryptSecret(KAT_PLAIN, KAT_PLAIN.keyFragment), PLAIN);
});

test("core decrypts pre-refactor aesgcm_pbkdf2 vector", async () => {
  assert.equal(await core.decryptSecret(KAT_PBKDF2, KAT_PBKDF2.keyFragment, PASS), PLAIN);
});

// ---- cross-compat with the legacy implementation, both directions -----------

test("legacy encrypt -> core decrypt (aesgcm)", async () => {
  const e = await legacy.encryptSecret(PLAIN);
  assert.equal(e.encryption_mode, "aesgcm");
  assert.equal(await core.decryptSecret(e, e.keyFragment), PLAIN);
});

test("legacy encrypt -> core decrypt (aesgcm_pbkdf2)", async () => {
  const e = await legacy.encryptSecret(PLAIN, PASS);
  assert.equal(e.encryption_mode, "aesgcm_pbkdf2");
  assert.equal(await core.decryptSecret(e, e.keyFragment, PASS), PLAIN);
});

test("core encrypt -> legacy decrypt (aesgcm)", async () => {
  const e = await core.encryptSecret(PLAIN);
  assert.equal(await legacy.decryptSecret(e, e.keyFragment), PLAIN);
});

test("core encrypt -> legacy decrypt (aesgcm_pbkdf2)", async () => {
  const e = await core.encryptSecret(PLAIN, PASS);
  assert.equal(await legacy.decryptSecret(e, e.keyFragment, PASS), PLAIN);
});

// ---- self round-trip + negative cases ---------------------------------------

test("core round-trips both modes, including unicode + empty", async () => {
  for (const p of ["", "hello", "秘密 · émojis 🔐 · multi\nline", PLAIN]) {
    const a = await core.encryptSecret(p);
    assert.equal(await core.decryptSecret(a, a.keyFragment), p);
    const b = await core.encryptSecret(p, PASS);
    assert.equal(await core.decryptSecret(b, b.keyFragment, PASS), p);
  }
});

test("wrong passphrase fails to decrypt", async () => {
  const e = await core.encryptSecret(PLAIN, PASS);
  await assert.rejects(core.decryptSecret(e, e.keyFragment, "wrong passphrase"));
});

test("format constants are the ratified v1 values", () => {
  assert.equal(core.FORMAT_VERSION, 1);
  assert.equal(core.PBKDF2_ITERS, 600_000);
  assert.equal(core.IV_BYTES, 12);
  assert.equal(core.SALT_BYTES, 16);
});
