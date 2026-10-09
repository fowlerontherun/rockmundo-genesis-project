import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors });
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const bearer = req.headers.get("Authorization");
  if (!bearer?.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401, headers: cors });
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: bearer } },
    auth: { persistSession: false },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return new Response("Unauthorized", { status: 401, headers: cors });
  let payload: { enrollmentId?: string };
  try { payload = await req.json(); } catch { return new Response("Invalid JSON", { status: 400, headers: cors }); }
  if (!payload.enrollmentId || !/^[0-9a-f-]{36}$/i.test(payload.enrollmentId)) {
    return new Response("Invalid enrollment", { status: 400, headers: cors });
  }
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });
  const { data: enrollment, error: enrollmentError } = await admin.from("player_university_enrollments")
    .select("id,profile_id,university_id,course_id,status,profiles!inner(user_id),university_courses!inner(xp_per_day_min,xp_per_day_max,class_start_hour,class_end_hour)")
    .eq("id", payload.enrollmentId).single();
  if (enrollmentError || !enrollment) return new Response("Enrollment not found", { status: 404, headers: cors });
  const profile = enrollment.profiles as unknown as { user_id: string };
  if (profile.user_id !== user.id) return new Response("Forbidden", { status: 403, headers: cors });
  const course = enrollment.university_courses as unknown as { xp_per_day_min: number; xp_per_day_max: number; class_start_hour: number | null; class_end_hour: number | null };
  const hour = new Date().getUTCHours();
  const start = course.class_start_hour ?? 10;
  const end = course.class_end_hour ?? 14;
  if (hour < start || hour >= end) return new Response("Class is not currently in session", { status: 409, headers: cors });
  const min = Math.min(100000, Math.max(1, Math.floor(course.xp_per_day_min)));
  const max = Math.min(100000, Math.max(min, Math.floor(course.xp_per_day_max)));
  const baseXp = min + Math.floor(Math.random() * (max - min + 1));
  const today = new Date().toISOString().slice(0, 10);
  const { data: award, error } = await admin.rpc("record_university_attendance_reward", {
    p_enrollment_id: enrollment.id,
    p_attendance_date: today,
    p_xp: baseXp,
    p_remote: false,
    p_connection_failed: false,
  });
  if (error) {
    console.error("Manual university attendance failed", error);
    return new Response("Attendance could not be recorded", { status: 500, headers: cors });
  }
  // Activity status is presentation state, not part of the XP transaction.
  // A failure here must never cause the client to retry an already-awarded class.
  if (award?.awarded) {
    const now = new Date();
    const endTime = new Date(now);
    endTime.setUTCHours(end, 0, 0, 0);
    const { error: activityError } = await admin.from("profile_activity_statuses").insert({
      profile_id: enrollment.profile_id,
      activity_type: "university_class",
      status: "active",
      started_at: now.toISOString(),
      ends_at: endTime.toISOString(),
      metadata: {
        enrollment_id: enrollment.id,
        xp_earned: award.xp,
      },
    });
    if (activityError) console.error("University activity status update failed", activityError);
  }
  return new Response(JSON.stringify(award), { headers: { ...cors, "Content-Type": "application/json" } });
});
