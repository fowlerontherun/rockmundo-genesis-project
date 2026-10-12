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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const profile = await getActiveProfile(user.id);
  if (!profile) return [];
  const client: any = supabase;
  const snapshots: ShareMomentSnapshot[] = [];
  for (let offset = 0; offset < 100_000; offset += 1000) {
    const { data, error } = await client.from("share_moment_snapshots").select("id,moment_type,source_id,headline,snapshot,created_at,last_shared_at").eq("user_id", user.id).eq("profile_id", profile.id).order("last_shared_at", { ascending: false }).order("id", { ascending: false }).range(offset, offset + 999);
    if (error) throw error;
    snapshots.push(...((data || []) as ShareMomentSnapshot[]));
    if (!data || data.length < 1000) return snapshots;
  }
  throw new Error("Share gallery exceeds pagination safety limit");
}

export async function deleteShareMomentSnapshot(id: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in to delete a saved share.");
  const client: any = supabase;
  const profile = await getActiveProfile(user.id);
  if (!profile) throw new Error("No active character selected");
  const { data, error } = await client.from("share_moment_snapshots").delete().eq("id", id).eq("user_id", user.id).eq("profile_id", profile.id).select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("Saved share not found or already deleted");
}
