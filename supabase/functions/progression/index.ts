import { serve } from "../_shared/deno/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import type { Database } from "../../../src/types/database-fallback.ts";
import { handleClaimDailyXp, handleSpendAttributeXp, handleSpendSkillXp } from "./handlers.ts";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type WalletRow = Database["public"]["Tables"]["player_xp_wallet"]["Row"] | null;
type AttributesRow = Database["public"]["Tables"]["player_attributes"]["Row"] | null;

type PointAvailability = {
  attribute_points_available: number;
  skill_points_available: number;
};

export interface ProfileState {
  profile: ProfileRow;
  wallet: WalletRow;
  attributes: AttributesRow;
  pointAvailability: PointAvailability;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sanitizeWeeklyBonusMetadata = (profile: ProfileRow): ProfileRow => ({
  ...profile,
  weekly_bonus_metadata: profile.weekly_bonus_metadata ?? {},
});

const calculatePointAvailability = (wallet: WalletRow, attributes: AttributesRow): PointAvailability => {
  const attributePointsEarned = wallet?.attribute_points_earned ?? 0;
  const attributePointsSpent = attributes?.attribute_points_spent ?? attributes?.attribute_points ?? 0;
  const skillPointsEarned = wallet?.skill_points_earned ?? 0;

  return {
    attribute_points_available: Math.max(0, attributePointsEarned - attributePointsSpent),
    skill_points_available: Math.max(0, skillPointsEarned),
  };
};

export const fetchProfileState = async (
  client: SupabaseClient<Database>,
  profileId: string,
): Promise<ProfileState> => {
  const profileResponse = await client
    .from("profiles")
    .select("*")
    .eq("id", profileId)
    .maybeSingle();

  if (profileResponse.error) {
    throw new Error(profileResponse.error.message ?? "Failed to fetch profile");
  }

  const profile = profileResponse.data;
  if (!profile) {
    throw new Error("Profile not found");
  }

  const walletResponse = await client
    .from("player_xp_wallet")
    .select("*")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (walletResponse.error && walletResponse.error.code !== "PGRST116") {
    throw new Error(walletResponse.error.message ?? "Failed to fetch XP wallet");
  }

  const attributesResponse = await client
    .from("player_attributes")
    .select("*")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (attributesResponse.error && attributesResponse.error.code !== "PGRST116") {
    throw new Error(attributesResponse.error.message ?? "Failed to fetch attributes");
  }

  const wallet = walletResponse.data ?? null;
  const attributes = attributesResponse.data ?? null;

  return {
    profile: sanitizeWeeklyBonusMetadata(profile),
    wallet,
    attributes,
    pointAvailability: calculatePointAvailability(wallet, attributes),
  };
};

export const loadActiveProfile = async (
  client: SupabaseClient<Database>,
  userId: string,
): Promise<ProfileState> => {
  const profileResponse = await client
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (profileResponse.error) {
    throw new Error(profileResponse.error.message ?? "Failed to load active profile");
  }

  const profile = profileResponse.data;
  if (!profile || !profile.id) {
    throw new Error("No profile found for user");
  }

  return await fetchProfileState(client, profile.id);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const client = createClient<Database>(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: { user }, error: userError } = await client.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const body = await req.json();
    const { action, ...params } = body;

    const profileState = await loadActiveProfile(client, user.id);
    let result: ProfileState;
    let actionResult: Record<string, unknown> = {};

    switch (action) {
      case "claim_daily_xp":
        result = await handleClaimDailyXp(client, user.id, profileState, params.metadata);
        break;

      case "spend_attribute_xp":
        result = await handleSpendAttributeXp(
          client,
          user.id,
          profileState,
          params.attribute_key,
          params.xp ?? 10,
          params.metadata,
        );
        break;

      case "spend_skill_xp": {
        const { state, skillProgress } = await handleSpendSkillXp(
          client,
          user.id,
          profileState,
          params.skill_slug,
          params.xp ?? 25,
          params.metadata,
        );
        result = state;
        actionResult = { skill_progress: skillProgress };
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        action,
        profile: result.profile,
        wallet: result.wallet,
        attributes: result.attributes,
        cooldowns: {},
        result: actionResult,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error in progression function:", error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({
        success: false,
        error: message,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
