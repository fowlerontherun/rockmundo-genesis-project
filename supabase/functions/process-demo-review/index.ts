import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BandMetrics {
  fame: number;
  total_fans: number;
  release_count: number;
}

function generateContractTerms(
  metrics: BandMetrics,
  labelReputation: number,
  songQuality: number
) {
  const { fame, total_fans, release_count } = metrics;

  let tier: "small" | "medium" | "large" | "major";
  if (total_fans >= 50000 || fame >= 80) {
    tier = "major";
  } else if (total_fans >= 10000 || fame >= 50) {
    tier = "large";
  } else if (total_fans >= 1000 || fame >= 20) {
    tier = "medium";
  } else {
    tier = "small";
  }

  const qualityBonus = Math.min(songQuality / 500, 0.2);

  const tierConfig = {
    small: {
      advanceBase: 1000, advanceMax: 10000,
      artistRoyaltyBase: 12, artistRoyaltyMax: 20,
      singleQuota: 4, albumQuota: 1, termMonths: 36, terminationFeePct: 60,
    },
    medium: {
      advanceBase: 5000, advanceMax: 30000,
      artistRoyaltyBase: 18, artistRoyaltyMax: 30,
      singleQuota: 3, albumQuota: 1, termMonths: 30, terminationFeePct: 50,
    },
    large: {
      advanceBase: 20000, advanceMax: 100000,
      artistRoyaltyBase: 25, artistRoyaltyMax: 40,
      singleQuota: 2, albumQuota: 2, termMonths: 24, terminationFeePct: 40,
    },
    major: {
      advanceBase: 50000, advanceMax: 500000,
      artistRoyaltyBase: 35, artistRoyaltyMax: 50,
      singleQuota: 2, albumQuota: 1, termMonths: 18, terminationFeePct: 25,
    },
  };

  const config = tierConfig[tier];
  const randomFactor = 0.8 + Math.random() * 0.4;
  const fameMultiplier = 1 + (fame / 100) * 0.5;
  const fanMultiplier = 1 + Math.log10(Math.max(total_fans, 1)) * 0.1;
  const experienceMultiplier = 1 + Math.min(release_count * 0.05, 0.25);
  const labelFactor = 1 - labelReputation / 400;

  const rawAdvance = Math.round(
    config.advanceBase +
      (config.advanceMax - config.advanceBase) *
        fameMultiplier * fanMultiplier * (1 + qualityBonus) * randomFactor * labelFactor
  );
  // Cap advance to max for the tier to prevent integer overflow
  const advance = Math.min(rawAdvance, config.advanceMax * 2);

  const artistRoyalty = Math.round(
    config.artistRoyaltyBase +
      (config.artistRoyaltyMax - config.artistRoyaltyBase) *
        (fameMultiplier - 1) * experienceMultiplier * (1 + qualityBonus)
  );

  const clampedArtistRoyalty = Math.min(
    Math.max(artistRoyalty, config.artistRoyaltyBase),
    config.artistRoyaltyMax
  );

  const terminationFee = Math.round(
    config.terminationFeePct * (1 - qualityBonus * 0.5) * (2 - fameMultiplier)
  );
  const clampedTerminationFee = Math.min(Math.max(terminationFee, 15), 70);

  const territoryOptions = ["NA", "EU", "UK", "ASIA", "LATAM", "OCEANIA"];
  const territoryCoverage =
    tier === "major" ? 6 : tier === "large" ? 4 : tier === "medium" ? 2 : 1;
  const territories = territoryOptions.slice(0, territoryCoverage);

  const contractValue =
    advance + config.singleQuota * 5000 + config.albumQuota * 25000;

  return {
    advance_amount: advance,
    royalty_artist_pct: clampedArtistRoyalty,
    royalty_label_pct: 100 - clampedArtistRoyalty,
    single_quota: config.singleQuota,
    album_quota: config.albumQuota,
    term_months: config.termMonths,
    termination_fee_pct: clampedTerminationFee,
    manufacturing_covered: true,
    territories,
    contract_value: contractValue,
  };
}

function shouldAcceptDemo(
  songQuality: number,
  bandMetrics: BandMetrics,
  labelReputation: number,
  genreMatch: boolean
): { accepted: boolean; reason?: string } {
  // Lower base threshold so more demos get accepted
  const baseThreshold = 20 + labelReputation * 0.2;

  let score = songQuality;
  score += bandMetrics.fame * 0.5;
  score += Math.log10(Math.max(bandMetrics.total_fans, 1)) * 10;
  score += bandMetrics.release_count * 5;
  if (genreMatch) score += 20;
  // Add randomness that skews positive
  score += (Math.random() * 30) - 10;

  if (score >= baseThreshold) {
    return { accepted: true };
  }

  const reasons = [
    "We're not currently looking for artists in this genre.",
    "Your sound doesn't quite fit our roster at this time.",
    "We loved the demo but our A&R schedule is full.",
    "Keep working on your craft and resubmit in a few months.",
    "Great potential, but we need to see more streaming numbers first.",
  ];

  return {
    accepted: false,
    reason: reasons[Math.floor(Math.random() * reasons.length)],
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Processing pending demo submissions...");

    // Fetch a global deal type (they are not label-specific)
    const { data: globalDealType } = await supabase
      .from("label_deal_types")
      .select("id")
      .limit(1)
      .single();

    if (!globalDealType) {
      console.error("No deal types found in system");
      return new Response(
        JSON.stringify({ error: "No deal types configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch pending demos - process after 2 hours (not 24h, so players see results sooner)
    const { data: pendingDemos, error: demosError } = await supabase
      .from("demo_submissions")
      .select(`
        id, song_id, label_id, band_id, artist_profile_id, submitted_at,
        songs(title, genre, quality_score),
        labels(id, name, genre_focus, reputation_score, owner_id, is_bankrupt)
      `)
      .eq("status", "pending")
      .lt("submitted_at", new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
      .limit(50);

    if (demosError) {
      console.error("Error fetching demos:", demosError);
      throw demosError;
    }

    console.log(`Found ${pendingDemos?.length ?? 0} demos to process`);

    let processed = 0;
    let accepted = 0;
    let rejected = 0;

    for (const demo of pendingDemos ?? []) {
      try {
        const song = demo.songs as any;
        const label = demo.labels as any;

        if (!song || !label) {
          console.log(`Skipping demo ${demo.id} - missing song or label`);
          continue;
        }

        // Skip player-owned labels (they review manually)
        if (label.owner_id) {
          console.log(`Skipping demo ${demo.id} - player-owned label`);
          continue;
        }

        // Skip bankrupt labels
        if (label.is_bankrupt) {
          console.log(`Skipping demo ${demo.id} - bankrupt label`);
          continue;
        }

        // Get band/artist metrics
        let metrics: BandMetrics;
        if (demo.band_id) {
          const { data: band } = await supabase
            .from("bands")
            .select("fame, total_fans")
            .eq("id", demo.band_id)
            .single();

          const { count: releaseCount } = await supabase
            .from("releases")
            .select("*", { count: "exact", head: true })
            .eq("band_id", demo.band_id)
            .eq("release_status", "released");

          metrics = {
            fame: band?.fame ?? 0,
            total_fans: band?.total_fans ?? 0,
            release_count: releaseCount ?? 0,
          };
        } else if (demo.artist_profile_id) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("fame, fans")
            .eq("id", demo.artist_profile_id)
            .single();

          const { count: releaseCount } = await supabase
            .from("releases")
            .select("*", { count: "exact", head: true })
            .eq("user_id", demo.artist_profile_id)
            .eq("release_status", "released");

          metrics = {
            fame: profile?.fame ?? 0,
            total_fans: profile?.fans ?? 0,
            release_count: releaseCount ?? 0,
          };
        } else {
          console.log(`Skipping demo ${demo.id} - no band_id or artist_profile_id`);
          continue;
        }

        // Check genre match
        const labelGenres = label.genre_focus ?? [];
        const songGenre = song.genre?.toLowerCase() ?? "";
        const genreMatch = labelGenres.some((g: string) =>
          g.toLowerCase().includes(songGenre) || songGenre.includes(g.toLowerCase())
        );

        // Decide if accepted
        const decision = shouldAcceptDemo(
          song.quality_score ?? 0,
          metrics,
          label.reputation_score ?? 0,
          genreMatch
        );

        if (decision.accepted) {
          // Generate contract terms
          const terms = generateContractTerms(
            metrics,
            label.reputation_score ?? 0,
            song.quality_score ?? 0
          );

          const startDate = new Date();
          const endDate = new Date();
          endDate.setMonth(endDate.getMonth() + terms.term_months);

          // Create contract offer
          const { data: contract, error: contractError } = await supabase
            .from("artist_label_contracts")
            .insert({
              label_id: label.id,
              deal_type_id: globalDealType.id,
              band_id: demo.band_id || null,
              artist_profile_id: demo.artist_profile_id || null,
              status: "offered",
              advance_amount: terms.advance_amount,
              royalty_artist_pct: terms.royalty_artist_pct,
              royalty_label_pct: terms.royalty_label_pct,
              single_quota: terms.single_quota,
              album_quota: terms.album_quota,
              termination_fee_pct: terms.termination_fee_pct,
              manufacturing_covered: terms.manufacturing_covered,
              territories: terms.territories,
              contract_value: terms.contract_value,
              demo_submission_id: demo.id,
              release_quota: terms.single_quota + terms.album_quota,
              start_date: startDate.toISOString(),
              end_date: endDate.toISOString(),
            })
            .select()
            .single();

          if (contractError) {
            console.error(`Error creating contract for demo ${demo.id}:`, contractError);
            continue;
          }

          // Update demo status
          await supabase
            .from("demo_submissions")
            .update({
              status: "accepted",
              reviewed_at: new Date().toISOString(),
              contract_offer_id: contract.id,
            })
            .eq("id", demo.id);

          accepted++;
          console.log(`Demo ${demo.id} accepted, contract ${contract.id} created for ${song.title}`);
        } else {
          // Reject demo
          await supabase
            .from("demo_submissions")
            .update({
              status: "rejected",
              reviewed_at: new Date().toISOString(),
              rejection_reason: decision.reason,
            })
            .eq("id", demo.id);

          rejected++;
          console.log(`Demo ${demo.id} rejected: ${decision.reason}`);
        }

        processed++;
      } catch (demoError) {
        console.error(`Error processing demo ${demo.id}:`, demoError);
      }
    }

    console.log(`Processed ${processed} demos: ${accepted} accepted, ${rejected} rejected`);

    return new Response(
      JSON.stringify({ success: true, processed, accepted, rejected }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in process-demo-review:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
