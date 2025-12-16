import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GrantVipRequest {
  userId: string;
  months: number;
  message?: string;
  subscriptionType?: "gifted" | "trial" | "paid";
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify JWT and get user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile?.is_admin) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body: GrantVipRequest = await req.json();
    const { userId, months, message, subscriptionType = "gifted" } = body;

    if (!userId || !months) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: userId, months" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate dates
    const startsAt = new Date();
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + months);

    // Check for existing active subscription
    const { data: existingSub } = await supabase
      .from("vip_subscriptions")
      .select("id, expires_at")
      .eq("user_id", userId)
      .eq("status", "active")
      .gte("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingSub) {
      // Extend existing subscription
      const newExpiresAt = new Date(existingSub.expires_at);
      newExpiresAt.setMonth(newExpiresAt.getMonth() + months);

      const { error: updateError } = await supabase
        .from("vip_subscriptions")
        .update({
          expires_at: newExpiresAt.toISOString(),
          gift_message: message || null,
        })
        .eq("id", existingSub.id);

      if (updateError) {
        console.error("Error extending subscription:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to extend subscription" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Extended VIP subscription for user ${userId} to ${newExpiresAt.toISOString()}`);

      return new Response(
        JSON.stringify({
          success: true,
          message: "VIP subscription extended",
          expiresAt: newExpiresAt.toISOString(),
          extended: true,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create new subscription
    const { data: newSub, error: insertError } = await supabase
      .from("vip_subscriptions")
      .insert({
        user_id: userId,
        status: "active",
        subscription_type: subscriptionType,
        starts_at: startsAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        gifted_by_admin_id: user.id,
        gift_message: message || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating subscription:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create subscription" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Created VIP subscription for user ${userId}, expires ${expiresAt.toISOString()}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "VIP subscription granted",
        subscription: newSub,
        extended: false,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Grant VIP error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
