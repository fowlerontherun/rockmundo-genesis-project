import { supabase } from "@/integrations/supabase/client";

export async function uploadShareCardToTwaater(blob: Blob, filename: string): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in to post this card to Twaater.");
  const safeName = filename.replace(/[^a-z0-9._-]+/gi, "-").toLowerCase();
  const path = `share-cards/${user.id}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from("twaater-media").upload(path, blob, {
    contentType: "image/png",
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from("twaater-media").getPublicUrl(path).data.publicUrl;
}


/** Remove an unpublished share card belonging to the current user. */
export async function removeUnpublishedShareCard(mediaUrl: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const prefix = `/storage/v1/object/public/twaater-media/share-cards/${user.id}/`;
  let parsed: URL;
  try { parsed = new URL(mediaUrl); } catch { return; }
  const trustedUrl = supabase.storage.from("twaater-media").getPublicUrl(`share-cards/${user.id}/example.png`).data.publicUrl;
  if (parsed.origin !== new URL(trustedUrl).origin || !parsed.pathname.startsWith(prefix)) return;
  let filename: string;
  try { filename = decodeURIComponent(parsed.pathname.slice(prefix.length)); } catch { return; }
  if (!filename || filename.includes("/") || filename.includes("\\") || filename === "." || filename === "..") return;
  const { error } = await supabase.storage.from("twaater-media").remove([`share-cards/${user.id}/${filename}`]);
  if (error) throw error;
}

export function storeTwaaterShareDraft(body: string, mediaUrl: string, shareCooldownKey?: string | null) {
  try {
    sessionStorage.setItem("rockmundoTwaaterShareDraft", JSON.stringify({ body, mediaUrl, mediaType: "image", shareCooldownKey }));
  } catch {
    throw new Error("Unable to save the Twaater draft. Check your browser storage settings.");
  }
}


export async function registerTwaaterSharePublicationReceipt(twaatId: string, shareCooldownKey: string) {
  const { error } = await (supabase.rpc as any)("register_twaater_share_publication_receipt", {
    p_twaat_id: twaatId,
    p_cooldown_key: shareCooldownKey,
  });
  if (error) throw error;
}

export async function reconcilePublishedTwaaterShareReceipts(): Promise<number> {
  const { data, error } = await (supabase.rpc as any)("consume_my_published_share_receipts");
  if (error) throw error;
  const receipts = Array.isArray(data) ? data : [];
  let applied = 0;
  for (const receipt of receipts) {
    const key = typeof receipt?.cooldown_key === "string" ? receipt.cooldown_key : "";
    const publishedAt = typeof receipt?.published_at === "string" ? Date.parse(receipt.published_at) : NaN;
    if (!key || !Number.isFinite(publishedAt)) continue;
    try {
      const existing = Number(localStorage.getItem(key) || 0);
      if (!Number.isFinite(existing) || existing < publishedAt) {
        localStorage.setItem(key, String(publishedAt));
      }
      applied += 1;
    } catch {
      // Receipt is already acknowledged server-side; unavailable browser storage
      // must not break Twaater. The next actual share can still refresh locally.
    }
  }
  return applied;
}
