import { supabase } from "@/integrations/supabase/client";

// Track uploads which have not yet been handed off to a Twaater composer.
const unsubmittedShareCards = new Map<string, string>();
export async function discardUploadedShareCard(mediaUrl: string): Promise<void> {
  const path = unsubmittedShareCards.get(mediaUrl);
  if (!path) return;
  const { error } = await supabase.storage.from("twaater-media").remove([path]);
  if (error) throw error;
  unsubmittedShareCards.delete(mediaUrl);
}


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
  const mediaUrl = supabase.storage.from("twaater-media").getPublicUrl(path).data.publicUrl;
  unsubmittedShareCards.set(mediaUrl, path);
  return mediaUrl;
}

export type TwaaterShareDraft = { body: string; mediaUrl: string; mediaType: "image"; shareCooldownKey?: string | null; userId: string };
let fallbackDraft: TwaaterShareDraft | null = null;

export async function storeTwaaterShareDraft(body: string, mediaUrl: string, shareCooldownKey?: string | null): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in before sharing to Twaater.");
  const draft: TwaaterShareDraft = { body, mediaUrl, mediaType: "image", shareCooldownKey, userId: user.id };
  if (fallbackDraft?.mediaUrl && fallbackDraft.mediaUrl !== mediaUrl) {
    // Replacing an abandoned unsubmitted draft must not leak the old image.
    await discardUploadedShareCard(fallbackDraft.mediaUrl);
  }
  fallbackDraft = draft;
  try {
    sessionStorage.setItem("rockmundoTwaaterShareDraft", JSON.stringify(draft));
  } catch {
    // Storage can be denied by browser privacy settings. Same-tab navigation still works.
  }
}

export async function consumeTwaaterShareDraft(): Promise<TwaaterShareDraft | null> {
  const { data: { user } } = await supabase.auth.getUser();
  let draft = fallbackDraft;
  fallbackDraft = null;
  try {
    const raw = sessionStorage.getItem("rockmundoTwaaterShareDraft");
    sessionStorage.removeItem("rockmundoTwaaterShareDraft");
    if (raw) draft = JSON.parse(raw) as TwaaterShareDraft;
  } catch {
    // Continue with the in-memory handoff if browser storage is unavailable.
  }
  if (user && draft?.userId === user.id) {
    // Twaater now owns the media: never remove a card handed to the composer.
    unsubmittedShareCards.delete(draft.mediaUrl);
    return draft;
  }
  if (draft?.mediaUrl) await discardUploadedShareCard(draft.mediaUrl);
  return null;
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
