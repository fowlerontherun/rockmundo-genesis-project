import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface TokenRow {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  volume_24h: number;
  market_cap: number;
  price_history: { timestamp: string; price: number }[];
  volatility_tier: string;
  trend_direction: number;
  is_active: boolean;
  is_rugged: boolean;
}

// Volatility ranges by tier (max % swing per tick)
const VOLATILITY: Record<string, number> = {
  micro: 0.15,
  mid: 0.08,
  large: 0.04,
  blue_chip: 0.02,
};

// Rug pull chance per tick by tier
const RUG_CHANCE: Record<string, number> = {
  micro: 0.02,
  mid: 0.005,
  large: 0,
  blue_chip: 0,
};

const DOWNWARD_DRIFT = -0.005; // -0.5% average drift
const MOMENTUM_FACTOR = 0.3;
const MOMENTUM_DECAY = 0.7;
const MAX_HISTORY = 100;

// Underworld-themed token name parts for replacements
const PREFIXES = [
  "Shadow", "Dark", "Neon", "Ghost", "Void", "Cursed", "Lost", "Fallen",
  "Hollow", "Grim", "Silent", "Toxic", "Buried", "Shattered", "Burning",
  "Wicked", "Rotten", "Feral", "Phantom", "Twisted",
];
const SUFFIXES = [
  "Coin", "Token", "Chain", "Pulse", "Wire", "Node", "Link", "Vault",
  "Shard", "Flux", "Core", "Drop", "Dust", "Mark", "Byte",
  "Swap", "Stake", "Pool", "Key", "Gem",
];

function generateReplacementToken() {
  const prefix = PREFIXES[Math.floor(Math.random() * PREFIXES.length)];
  const suffix = SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)];
  const name = `${prefix} ${suffix}`;
  const symbol = (prefix.slice(0, 2) + suffix.slice(0, 1)).toUpperCase() +
    Math.floor(Math.random() * 99).toString();
  const price = Math.random() < 0.7
    ? +(Math.random() * 0.5 + 0.001).toFixed(4) // mostly cheap
    : +(Math.random() * 5 + 0.5).toFixed(2);
  const volume = Math.floor(Math.random() * 200000 + 5000);
  const marketCap = Math.floor(price * (Math.random() * 2000000 + 10000));
  const now = new Date().toISOString();

  return {
    symbol,
    name,
    description: `Freshly minted from the Underworld depths.`,
    current_price: price,
    volume_24h: volume,
    market_cap: marketCap,
    volatility_tier: "micro",
    trend_direction: 0,
    is_active: true,
    is_rugged: false,
    price_history: [{ timestamp: now, price }],
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get all active tokens
    const { data: tokens, error: fetchError } = await supabase
      .from("crypto_tokens")
      .select("*")
      .eq("is_active", true)
      .eq("is_rugged", false);

    if (fetchError) throw fetchError;
    if (!tokens || tokens.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active tokens" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get recent transactions (last 10 minutes) for player impact
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: recentTx } = await supabase
      .from("token_transactions")
      .select("token_id, transaction_type, quantity, total_amount")
      .gte("created_at", tenMinutesAgo);

    // Calculate net player pressure per token
    const playerPressure: Record<string, number> = {};
    if (recentTx) {
      for (const tx of recentTx) {
        const dir = tx.transaction_type === "buy" ? 1 : -1;
        playerPressure[tx.token_id] =
          (playerPressure[tx.token_id] || 0) + dir * tx.total_amount;
      }
    }

    const ruggedTokens: string[] = [];
    const replacements: any[] = [];
    const now = new Date().toISOString();

    for (const token of tokens as TokenRow[]) {
      const tier = token.volatility_tier || "mid";
      const maxSwing = VOLATILITY[tier] || 0.08;

      // 1. Check for rug pull
      const rugChance = RUG_CHANCE[tier] || 0;
      if (rugChance > 0 && Math.random() < rugChance) {
        // RUG PULL!
        await supabase
          .from("crypto_tokens")
          .update({
            current_price: 0,
            volume_24h: 0,
            is_rugged: true,
            is_active: false,
            trend_direction: 0,
            price_history: [
              ...((token.price_history || []) as any[]).slice(-MAX_HISTORY + 1),
              { timestamp: now, price: 0 },
            ],
            updated_at: now,
          })
          .eq("id", token.id);

        ruggedTokens.push(token.symbol);

        // Generate replacement
        const replacement = generateReplacementToken();
        const { error: insertError } = await supabase
          .from("crypto_tokens")
          .insert(replacement);
        if (!insertError) {
          replacements.push(replacement.symbol);
        }
        continue;
      }

      // 2. Calculate price change
      const baseVolatility = (Math.random() * 2 - 1) * maxSwing;
      const drift = DOWNWARD_DRIFT;

      // Player pressure impact (capped at +/-5%)
      const pressure = playerPressure[token.id] || 0;
      const mcap = token.market_cap || 1;
      const playerImpact = Math.max(-0.05, Math.min(0.05, pressure / mcap));

      // Momentum
      const prevTrend = token.trend_direction || 0;
      const rawTrend = prevTrend * MOMENTUM_DECAY + baseVolatility;
      const newTrend = Math.max(-1, Math.min(1, rawTrend));
      const momentumEffect = newTrend * MOMENTUM_FACTOR * maxSwing;

      // Combined change
      const totalChange = baseVolatility + drift + playerImpact + momentumEffect;
      const newPrice = Math.max(0.0001, token.current_price * (1 + totalChange));

      // Simulate volume based on price movement
      const absChange = Math.abs(totalChange);
      const volumeMultiplier = 0.5 + Math.random() + absChange * 10;
      const newVolume = Math.max(
        1000,
        Math.floor((token.volume_24h || 50000) * volumeMultiplier * (0.8 + Math.random() * 0.4))
      );

      // Update market cap proportionally
      const priceRatio = newPrice / (token.current_price || 1);
      const newMarketCap = Math.max(1000, Math.floor((token.market_cap || 100000) * priceRatio));

      // Append to price history
      const history = [
        ...((token.price_history || []) as any[]).slice(-(MAX_HISTORY - 1)),
        { timestamp: now, price: +newPrice.toFixed(6) },
      ];

      await supabase
        .from("crypto_tokens")
        .update({
          current_price: +newPrice.toFixed(6),
          volume_24h: newVolume,
          market_cap: newMarketCap,
          trend_direction: +newTrend.toFixed(4),
          price_history: history,
          updated_at: now,
        })
        .eq("id", token.id);
    }

    // Log rug events to activity_feed for notifications
    if (ruggedTokens.length > 0) {
      // We'll insert a system-level notification that the frontend can pick up
      for (const symbol of ruggedTokens) {
        await supabase.from("activity_feed").insert({
          user_id: "00000000-0000-0000-0000-000000000000",
          activity_type: "crypto_rug_pull",
          message: `💀 ${symbol} has been RUGGED! Price dropped to $0.00`,
          metadata: { symbol, event: "rug_pull" },
        });
      }
    }

    return new Response(
      JSON.stringify({
        processed: tokens.length,
        rugged: ruggedTokens,
        replacements,
        timestamp: now,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
