import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Find all in_progress teaching sessions that have expired
    const now = new Date();

    const { data: activeSessions, error: fetchError } = await supabase
      .from("player_teaching_sessions")
      .select("*")
      .eq("status", "in_progress");

    if (fetchError) {
      console.error("Failed to fetch teaching sessions", fetchError);
      return new Response(
        JSON.stringify({ success: false, error: fetchError.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    if (!activeSessions || activeSessions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: "No active sessions" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let completedCount = 0;
    let xpAwardedCount = 0;

    for (const session of activeSessions) {
      if (!session.started_at) continue;

      const startDate = new Date(session.started_at);
      const endDate = new Date(startDate.getTime() + session.session_duration_days * 24 * 60 * 60 * 1000);

      // Check if session has expired
      if (now >= endDate) {
        // Mark session as completed
        const { error: updateError } = await supabase
          .from("player_teaching_sessions")
          .update({ status: "completed", completed_at: now.toISOString() })
          .eq("id", session.id);

        if (updateError) {
          console.error(`Failed to complete session ${session.id}`, updateError);
          continue;
        }

        completedCount++;

        // Award XP to teacher via progression edge function
        if (session.teacher_xp_earned > 0) {
          const { error: teacherXpError } = await supabase.functions.invoke("progression", {
            body: {
              action: "award_action_xp",
              amount: session.teacher_xp_earned,
              category: "teaching",
              action_key: "teaching_session_complete",
              metadata: {
                session_id: session.id,
                role: "teacher",
                skill_slug: session.skill_slug,
                duration_days: session.session_duration_days,
              },
              // Override auth — use teacher's profile
              target_profile_id: session.teacher_profile_id,
            },
          });

          if (teacherXpError) {
            console.error(`Failed to award teacher XP for session ${session.id}`, teacherXpError);
          } else {
            xpAwardedCount++;
          }
        }

        // Award XP to student via progression edge function
        if (session.student_xp_earned > 0) {
          const { error: studentXpError } = await supabase.functions.invoke("progression", {
            body: {
              action: "award_action_xp",
              amount: session.student_xp_earned,
              category: "learning",
              action_key: "teaching_session_student",
              metadata: {
                session_id: session.id,
                role: "student",
                skill_slug: session.skill_slug,
                duration_days: session.session_duration_days,
              },
              target_profile_id: session.student_profile_id,
            },
          });

          if (studentXpError) {
            console.error(`Failed to award student XP for session ${session.id}`, studentXpError);
          } else {
            xpAwardedCount++;
          }
        }

        // === TEACHING SESSION → MORALE & REPUTATION (v1.0.972) ===
        // Teaching others is a generous act that boosts reputation; both parties feel good
        try {
          // Teacher gets reputation boost (mentoring)
          const { data: teacherBm } = await supabase
            .from('band_members')
            .select('band_id')
            .eq('user_id', session.teacher_profile_id)
            .eq('is_touring_member', false)
            .limit(1)
            .maybeSingle();
          if (teacherBm?.band_id) {
            const { data: bd } = await supabase.from('bands').select('morale, reputation_score').eq('id', teacherBm.band_id).single();
            if (bd) {
              const curM = (bd as any).morale ?? 50;
              const curR = (bd as any).reputation_score ?? 0;
              await supabase.from('bands').update({
                morale: Math.min(100, curM + 3),
                reputation_score: Math.min(100, curR + 4), // mentoring boosts rep
              } as any).eq('id', teacherBm.band_id);
              console.log(`Teaching session: teacher band ${teacherBm.band_id} → morale +3, rep +4`);
            }
          }
          // Student gets morale boost (learning feels good)
          const { data: studentBm } = await supabase
            .from('band_members')
            .select('band_id')
            .eq('user_id', session.student_profile_id)
            .eq('is_touring_member', false)
            .limit(1)
            .maybeSingle();
          if (studentBm?.band_id && studentBm.band_id !== teacherBm?.band_id) {
            const { data: bd2 } = await supabase.from('bands').select('morale').eq('id', studentBm.band_id).single();
            if (bd2) {
              await supabase.from('bands').update({ morale: Math.min(100, ((bd2 as any).morale ?? 50) + 2) } as any).eq('id', studentBm.band_id);
              console.log(`Teaching session: student band ${studentBm.band_id} → morale +2`);
            }
          }
        } catch (_e) { /* non-critical */ }

        // Log activity for both players
        const activityMessage = `Teaching session completed: ${session.skill_slug} (${session.session_duration_days} days)`;

        await supabase.from("activity_feed").insert([
          {
            user_id: session.teacher_profile_id,
            activity_type: "teaching_complete",
            message: `📚 ${activityMessage} — earned ${session.teacher_xp_earned} XP as teacher`,
            earnings: 0,
            metadata: { session_id: session.id, role: "teacher", xp: session.teacher_xp_earned },
          },
          {
            user_id: session.student_profile_id,
            activity_type: "teaching_complete",
            message: `🎓 ${activityMessage} — earned ${session.student_xp_earned} XP as student`,
            earnings: 0,
            metadata: { session_id: session.id, role: "student", xp: session.student_xp_earned },
          },
        ]);
      }
    }

    console.log(`Teaching sessions processed: ${completedCount} completed, ${xpAwardedCount} XP awards`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: completedCount,
        xpAwarded: xpAwardedCount,
        totalActive: activeSessions.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error in process-teaching-sessions", err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
