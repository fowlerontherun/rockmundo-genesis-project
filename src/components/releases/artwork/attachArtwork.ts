import { supabase } from '@/integrations/supabase/client';

/** Retries only the attachment. It must never create or finance a release. */
export function createArtworkAttachment(releaseId: string, file: File) {
  let uploadedUrl: string | null = null;
  let inFlight: Promise<void> | null = null;
  const attach = async () => {
    if (!uploadedUrl) {
      const extension = file.name.split('.').pop()?.replace(/[^a-z0-9]/gi, '') || 'png';
      const path = `release-artwork/${releaseId}-${crypto.randomUUID()}.${extension}`;
      const { error } = await supabase.storage.from('music').upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      uploadedUrl = supabase.storage.from('music').getPublicUrl(path).data.publicUrl;
    }
    const { data, error } = await supabase.from('releases').update({ artwork_url: uploadedUrl }).eq('id', releaseId).select('id').single();
    if (error) throw error;
    if (data?.id !== releaseId) throw new Error('Artwork attachment was not confirmed.');
  };
  return () => {
    if (!inFlight) inFlight = attach().finally(() => { inFlight = null; });
    return inFlight;
  };
}

/** Creation is already committed; a refresh failure must not become a create failure. */
export async function getCreatedReleaseSummary(releaseId: string) {
  const fallback = { id: releaseId, manufacturing_complete_at: null as string | null, scheduled_release_date: null as string | null };
  try {
    const { data, error } = await supabase.from('releases').select('id, manufacturing_complete_at, scheduled_release_date').eq('id', releaseId).single();
    return !error && data?.id === releaseId ? data : fallback;
  } catch { return fallback; }
}
