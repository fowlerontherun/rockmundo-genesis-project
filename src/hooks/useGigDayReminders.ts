import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { pushNotification } from "@/lib/notify";

/**
 * Notifies the player about gigs happening within the next 24h.
 * Dedupes via metadata.reminder_kind + gig_id so each gig only fires once
 * per reminder kind (currently: "today").
 *
 * Post-gig outcome notifications are produced server-side in gigExecution.ts.
 */
export const useGigDayReminders = () => {
  const { user } = useAuth();
  const { profileId } = useActiveProfile();

  useEffect(() => {
    if (!user?.id || !profileId) return;

    const check = async () => {
      const { data: memberships } = await supabase
        .from("band_members")
        .select("band_id")
        .eq("profile_id", profileId)
        .eq("member_status", "active");
      const bandIds = (memberships ?? []).map((m: any) => m.band_id);
      if (bandIds.length === 0) return;

      const now = new Date();
      const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const { data: gigs } = await supabase
        .from("gigs")
        .select("id, scheduled_date, venues!gigs_venue_id_fkey(name, city)")
        .in("band_id", bandIds)
        .eq("status", "scheduled")
        .gte("scheduled_date", now.toISOString())
        .lte("scheduled_date", in24h.toISOString());

      if (!gigs || gigs.length === 0) return;

      // Get existing reminders for these gigs (dedupe)
      const gigIds = gigs.map((g: any) => g.id);
      const { data: existing } = await supabase
        .from("notifications" as any)
        .select("metadata")
        .eq("user_id", user.id)
        .eq("category", "gig_reminder")
        .order("created_at", { ascending: false })
        .limit(50);
      const alreadyNotified = new Set<string>(
        (existing ?? [])
          .map((r: any) => r?.metadata?.gig_id)
          .filter(Boolean)
      );

      for (const gig of gigs as any[]) {
        if (alreadyNotified.has(gig.id)) continue;
        const venueName = gig.venues?.name ?? "your venue";
        const when = new Date(gig.scheduled_date);
        const hoursUntil = Math.max(
          1,
          Math.round((when.getTime() - now.getTime()) / (1000 * 60 * 60))
        );
        await pushNotification({
          userId: user.id,
          profileId,
          category: "gig_reminder",
          type: "info",
          title: `🎸 Gig today at ${venueName}`,
          message: `Starts in ~${hoursUntil}h. Tap to prepare.`,
          actionPath: "/gigs",
          metadata: { gig_id: gig.id, reminder_kind: "today" },
        });
      }
    };

    check();
    const interval = setInterval(check, 5 * 60 * 1000); // every 5 min
    return () => clearInterval(interval);
  }, [user?.id, profileId]);
};
