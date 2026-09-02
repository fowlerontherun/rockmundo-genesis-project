import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BAND_POSTING_ROLES = new Set(["leader", "founder", "co-leader", "co_leader", "manager"]);

const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return respond({ error: "Authentication required" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    const user = authData?.user;
    if (authError || !user) return respond({ error: "Invalid authentication" }, 401);

    const { account_id } = await req.json();
    if (!account_id || typeof account_id !== "string") return respond({ error: "account_id is required" }, 400);

    const { data: account, error: accountError } = await supabase
      .from("twaater_accounts")
      .select("id, owner_type, owner_id")
      .eq("id", account_id)
      .maybeSingle();
    if (accountError) throw accountError;
    if (!account) return respond({ error: "Twaater account not found" }, 404);

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id);
    if (profilesError) throw profilesError;
    const profileIds = (profiles || []).map((profile: any) => String(profile.id));

    let ownsAccount = false;
    if (account.owner_type === "persona") {
      ownsAccount = account.owner_id === user.id || profileIds.includes(String(account.owner_id));
    } else if (account.owner_type === "band") {
      const { data: band, error: bandError } = await supabase
        .from("bands")
        .select("leader_id")
        .eq("id", account.owner_id)
        .maybeSingle();
      if (bandError) throw bandError;
      const leaderId = band?.leader_id ? String(band.leader_id) : "";
      ownsAccount = leaderId === user.id || profileIds.includes(leaderId);

      if (!ownsAccount) {
        let membershipQuery = supabase
          .from("band_members")
          .select("role, is_touring_member")
          .eq("band_id", account.owner_id)
          .eq("member_status", "active");
        const ownershipTerms = [`user_id.eq.${user.id}`, ...profileIds.map((id) => `profile_id.eq.${id}`)];
        membershipQuery = membershipQuery.or(ownershipTerms.join(","));
        const { data: memberships, error: membershipError } = await membershipQuery;
        if (membershipError) throw membershipError;
        ownsAccount = (memberships || []).some((membership: any) =>
          !membership.is_touring_member && BAND_POSTING_ROLES.has(String(membership.role || "").toLowerCase()),
        );
      }
    }

    if (!ownsAccount) return respond({ error: "You cannot generate a feed for this account" }, 403);

    const [{ data: preferences }, { data: follows, error: followsError }, { data: blockRows, error: blocksError }] = await Promise.all([
      supabase.from("twaater_ai_preferences").select("*").eq("account_id", account_id).maybeSingle(),
      supabase.from("twaater_follows").select("followed_account_id, weight").eq("follower_account_id", account_id),
      supabase.from("twaater_blocks").select("blocker_account_id, blocked_account_id").or(`blocker_account_id.eq.${account_id},blocked_account_id.eq.${account_id}`),
    ]);
    if (followsError) throw followsError;
    if (blocksError) throw blocksError;

    const followedIds = follows?.map((follow: any) => follow.followed_account_id) || [];
    const permittedFollowerOnlyIds = new Set<string>([account_id, ...followedIds]);
    const blockedIds = new Set<string>();
    for (const row of blockRows || []) {
      if (row.blocker_account_id === account_id) blockedIds.add(row.blocked_account_id);
      if (row.blocked_account_id === account_id) blockedIds.add(row.blocker_account_id);
    }

    const { data: twaatsData, error: twaatsError } = await supabase
      .from("twaats")
      .select(`
        *,
        account:twaater_accounts!twaats_account_id_fkey(id, handle, display_name, verified, fame_score, owner_type),
        metrics:twaat_metrics(*),
        quoted_twaat:twaats!twaats_quoted_twaat_id_fkey(
          id,
          body,
          created_at,
          account:twaater_accounts!twaats_account_id_fkey(id, handle, display_name, verified, owner_type)
        )
      `)
      .in("visibility", ["public", "followers"])
      .is("deleted_at", null)
      .is("scheduled_for", null)
      .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(200);

    if (twaatsError) throw twaatsError;
    const twaats = (twaatsData || []).filter((twaat: any) => {
      if (blockedIds.has(twaat.account_id)) return false;
      return twaat.visibility === "public" || permittedFollowerOnlyIds.has(twaat.account_id);
    });
    if (twaats.length === 0) return respond({ ranked_feed: [] });

    const getMetrics = (metrics: any) => {
      if (Array.isArray(metrics) && metrics.length > 0) return metrics[0];
      return metrics || { likes: 0, replies: 0, retwaats: 0, impressions: 0 };
    };

    const twaatSummary = twaats.slice(0, 50).map((twaat: any) => {
      const metrics = getMetrics(twaat.metrics);
      return {
        id: twaat.id,
        is_followed: followedIds.includes(twaat.account_id),
        fame_score: twaat.account?.fame_score || 0,
        verified: twaat.account?.verified || false,
        engagement: (metrics.likes || 0) + (metrics.replies || 0) * 2 + (metrics.retwaats || 0) * 3,
        has_link: Boolean(twaat.linked_type),
        hours_old: (Date.now() - new Date(twaat.created_at).getTime()) / (1000 * 60 * 60),
      };
    });

    const runFallbackAlgorithm = () => [...twaats]
      .sort((a: any, b: any) => {
        const metricsA = getMetrics(a.metrics);
        const metricsB = getMetrics(b.metrics);
        const scoreA = (followedIds.includes(a.account_id) ? 100 : 0)
          + (metricsA.likes || 0)
          + (metricsA.replies || 0) * 2
          + (metricsA.retwaats || 0) * 3
          + (a.account?.verified ? 50 : 0);
        const scoreB = (followedIds.includes(b.account_id) ? 100 : 0)
          + (metricsB.likes || 0)
          + (metricsB.replies || 0) * 2
          + (metricsB.retwaats || 0) * 3
          + (b.account?.verified ? 50 : 0);
        return scoreB - scoreA;
      })
      .slice(0, 50);

    if (!lovableApiKey) return respond({ ranked_feed: runFallbackAlgorithm() });

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "Rank these social posts by relevance. Prioritise followed accounts, engagement, verification/fame, linked music content and recency. Return only a JSON array of post IDs.",
          },
          {
            role: "user",
            content: `User follows ${followedIds.length} accounts. Rank these posts: ${JSON.stringify(twaatSummary)}`,
          },
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) return respond({ ranked_feed: runFallbackAlgorithm() });

    let rankedIds: string[] = [];
    try {
      const aiData = await aiResponse.json();
      const content = aiData.choices?.[0]?.message?.content || "[]";
      const cleaned = content.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) rankedIds = parsed.filter((id) => typeof id === "string");
    } catch (parseError) {
      console.error("[twaater-ai-feed] AI response parse failed", parseError);
    }

    if (!rankedIds.length) return respond({ ranked_feed: runFallbackAlgorithm() });

    const twaatMap = new Map(twaats.map((twaat: any) => [twaat.id, twaat]));
    const rankedFeed = rankedIds
      .map((id) => twaatMap.get(id))
      .filter(Boolean)
      .slice(0, 50);

    if (rankedFeed.length < 10) {
      const existingIds = new Set(rankedFeed.map((twaat: any) => twaat.id));
      for (const twaat of runFallbackAlgorithm()) {
        if (!existingIds.has(twaat.id) && rankedFeed.length < 50) rankedFeed.push(twaat);
      }
    }

    if (preferences) {
      await supabase
        .from("twaater_ai_preferences")
        .update({
          interaction_history: {
            ...(preferences.interaction_history || {}),
            last_feed_generated: new Date().toISOString(),
          },
          last_updated: new Date().toISOString(),
        })
        .eq("account_id", account_id);
    }

    return respond({ ranked_feed: rankedFeed });
  } catch (error) {
    console.error("[twaater-ai-feed] error", error);
    return respond({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
