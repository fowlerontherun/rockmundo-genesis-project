import { supabase } from "@/integrations/supabase/client";
import { getActiveProfile } from "@/services/profileService";
import type { ShareMoment } from "./types";

export type ShareMomentSnapshot = {
  id: string;
  moment_type: string;
  source_id: string;
  headline: string;
  snapshot: ShareMoment;
  created_at: string;
  last_shared_at: string;
};

export async function saveShareMomentSnapshot(moment: ShareMoment) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const profile = await getActiveProfile(user.id);
  if (!profile) return;
  const frozen: ShareMoment = { ...moment, createdAt: moment.createdAt || new Date().toISOString() };
  const client: any = supabase;
  const { error } = await client.from("share_moment_snapshots").upsert({
    user_id: user.id,
    profile_id: profile?.id || null,
    moment_type: moment.type,
    source_id: moment.id || `${moment.type}:${moment.createdAt}`,
    headline: moment.headline,
    snapshot: frozen,
    last_shared_at: new Date().toISOString(),
  }, { onConflict: "user_id,moment_type,source_id" });
  if (error) throw error;
}

export async function listShareMomentSnapshots(): Promise<ShareMomentSnapshot[]> {
  const client: any = supabase;
  const { data, error } = await client.from("share_moment_snapshots").select("id,moment_type,source_id,headline,snapshot,created_at,last_shared_at").order("last_shared_at", { ascending: false }).limit(60);
  if (error) throw error;
  return (data || []) as unknown as ShareMomentSnapshot[];
}

export async function deleteShareMomentSnapshot(id: string) {
  const client: any = supabase;
  const { error } = await client.from("share_moment_snapshots").delete().eq("id", id);
  if (error) throw error;
}
