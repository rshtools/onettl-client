import { test } from "node:test";
import assert from "node:assert/strict";
import { encryptSecret, decryptSecret, parseTtl, bytesToB64url, b64urlToBytes } from "../src/crypto.mjs";
import { createClient, buildCreateBody, ApiError } from "../src/api.mjs";

test("parseTtl handles s/m/h/d and defaults", () => {
  assert.equal(parseTtl(undefined), 86_400);
  assert.equal(parseTtl("60s"), 60);
  assert.equal(parseTtl("10m"), 600);
  assert.equal(parseTtl("1h"), 3600);
  assert.equal(parseTtl("24h"), 86_400);
  assert.equal(parseTtl("7d"), 604_800);
  assert.equal(parseTtl("30d"), 2_592_000);
  assert.throws(() => parseTtl("banana"));
});

test("b64url round-trips", () => {
  const b = new Uint8Array([0, 1, 2, 250, 255, 128]);
  assert.deepEqual([...b64urlToBytes(bytesToB64url(b))], [...b]);
});

test("encryptSecret → decryptSecret round-trips (no passphrase)", async () => {
  const enc = await encryptSecret("API_KEY=sk_live_test");
  assert.equal(enc.encryption_mode, "aesgcm");
  const back = await decryptSecret({ ciphertext: enc.ciphertext, encryption_mode: enc.encryption_mode }, enc.keyFragment);
  assert.equal(back, "API_KEY=sk_live_test");
});

test("encryptSecret with passphrase requires both key and passphrase", async () => {
  const enc = await encryptSecret("secret-value", "hunter2");
  assert.equal(enc.encryption_mode, "aesgcm_pbkdf2");
  assert.ok(enc.salt);
  const ok = await decryptSecret(
    { ciphertext: enc.ciphertext, encryption_mode: enc.encryption_mode, salt: enc.salt },
    enc.keyFragment,
    "hunter2",
  );
  assert.equal(ok, "secret-value");
  await assert.rejects(
    decryptSecret(
      { ciphertext: enc.ciphertext, encryption_mode: enc.encryption_mode, salt: enc.salt },
      enc.keyFragment,
      "wrong",
    ),
  );
});

test("createClient posts ciphertext + bearer, never plaintext", async () => {
  let captured;
  const fetchImpl = async (url, init) => {
    captured = { url, init };
    return new Response(JSON.stringify({ id: "abc", url: "https://onettl.com/s/abc", max_opens: 1 }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  };
  const client = createClient({ api: "https://onettl.com", token: "ottl_test", fetchImpl });
  const enc = await encryptSecret("plaintext-should-not-appear");
  const body = buildCreateBody({ enc, ttl: 3600, opens: 1, secretType: "text", label: "x" });
  const res = await client.createSecret(body);
  assert.equal(res.id, "abc");
  assert.equal(captured.url, "https://onettl.com/api/v1/secrets");
  assert.equal(captured.init.headers.authorization, "Bearer ottl_test");
  assert.equal(captured.init.headers["x-onettl-created-via"], "cli");
  // The request body must not contain plaintext.
  assert.ok(!captured.init.body.includes("plaintext-should-not-appear"));
});

test("ApiError surfaces status and code", async () => {
  const fetchImpl = async () =>
    new Response(JSON.stringify({ error: "unauthorized", message: "nope" }), { status: 401 });
  const client = createClient({ api: "https://onettl.com", fetchImpl });
  await assert.rejects(client.list(), (e) => e instanceof ApiError && e.status === 401 && e.code === "unauthorized");
});
