import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

type Action = "reserve" | "cancel" | "start" | "settle" | "missed" | "mix_event";
type Input = {
  action?: Action;
  profileId?: string;
  clubId?: string;
  setlistId?: string;
  startsAt?: string;
  requestId?: string;
  bookingId?: string;
  kind?: "deck_play" | "crossfade" | "tempo";
  deck?: "A" | "B";
  source?: "game" | "admin";
  trackId?: string;
  value?: number;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return json({ error: "DJ booking service is not configured" }, 503);

  const jwt = /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") ?? "")?.[1] ?? "";
  if (!jwt) return json({ error: "Sign in to manage your DJ bookings" }, 401);

  // Never treat the client request's profileId or userId as an authenticated
  // identity. Resolve a real user from the received JWT on every request.
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auth, error: authError } = await admin.auth.getUser(jwt);
  if (authError || !auth.user) return json({ error: "Please sign in again" }, 401);

  // The feature flag defaults CLOSED on the server, including if env is absent.
  // The client UI flag alone is never an authorization or availability gate.
  const enabled = Deno.env.get("DJ_SCHEDULED_BOOKINGS_ENABLED") === "true";

  let body: Input;
  try {
    if (Number(req.headers.get("content-length") || 0) > 4096) throw new Error("Large input");
    body = await req.json() as Input;
  } catch {
    return json({ error: "Invalid DJ booking request" }, 400);
  }

  const action = body?.action;
  if (!action || !["reserve", "cancel", "start", "settle", "missed", "mix_event"].includes(action)) {
    return json({ error: "Unknown DJ booking action" }, 400);
  }

  // Cancellation can remain available to already booked players when future
  // booking is switched off. Everything else stays locked until launch.
  if (!enabled && action !== "cancel") {
    return json({ error: "Scheduled DJ booking is not yet available" }, 503);
  }

  if (action === "reserve") {
    if (!body.profileId || !uuid.test(body.profileId) ||
        !body.clubId || !uuid.test(body.clubId) ||
        !body.setlistId || !uuid.test(body.setlistId) ||
        !body.requestId || !uuid.test(body.requestId) ||
        !body.startsAt || !Number.isFinite(Date.parse(body.startsAt))) {
      return json({ error: "Choose a valid club, saved DJ set and booking time" }, 400);
    }
  } else if (!body.bookingId || !uuid.test(body.bookingId)) {
    return json({ error: "Valid DJ booking ID required" }, 400);
  }

  if (action === "mix_event") {
    const kind = body.kind;
    const valid =
      (kind === "deck_play" && ["A", "B"].includes(body.deck ?? "") &&
        ["game", "admin"].includes(body.source ?? "") &&
        typeof body.trackId === "string" && uuid.test(body.trackId) &&
        body.value === undefined) ||
      (kind === "crossfade" && body.deck === undefined &&
        body.source === undefined && body.trackId === undefined &&
        typeof body.value === "number" && Number.isFinite(body.value) &&
        body.value >= 0 && body.value <= 100) ||
      (kind === "tempo" && ["A", "B"].includes(body.deck ?? "") &&
        body.source === undefined && body.trackId === undefined &&
        typeof body.value === "number" && Number.isFinite(body.value) &&
        body.value >= 85 && body.value <= 115);
    if (!valid) return json({ error: "Invalid live DJ mixer interaction" }, 400);
    try {
      const { data, error } = await admin.rpc("dj_verified_mix_event_service", {
        p_actor_user_id: auth.user.id,
        p_booking_id: body.bookingId,
        p_kind: kind,
        p_deck: body.deck ?? null,
        p_source: body.source ?? null,
        p_track_id: body.trackId ?? null,
        p_value: body.value ?? null,
      });
      if (error) {
        const expected = ["23P01", "22023", "42501"].includes(error.code || "");
        return json({ error: expected ? error.message : "Unable to log DJ interaction" },
          expected ? 409 : 500);
      }
      return typeof data === "string" && uuid.test(data)
        ? json({ id: data, action })
        : json({ error: "DJ mixer returned an invalid response" }, 500);
    } catch {
      return json({ error: "DJ mixer service failed" }, 500);
    }
  }

  const params = {
    p_actor_user_id: auth.user.id, // JWT-verified server identity ONLY
    p_action: action,
    p_profile_id: action === "reserve" ? body.profileId : null,
    p_club_id: action === "reserve" ? body.clubId : null,
    p_setlist_id: action === "reserve" ? body.setlistId : null,
    p_starts_at: action === "reserve" ? new Date(body.startsAt!).toISOString() : null,
    p_request_id: action === "reserve" ? body.requestId : null,
    p_booking_id: action === "reserve" ? null : body.bookingId,
  };

  try {
    const { data, error } = await admin.rpc("dj_verified_player_action_service", params);
    if (error) {
      // Offer normal player-facing scheduling feedback but do not disclose SQL
      // internals, private table names, source and function details.
      const expected = ["23P01", "22023", "42501", "23505"].includes(error.code || "");
      return json({
        error: expected ? error.message : "Unable to process this DJ booking",
      }, expected ? 409 : 500);
    }
    if (typeof data !== "string" || !uuid.test(data)) {
      return json({ error: "DJ booking returned an invalid response" }, 500);
    }
    return json({ id: data, action });
  } catch {
    return json({ error: "DJ booking service failed" }, 500);
  }
});
