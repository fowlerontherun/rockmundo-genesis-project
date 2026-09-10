import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized: No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized: Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: role, error: roleError } = await supabase.rpc("get_user_role", {
      _user_id: user.id,
    });

    if (roleError || role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden: Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { gigIds } = await req.json();
    if (!Array.isArray(gigIds) || gigIds.length === 0) {
      return new Response(JSON.stringify({ error: "gigIds must be a non-empty array" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (gigIds.length > 50) {
      return new Response(JSON.stringify({ error: "Maximum 50 gigs can be processed at once" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (const id of gigIds) {
      if (typeof id !== "string" || !uuidRegex.test(id)) {
        return new Response(JSON.stringify({ error: `Invalid UUID format: ${id}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const results: Array<Record<string, unknown>> = [];

    for (const gigId of gigIds) {
      try {
        const { data: gig, error: gigError } = await supabase
          .from("gigs")
          .select("id,status,setlist_id,result_ready_at,completed_at,completion_claimed_at")
          .eq("id", gigId)
          .single();

        if (gigError || !gig) {
          results.push({ gigId, success: false, error: gigError?.message || "Gig not found" });
          continue;
        }

        if (!gig.setlist_id) {
          const { error: cancelError } = await supabase
            .from("gigs")
            .update({ status: "cancelled", completed_at: null, result_ready_at: null })
            .eq("id", gigId);

          results.push(
            cancelError
              ? { gigId, success: false, error: cancelError.message }
              : { gigId, success: true, newStatus: "cancelled", reason: "Gig has no setlist" },
          );
          continue;
        }

        const { data: outcome, error: outcomeError } = await supabase
          .from("gig_outcomes")
          .select("id,completed_at")
          .eq("gig_id", gigId)
          .maybeSingle();

        if (outcomeError || !outcome) {
          results.push({
            gigId,
            success: false,
            error: outcomeError?.message || "Gig outcome is missing; cannot safely reconstruct results",
          });
          continue;
        }

        if (gig.status === "completed" && gig.result_ready_at) {
          results.push({ gigId, success: true, newStatus: "completed", alreadyCompleted: true });
          continue;
        }

        // Older versions of this recovery tool could mark a gig completed without
        // running the canonical result engine. Put only those incomplete result
        // rows back into a repairable state; never rewrite a valid completed gig.
        if (gig.status === "completed" && !gig.result_ready_at && !outcome.completed_at) {
          const { error: resetError } = await supabase
            .from("gigs")
            .update({
              status: "in_progress",
              completed_at: null,
              result_ready_at: null,
              completion_claimed_at: null,
              completion_attempt_count: 0,
              completion_last_error: null,
              completion_next_retry_at: null,
              completion_needs_attention: false,
            })
            .eq("id", gigId);

          if (resetError) {
            results.push({ gigId, success: false, error: resetError.message });
            continue;
          }
        } else if (!["in_progress", "ready_for_completion", "processing_outcome"].includes(gig.status)) {
          results.push({
            gigId,
            success: false,
            error: `Gig status ${gig.status} is not eligible for completion repair`,
          });
          continue;
        }

        // Clear a stale claim so the canonical completion function can take a new
        // transactional claim. complete-gig itself still enforces elapsed setlist
        // duration and idempotency, so this cannot fast-forward a live show.
        await supabase
          .from("gigs")
          .update({ completion_claimed_at: null })
          .eq("id", gigId)
          .is("result_ready_at", null);

        const idempotencyKey = `admin-stuck-gig-repair:${gigId}:${Date.now()}`;
        const { data: completion, error: completionError } = await supabase.functions.invoke("complete-gig", {
          body: { gigId, idempotencyKey },
        });

        if (completionError || completion?.error) {
          results.push({
            gigId,
            success: false,
            error: completion?.error || completionError?.message || "Canonical gig completion failed",
          });
          continue;
        }

        const { data: repairedGig } = await supabase
          .from("gigs")
          .select("status,result_ready_at,completed_at")
          .eq("id", gigId)
          .single();

        results.push({
          gigId,
          success: repairedGig?.status === "completed" && Boolean(repairedGig?.result_ready_at),
          newStatus: repairedGig?.status,
          resultReadyAt: repairedGig?.result_ready_at,
          completion,
        });
      } catch (error) {
        results.push({
          gigId,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    console.log("Fix stuck gigs completed by admin:", user.id, "Results:", results);

    return new Response(JSON.stringify({ success: results.every((r) => r.success), results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: results.some((r) => r.success) ? 200 : 500,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
