// Thin API client for the OneTTL CLI. Injectable `fetch` so it can be tested
// against a stub without a live server.

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message || code || `HTTP ${status}`);
    this.status = status;
    this.code = code;
  }
}

export function createClient({ api, token, fetchImpl = fetch }) {
  const base = (api || "https://onettl.com").replace(/\/+$/, "");
  async function req(method, path, body) {
    const headers = { "content-type": "application/json", "x-onettl-created-via": "cli" };
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetchImpl(`${base}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      /* non-json */
    }
    if (!res.ok) throw new ApiError(res.status, json.error, json.message);
    return json;
  }
  return {
    base,
    createSecret: (payload) => req("POST", "/api/v1/secrets", payload),
    status: (id) => req("GET", `/api/v1/secrets/${id}/status`),
    revoke: (id) => req("POST", `/api/v1/secrets/${id}/revoke`, {}),
    list: (status) => req("GET", `/api/v1/secrets${status ? `?status=${status}` : ""}`),
  };
}

export function buildCreateBody({ enc, ttl, opens, secretType, label }) {
  const body = {
    ciphertext: enc.ciphertext,
    encryption_mode: enc.encryption_mode,
    ttl,
    max_opens: opens,
    secret_type: secretType,
    passphraseProtected: enc.encryption_mode === "aesgcm_pbkdf2",
  };
  if (enc.salt) body.salt = enc.salt;
  if (label) body.label = label;
  return body;
}
