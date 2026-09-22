import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const now = new Date();

    const { data: performances, error } = await supabase
      .from("major_event_performances")
      .select(`
        id,
        instance_id,
        status,
        song_1_id,
        song_2_id,
        song_3_id,
        instance:major_event_instances(
          event_start,
          event_date,
          event_end,
          event:major_events(name)
        )
      `)
      .eq("status", "accepted");

    if (error) throw error;

    let processed = 0;
    let skipped = 0;
    const failures: Array<{ performanceId: string; error: string }> = [];

    for (const performance of performances || []) {
      const scheduledAtRaw =
        performance.instance?.event_start ||
        performance.instance?.event_date;

      if (!scheduledAtRaw) {
        skipped++;
        continue;
      }

      const scheduledAt = new Date(scheduledAtRaw);
      if (Number.isNaN(scheduledAt.getTime()) || scheduledAt > now) {
        skipped++;
        continue;
      }

      const { data: claimed, error: claimError } = await supabase
        .from("major_event_performances")
        .update({
          status: "in_progress",
          started_at: now.toISOString(),
          current_song_position: 1,
        })
        .eq("id", performance.id)
        .eq("status", "accepted")
        .select("id")
        .maybeSingle();

      if (claimError) throw claimError;
      if (!claimed) {
        skipped++;
        continue;
      }

      try {
        const songIds = [
          performance.song_1_id,
          performance.song_2_id,
          performance.song_3_id,
        ];

        for (let index = 0; index < songIds.length; index++) {
          const songId = songIds[index];
          if (!songId) {
            throw new Error(`Missing song ${index + 1}`);
          }

          const { data: existingSong, error: existingSongError } = await supabase
            .from("major_event_song_performances")
            .select("id")
            .eq("performance_id", performance.id)
            .eq("position", index + 1)
            .maybeSingle();

          if (existingSongError) throw existingSongError;

          if (!existingSong) {
            const response = await fetch(
              `${supabaseUrl}/functions/v1/process-major-event-song`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${serviceRoleKey}`,
                  apikey: serviceRoleKey,
                },
                body: JSON.stringify({
                  performanceId: performance.id,
                  songId,
                  position: index + 1,
                }),
              },
            );

            if (!response.ok) {
              throw new Error(
                `Song ${index + 1} processing failed: ${await response.text()}`,
              );
            }
          }

          await supabase
            .from("major_event_performances")
            .update({ current_song_position: index + 2 })
            .eq("id", performance.id);
        }

        const completeResponse = await fetch(
          `${supabaseUrl}/functions/v1/complete-major-event`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceRoleKey}`,
              apikey: serviceRoleKey,
            },
            body: JSON.stringify({ performanceId: performance.id }),
          },
        );

        if (!completeResponse.ok) {
          throw new Error(
            `Completion failed: ${await completeResponse.text()}`,
          );
        }

        processed++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        failures.push({ performanceId: performance.id, error: message });

        // Re-open for a later retry. Existing song results are reused on the next pass.
        await supabase
          .from("major_event_performances")
          .update({ status: "accepted" })
          .eq("id", performance.id);
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed, skipped, failures }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Auto major event processing failed:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
