import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const base64UrlEncode = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");

const base64UrlDecode = (value: string) => {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
};

const getStateSecret = () => {
  const secret = Deno.env.get("DISCORD_STATE_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret) throw new Error("Discord state signing secret is not configured");
  return secret;
};

const sign = async (payload: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getStateSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return base64UrlEncode(new Uint8Array(signature));
};

const createState = async (userId: string) => {
  const payload = base64UrlEncode(
    encoder.encode(JSON.stringify({ user_id: userId, exp: Date.now() + 10 * 60 * 1000 })),
  );
  return `${payload}.${await sign(payload)}`;
};

const readState = async (state: string) => {
  const [payload, suppliedSignature] = state.split(".");
  if (!payload || !suppliedSignature) throw new Error("Invalid Discord verification state");

  const expectedSignature = await sign(payload);
  if (expectedSignature.length !== suppliedSignature.length) throw new Error("Invalid Discord verification state");

  let mismatch = 0;
  for (let i = 0; i < expectedSignature.length; i += 1) {
    mismatch |= expectedSignature.charCodeAt(i) ^ suppliedSignature.charCodeAt(i);
  }
  if (mismatch !== 0) throw new Error("Invalid Discord verification state");

  const parsed = JSON.parse(decoder.decode(base64UrlDecode(payload))) as { user_id?: string; exp?: number };
  if (!parsed.user_id || !parsed.exp || parsed.exp < Date.now()) throw new Error("Discord verification state expired");
  return parsed;
};

const redirect = (siteUrl: string, status: string) =>
  new Response(null, {
    status: 302,
    headers: { Location: `${siteUrl.replace(/\/$/, "")}/social/rewards?discord=${encodeURIComponent(status)}` },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const discordClientId = Deno.env.get("DISCORD_CLIENT_ID");
  const discordClientSecret = Deno.env.get("DISCORD_CLIENT_SECRET");
  const discordGuildId = Deno.env.get("DISCORD_GUILD_ID");
  const siteUrl = Deno.env.get("PUBLIC_SITE_URL") || "https://rockmundo-genesis-project.lovable.app";
  const redirectUri = Deno.env.get("DISCORD_REDIRECT_URI") || `${supabaseUrl}/functions/v1/discord-community-auth`;

  if (!discordClientId || !discordClientSecret || !discordGuildId) {
    return new Response(JSON.stringify({ error: "Discord verification is not configured yet" }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const isCallback = req.method === "GET" && url.searchParams.has("code");

  try {
    if (!isCallback) {
      if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Authentication required" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const token = authHeader.slice("Bearer ".length);
      const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
      const { data, error } = await authClient.auth.getUser(token);
      if (error || !data.user) {
        return new Response(JSON.stringify({ error: "Authentication required" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const state = await createState(data.user.id);
      const authorizeUrl = new URL("https://discord.com/oauth2/authorize");
      authorizeUrl.searchParams.set("client_id", discordClientId);
      authorizeUrl.searchParams.set("response_type", "code");
      authorizeUrl.searchParams.set("redirect_uri", redirectUri);
      authorizeUrl.searchParams.set("scope", "identify guilds.members.read");
      authorizeUrl.searchParams.set("state", state);

      return new Response(JSON.stringify({ url: authorizeUrl.toString() }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const state = url.searchParams.get("state") ?? "";
    const code = url.searchParams.get("code") ?? "";
    const parsedState = await readState(state);

    const tokenBody = new URLSearchParams({
      client_id: discordClientId,
      client_secret: discordClientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    });

    const tokenResponse = await fetch("https://discord.com/api/v10/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody,
    });
    if (!tokenResponse.ok) return redirect(siteUrl, "oauth_failed");

    const tokenData = await tokenResponse.json() as { access_token?: string };
    if (!tokenData.access_token) return redirect(siteUrl, "oauth_failed");

    const [identityResponse, memberResponse] = await Promise.all([
      fetch("https://discord.com/api/v10/users/@me", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      }),
      fetch(`https://discord.com/api/v10/users/@me/guilds/${discordGuildId}/member`, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      }),
    ]);

    if (memberResponse.status === 404 || memberResponse.status === 403) return redirect(siteUrl, "not_member");
    if (!memberResponse.ok || !identityResponse.ok) return redirect(siteUrl, "verification_failed");

    const identity = await identityResponse.json() as { id?: string; username?: string };
    const member = await memberResponse.json() as { joined_at?: string; pending?: boolean };
    if (!identity.id) return redirect(siteUrl, "verification_failed");

    const adminClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { error: markError } = await adminClient.rpc("mark_community_verified", {
      p_user_id: parsedState.user_id,
      p_platform: "discord",
      p_external_account_id: identity.id,
      p_metadata: {
        username: identity.username ?? null,
        joined_at: member.joined_at ?? null,
        pending: member.pending ?? false,
      },
    });

    if (markError) {
      console.error("[DISCORD-VERIFY] mark verification failed", markError);
      return redirect(siteUrl, markError.code === "23505" ? "already_linked" : "verification_failed");
    }

    return redirect(siteUrl, "verified");
  } catch (error) {
    console.error("[DISCORD-VERIFY]", error);
    if (isCallback) return redirect(siteUrl, "verification_failed");
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Verification failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
