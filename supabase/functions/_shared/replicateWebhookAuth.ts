// Private, per-attempt HMAC protects the public Replicate callback endpoint.
// Signing with the server-only service key avoids introducing an extra deployment secret.
const keyFor = (secret: string) => crypto.subtle.importKey(
  "raw", new TextEncoder().encode(secret),
  { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"],
);
const messageFor = (attemptId: string, songId: string) =>
  new TextEncoder().encode(`${attemptId}:${songId}`);
export async function signReplicateAttempt(attemptId: string, songId: string, secret: string) {
  const signature = await crypto.subtle.sign("HMAC", await keyFor(secret), messageFor(attemptId, songId));
  return [...new Uint8Array(signature)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}
export async function verifyReplicateAttempt(attemptId: string, songId: string, signature: string, secret: string) {
  if (!/^[0-9a-f]{64}$/i.test(signature)) return false;
  const bytes = new Uint8Array(signature.match(/.{2}/g)!.map(pair => Number.parseInt(pair, 16)));
  return crypto.subtle.verify("HMAC", await keyFor(secret), bytes, messageFor(attemptId, songId));
}
