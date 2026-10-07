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

export function storeTwaaterShareDraft(body: string, mediaUrl: string) {
  sessionStorage.setItem("rockmundoTwaaterShareDraft", JSON.stringify({ body, mediaUrl, mediaType: "image" }));
}
