/** Replicate webhook authentication: https://replicate.com/docs/topics/webhooks/verify-webhook */
export interface ReplicateSignatureInput {
  webhookId: string | null;
  timestamp: string | null;
  signature: string | null;
  rawBody: string;
  secret: string;
  nowSeconds?: number;
}

export async function verifyReplicateWebhookSignature({
  webhookId, timestamp, signature, rawBody, secret,
  nowSeconds = Math.floor(Date.now() / 1000),
}: ReplicateSignatureInput): Promise<boolean> {
  if (!webhookId || !timestamp || !signature || !/^\d{10}$/.test(timestamp)) return false;
  if (Math.abs(nowSeconds - Number(timestamp)) > 300) return false;
  if (!secret.startsWith("whsec_")) return false;

  try {
    const keyBytes = Uint8Array.from(atob(secret.slice(6)), c => c.charCodeAt(0));
    const key = await crypto.subtle.importKey(
      "raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
    );
    const signedContent = `${webhookId}.${timestamp}.${rawBody}`;
    const expected = new Uint8Array(await crypto.subtle.sign(
      "HMAC", key, new TextEncoder().encode(signedContent),
    ));
    // Signatures have "v1,<base64>" form; use a fixed-length comparison.
    for (const entry of signature.split(" ")) {
      if (!entry.startsWith("v1,")) continue;
      let candidate: Uint8Array;
      try { candidate = Uint8Array.from(atob(entry.slice(3)), c => c.charCodeAt(0)); }
      catch { continue; }
      if (candidate.length !== expected.length) continue;
      let mismatch = 0;
      for (let i = 0; i < expected.length; i++) mismatch |= expected[i] ^ candidate[i];
      if (mismatch === 0) return true;
    }
  } catch {
    // Malformed secret or non-available crypto fails closed.
  }
  return false;
}
