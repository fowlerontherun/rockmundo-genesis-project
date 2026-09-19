const AUDIENCE = "rockmundo-totp-render";
export const DEFAULT_SUPABASE_URL = "https://yztogmdixmchsmimtent.supabase.co";
export const DEFAULT_GATEWAY = `${DEFAULT_SUPABASE_URL}/functions/v1/totp-render-worker-gateway`;

export async function githubOidcToken() {
  const requestUrl = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
  const requestToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if (!requestUrl || !requestToken) {
    throw new Error("GitHub OIDC is unavailable. Run this worker from the approved GitHub Actions workflow.");
  }
  const url = new URL(requestUrl);
  url.searchParams.set("audience", AUDIENCE);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${requestToken}` },
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Could not mint GitHub OIDC token (${response.status}): ${body}`);
  const parsed = JSON.parse(body);
  if (!parsed.value) throw new Error("GitHub did not return an OIDC token.");
  return parsed.value;
}

export async function renderGateway(action, payload = {}) {
  const gateway = process.env.TOTP_RENDER_GATEWAY || DEFAULT_GATEWAY;
  const token = await githubOidcToken();
  const response = await fetch(gateway, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action, ...payload }),
  });
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : {}; } catch { body = { error: text }; }
  if (!response.ok) {
    throw new Error(body?.error || `Render gateway failed (${response.status}).`);
  }
  return body;
}
