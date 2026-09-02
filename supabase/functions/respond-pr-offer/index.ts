import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authorization = req.headers.get("Authorization") ?? "";
    const token = authorization.replace(/^Bearer\s+/i, "");
    if (!token) return json({ success: false, message: "You must be signed in to manage PR offers" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) return json({ success: false, message: "Your session is no longer valid" }, 401);

    const body = await req.json().catch(() => ({}));
    const offerId = body?.offerId as string | undefined;
    const action = body?.action as "accept" | "decline" | undefined;
    if (!offerId || !action || !["accept", "decline"].includes(action)) {
      return json({ success: false, message: "A valid offerId and action are required" }, 400);
    }

    const { data: offer, error: offerError } = await supabase
      .from("pr_media_offers")
      .select("*")
      .eq("id", offerId)
      .single();
    if (offerError || !offer) return json({ success: false, message: "This PR offer could not be found" }, 404);
    if (offer.status !== "pending") return json({ success: false, message: `This PR offer is already ${offer.status}` }, 409);
    if (offer.expires_at && new Date(offer.expires_at) <= new Date()) {
      await supabase.from("pr_media_offers").update({ status: "expired" }).eq("id", offerId).eq("status", "pending");
      return json({ success: false, message: "This PR offer has expired" }, 410);
    }

    const { data: band, error: bandError } = await supabase
      .from("bands")
      .select("id, leader_id")
      .eq("id", offer.band_id)
      .single();
    if (bandError || !band?.leader_id) return json({ success: false, message: "The band's leader could not be resolved" }, 422);

    const { data: leader, error: leaderError } = await supabase
      .from("profiles")
      .select("id, user_id")
      .eq("id", band.leader_id)
      .single();
    if (leaderError || !leader?.user_id) return json({ success: false, message: "The band leader's character could not be found" }, 422);
    if (leader.user_id !== authData.user.id) return json({ success: false, message: "Only the current band leader can manage this PR offer" }, 403);

    if (action === "decline") {
      const { error } = await supabase.from("pr_media_offers").update({ status: "declined" }).eq("id", offerId).eq("status", "pending");
      if (error) throw error;
      return json({ success: true, action: "declined" });
    }

    const slot = /^\d{2}:\d{2}$/.test(offer.time_slot ?? "") ? offer.time_slot : "10:00";
    const startTime = new Date(`${offer.proposed_date}T${slot}:00Z`);
    if (Number.isNaN(startTime.getTime())) return json({ success: false, message: "The PR offer has an invalid date or time" }, 422);
    if (startTime <= new Date()) return json({ success: false, message: "The proposed PR appearance time has already passed" }, 409);

    const durationMinutes = offer.media_type === "film"
      ? 7 * 24 * 60
      : Math.max(1, Number(offer.duration_hours ?? 1)) * 60;
    const endTime = new Date(startTime.getTime() + durationMinutes * 60_000);

    const { data: members, error: membersError } = await supabase
      .from("band_members")
      .select("profile_id, user_id")
      .eq("band_id", offer.band_id)
      .eq("member_status", "active")
      .eq("is_touring_member", false)
      .not("profile_id", "is", null);
    if (membersError) throw membersError;

    const realMembers = (members ?? []).filter((member: any) => member.profile_id);
    if (realMembers.length === 0) return json({ success: false, message: "No active band members could be scheduled" }, 422);

    const profileIds = realMembers.map((member: any) => member.profile_id);
    const { data: conflicts, error: conflictError } = await supabase
      .from("player_scheduled_activities")
      .select("profile_id, title, scheduled_start, scheduled_end")
      .in("profile_id", profileIds)
      .in("status", ["scheduled", "in_progress"])
      .lt("scheduled_start", endTime.toISOString())
      .gt("scheduled_end", startTime.toISOString());
    if (conflictError) throw conflictError;

    if ((conflicts ?? []).length > 0) {
      const conflictProfileIds = [...new Set((conflicts ?? []).map((item: any) => item.profile_id))];
      const { data: profiles } = await supabase.from("profiles").select("id, display_name, username").in("id", conflictProfileIds);
      const names = new Map((profiles ?? []).map((profile: any) => [profile.id, profile.display_name || profile.username || "Band member"]));
      const details = (conflicts ?? []).slice(0, 3).map((item: any) => `${names.get(item.profile_id) || "Band member"} — ${item.title || "another activity"}`);
      return json({
        success: false,
        code: "band_scheduling_conflict",
        message: `The band is unavailable at this time: ${details.join("; ")}.`,
        conflicts,
      }, 409);
    }

    const { error: acceptError } = await supabase
      .from("pr_media_offers")
      .update({ status: "accepted", accepted_at: new Date().toISOString() })
      .eq("id", offerId)
      .eq("status", "pending");
    if (acceptError) throw acceptError;

    const title = `PR: ${String(offer.media_type).toUpperCase()} Appearance`;
    const activityRows = realMembers.map((member: any) => ({
      user_id: member.user_id,
      profile_id: member.profile_id,
      activity_type: offer.media_type === "film" ? "film_production" : "pr_appearance",
      title,
      scheduled_start: startTime.toISOString(),
      scheduled_end: endTime.toISOString(),
      duration_minutes: durationMinutes,
      status: "scheduled",
      metadata: {
        offer_id: offerId,
        media_type: offer.media_type,
        compensation: offer.compensation,
        fame_boost: offer.fame_boost,
        fan_boost: offer.fan_boost,
        band_id: offer.band_id,
        time_slot: slot,
        is_band_activity: true,
        pr_band_fanout: true,
      },
    }));

    const { error: scheduleError } = await supabase.from("player_scheduled_activities").insert(activityRows);
    if (scheduleError) {
      await supabase.from("pr_media_offers").update({ status: "pending", accepted_at: null }).eq("id", offerId).eq("status", "accepted");
      throw new Error(`Failed to schedule the PR appearance: ${scheduleError.message}`);
    }

    return json({ success: true, action: "accepted", scheduledFor: startTime.toISOString() });
  } catch (error) {
    console.error("[respond-pr-offer]", error);
    return json({ success: false, message: error instanceof Error ? error.message : "Unable to process this PR offer" }, 500);
  }
});
