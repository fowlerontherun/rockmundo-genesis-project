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

  // Determine band tier
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
      advanceBase: 1000,
      advanceMax: 10000,
      artistRoyaltyBase: 12,
      artistRoyaltyMax: 20,
      singleQuota: 4,
      albumQuota: 1,
      termMonths: 36,
      terminationFeePct: 60,
    },
    medium: {
      advanceBase: 5000,
      advanceMax: 30000,
      artistRoyaltyBase: 18,
      artistRoyaltyMax: 30,
      singleQuota: 3,
      albumQuota: 1,
      termMonths: 30,
      terminationFeePct: 50,
    },
    large: {
      advanceBase: 20000,
      advanceMax: 100000,
      artistRoyaltyBase: 25,
      artistRoyaltyMax: 40,
      singleQuota: 2,
      albumQuota: 2,
      termMonths: 24,
      terminationFeePct: 40,
    },
    major: {
      advanceBase: 50000,
      advanceMax: 500000,
      artistRoyaltyBase: 35,
      artistRoyaltyMax: 50,
      singleQuota: 2,
      albumQuota: 1,
      termMonths: 18,
      terminationFeePct: 25,
    },
  };

  const config = tierConfig[tier];
  const randomFactor = 0.8 + Math.random() * 0.4;
  const fameMultiplier = 1 + (fame / 100) * 0.5;
  const fanMultiplier = 1 + Math.log10(Math.max(total_fans, 1)) * 0.1;
  const experienceMultiplier = 1 + Math.min(release_count * 0.05, 0.25);
  const labelFactor = 1 - labelReputation / 400;

  const advance = Math.round(
    config.advanceBase +
      (config.advanceMax - config.advanceBase) *
        fameMultiplier *
        fanMultiplier *
        (1 + qualityBonus) *
        randomFactor *
        labelFactor
  );

  const artistRoyalty = Math.round(
    config.artistRoyaltyBase +
      (config.artistRoyaltyMax - config.artistRoyaltyBase) *
        (fameMultiplier - 1) *
        experienceMultiplier *
        (1 + qualityBonus)
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
  const baseThreshold = 30 + labelReputation * 0.3;

  let score = songQuality;
  score += bandMetrics.fame * 0.5;
  score += Math.log10(Math.max(bandMetrics.total_fans, 1)) * 10;
  score += bandMetrics.release_count * 5;
  if (genreMatch) score += 15;
  score += (Math.random() - 0.5) * 20;

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

    // Fetch pending demos that haven't been reviewed
    const { data: pendingDemos, error: demosError } = await supabase
      .from("demo_submissions")
      .select(`
        id,
        song_id,
        label_id,
        band_id,
        artist_profile_id,
        submitted_at,
        songs(title, genre, quality_score),
        labels(id, name, genre_focus, reputation_score)
      `)
      .eq("status", "pending")
      .lt("submitted_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // At least 1 day old

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
        } else {
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
        }

        // Check genre match
        const labelGenres = label.genre_focus ?? [];
        const genreMatch = labelGenres.some((g: string) =>
          g.toLowerCase().includes(song.genre?.toLowerCase() ?? "")
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

          // Get a deal type for the contract
          const { data: dealType } = await supabase
            .from("label_deal_types")
            .select("id")
            .eq("label_id", label.id)
            .limit(1)
            .single();

          if (!dealType) {
            console.log(`No deal type found for label ${label.id}, skipping`);
            continue;
          }

          // Create contract offer
          const { data: contract, error: contractError } = await supabase
            .from("artist_label_contracts")
            .insert({
              label_id: label.id,
              deal_type_id: dealType.id,
              band_id: demo.band_id,
              artist_profile_id: demo.artist_profile_id,
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
          console.log(`Demo ${demo.id} accepted, contract ${contract.id} created`);
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
      JSON.stringify({
        success: true,
        processed,
        accepted,
        rejected,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in process-demo-review:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});