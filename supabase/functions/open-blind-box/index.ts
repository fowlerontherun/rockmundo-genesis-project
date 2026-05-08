import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Tier = "common" | "rare" | "epic" | "legendary";

const TIER_REWARDS: Record<Tier, { xp: [number, number]; ap: number; quality: [number, number] }> = {
  common: { xp: [200, 300], ap: 1, quality: [30, 55] },
  rare: { xp: [400, 600], ap: 2, quality: [50, 70] },
  epic: { xp: [1000, 1400], ap: 4, quality: [70, 88] },
  legendary: { xp: [2500, 3500], ap: 8, quality: [85, 100] },
};

const rand = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

function rollTier(odds: Record<string, number>, forceEpicPlus: boolean): Tier {
  if (forceEpicPlus) {
    return Math.random() < 0.85 ? "epic" : "legendary";
  }
  const total = Object.values(odds).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const t of ["common", "rare", "epic", "legendary"] as Tier[]) {
    r -= odds[t] ?? 0;
    if (r <= 0) return t;
  }
  return "common";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userRes } = await userClient.auth.getUser();
    const user = userRes.user;
    if (!user) throw new Error("Not authenticated");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { boxId } = await req.json();
    if (!boxId) throw new Error("boxId required");

    const { data: box, error: boxErr } = await admin
      .from("blind_boxes").select("*").eq("id", boxId).maybeSingle();
    if (boxErr || !box) throw new Error("Box not found");
    if (!box.active) throw new Error("This box is not currently available");

    const now = Date.now();
    if (box.available_from && new Date(box.available_from).getTime() > now)
      throw new Error("This box is not yet available");
    if (box.available_until && new Date(box.available_until).getTime() < now)
      throw new Error("This box is no longer available");

    // Active profile
    const { data: profile, error: profErr } = await admin
      .from("profiles").select("*")
      .eq("user_id", user.id).eq("is_active", true).is("died_at", null)
      .maybeSingle();
    if (profErr || !profile) throw new Error("No active character");

    const isPremium = box.currency === "premium";
    const price = isPremium ? box.price_premium : box.price_cash;
    const balance = isPremium
      ? (profile.premium_tokens ?? 0)
      : (profile.cash ?? 0);
    if (balance < price) {
      return new Response(
        JSON.stringify({
          error: "INSUFFICIENT_FUNDS",
          message: isPremium
            ? `You need ${price} premium tokens (you have ${balance}).`
            : `You need $${price.toLocaleString()} (you have $${balance.toLocaleString()}).`,
        }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Charge
    const debitField = isPremium ? "premium_tokens" : "cash";
    const { error: chargeErr } = await admin
      .from("profiles")
      .update({ [debitField]: balance - price })
      .eq("id", profile.id);
    if (chargeErr) throw new Error(`Charge failed: ${chargeErr.message}`);

    // Pity
    const { data: pity } = await admin
      .from("blind_box_pity").select("*")
      .eq("profile_id", profile.id).eq("box_id", box.id).maybeSingle();
    const opensSinceEpic = pity?.opens_since_epic ?? 0;
    const forceEpic = opensSinceEpic + 1 >= (box.pity_threshold ?? 20);

    const tier = rollTier(box.tier_odds as Record<string, number>, forceEpic);
    const r = TIER_REWARDS[tier];
    const xp = rand(r.xp[0], r.xp[1]);
    const ap = r.ap;
    const skillSlug = (box.skill_slugs as string[])[
      rand(0, (box.skill_slugs as string[]).length - 1)
    ];
    const instrument = (box.instrument_pool as Array<{ name: string; type: string }>)[
      rand(0, (box.instrument_pool as unknown[]).length - 1)
    ];
    const songTitle = (box.song_title_pool as string[])[
      rand(0, (box.song_title_pool as string[]).length - 1)
    ];
    const quality = rand(r.quality[0], r.quality[1]);

    // Duplicate detection — same box + same instrument name previously unboxed
    const { data: priorOpenings } = await admin
      .from("blind_box_openings")
      .select("id, reward_summary")
      .eq("profile_id", profile.id)
      .eq("box_id", box.id);
    const dupeCount = (priorOpenings ?? []).filter(
      (p: any) => (p.reward_summary?.instrument ?? "").toLowerCase() === instrument.name.toLowerCase(),
    ).length;
    const isDuplicate = dupeCount > 0;

    // Duplicate scaling: rebate XP, rebate AP (ceil/2), and grant shards
    const tierMultiplier: Record<Tier, number> = { common: 1, rare: 2, epic: 4, legendary: 8 };
    const dupeXp = isDuplicate ? Math.round(xp * 0.5) : xp;
    const dupeAp = isDuplicate ? Math.max(1, Math.ceil(ap / 2)) : ap;
    const shardCount = isDuplicate ? tierMultiplier[tier] * (1 + Math.min(3, dupeCount)) : 0;

    // XP ledger / wallet
    await admin.from("experience_ledger").insert({
      user_id: user.id, profile_id: profile.id,
      activity_type: isDuplicate ? "blind_box_duplicate" : "blind_box",
      xp_amount: dupeXp, skill_slug: skillSlug,
      metadata: { box_slug: box.slug, tier, duplicate: isDuplicate, dupe_count: dupeCount },
    });
    const { data: wallet } = await admin
      .from("player_xp_wallet").select("*")
      .eq("profile_id", profile.id).maybeSingle();
    if (wallet) {
      await admin.from("player_xp_wallet").update({
        xp_balance: (wallet.xp_balance ?? 0) + dupeXp,
        lifetime_xp: (wallet.lifetime_xp ?? 0) + dupeXp,
        skill_xp_balance: (wallet.skill_xp_balance ?? 0) + dupeXp,
      }).eq("profile_id", profile.id);
    }

    // AP grant
    const { data: attrs } = await admin
      .from("player_attributes").select("attribute_points")
      .eq("profile_id", profile.id).maybeSingle();
    if (attrs) {
      await admin.from("player_attributes")
        .update({ attribute_points: (attrs.attribute_points ?? 0) + dupeAp })
        .eq("profile_id", profile.id);
    }

    // Instrument: only mint if this is NOT a duplicate
    let gear: any = null;
    if (!isDuplicate) {
      const ins = await admin.from("player_personal_gear").insert({
        user_id: user.id,
        gear_type: instrument.type,
        gear_name: `${instrument.name} (${box.name})`,
        quality_rating: quality,
        condition_rating: 100,
        purchase_cost: Math.round(price),
        stat_boosts: { theme: box.theme_genre, tier },
        notes: `Unboxed from ${box.name} — ${tier.toUpperCase()} tier`,
      }).select().single();
      gear = ins.data;
    }

    // Duplicate -> award crafting materials (shards) of matching rarity tier
    const dupeMaterials: Array<{ name: string; quantity: number; rarity: string }> = [];
    if (isDuplicate && shardCount > 0) {
      const rarityForTier: Record<Tier, string[]> = {
        common: ["common"],
        rare: ["common", "uncommon"],
        epic: ["uncommon", "rare"],
        legendary: ["rare", "legendary"],
      };
      const { data: materials } = await admin
        .from("crafting_materials")
        .select("id, name, rarity")
        .in("rarity", rarityForTier[tier]);
      if (materials && materials.length > 0) {
        const pick = materials[rand(0, materials.length - 1)];
        // upsert quantity
        const { data: existing } = await admin
          .from("player_crafting_materials")
          .select("id, quantity")
          .eq("profile_id", profile.id)
          .eq("material_id", pick.id)
          .maybeSingle();
        if (existing) {
          await admin.from("player_crafting_materials")
            .update({ quantity: (existing.quantity ?? 0) + shardCount })
            .eq("id", existing.id);
        } else {
          await admin.from("player_crafting_materials").insert({
            profile_id: profile.id,
            material_id: pick.id,
            quantity: shardCount,
          });
        }
        dupeMaterials.push({ name: pick.name, quantity: shardCount, rarity: pick.rarity });
      }
    }

    // Song — duplicates skip song generation as well to avoid catalog spam
    let song: any = null;
    if (!isDuplicate) {
      const ins = await admin.from("songs").insert({
        user_id: user.id,
        profile_id: profile.id,
        title: `${songTitle}`,
        genre: box.theme_genre,
        status: "completed",
        quality_score: quality,
        song_rating: quality,
        melody_strength: quality,
        lyrics_strength: quality,
        rhythm_strength: quality,
        arrangement_strength: quality,
        production_potential: quality,
        music_progress: 1000,
        lyrics_progress: 1000,
        catalog_status: "owned",
        ownership_type: "solo",
        completed_at: new Date().toISOString(),
      }).select().single();
      song = ins.data;
    }

    // Ledger + pity update
    await admin.from("blind_box_openings").insert({
      user_id: user.id, profile_id: profile.id, box_id: box.id,
      tier, xp_awarded: dupeXp, ap_awarded: dupeAp, skill_slug: skillSlug,
      instrument_id: gear?.id ?? null, song_id: song?.id ?? null,
      price_paid: price, currency: box.currency,
      reward_summary: {
        instrument: instrument.name,
        song: songTitle,
        quality,
        duplicate: isDuplicate,
        dupe_count: dupeCount,
        materials: dupeMaterials,
      },
    });

    const newPity = (tier === "epic" || tier === "legendary") ? 0 : opensSinceEpic + 1;
    await admin.from("blind_box_pity").upsert({
      profile_id: profile.id, box_id: box.id,
      opens_since_epic: newPity,
      total_opens: (pity?.total_opens ?? 0) + 1,
      updated_at: new Date().toISOString(),
    }, { onConflict: "profile_id,box_id" });

    return new Response(JSON.stringify({
      success: true,
      tier, xp: dupeXp, ap: dupeAp, skill_slug: skillSlug,
      instrument: { ...instrument, quality, id: gear?.id ?? null },
      song: { id: song?.id ?? null, title: songTitle, quality, genre: box.theme_genre },
      new_balance: balance - price,
      currency: box.currency,
      duplicate: isDuplicate,
      dupe_count: dupeCount,
      base_xp: xp,
      base_ap: ap,
      materials: dupeMaterials,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[open-blind-box]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
