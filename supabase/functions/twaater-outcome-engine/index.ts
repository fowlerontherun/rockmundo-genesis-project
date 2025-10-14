import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OutcomeCatalog {
  code: string;
  group: string;
  weight_base: number;
  description_template: string;
  effects: {
    likes_mult?: number;
    replies_add?: number;
    retwaats_add?: number;
    impressions_mult?: number;
    follower_pct?: number;
    sales_add?: number;
    rsvps_add?: number;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { twaat_id } = await req.json();

    if (!twaat_id) {
      throw new Error('twaat_id is required');
    }

    // Fetch the twaat
    const { data: twaat, error: twaatError } = await supabase
      .from('twaats')
      .select('*, account:twaater_accounts(*)')
      .eq('id', twaat_id)
      .single();

    if (twaatError) throw twaatError;

    // Fetch outcome catalog
    const { data: catalog, error: catalogError } = await supabase
      .from('twaater_outcome_catalog')
      .select('*');

    if (catalogError) throw catalogError;

    // Calculate context weights
    const fame = Number(twaat.account.fame_score) || 0;
    const isLinked = !!twaat.linked_type;
    const contentLength = twaat.body.length;

    const weights = catalog.map((outcome: OutcomeCatalog) => {
      let weight = outcome.weight_base;

      // Boost based on context
      if (isLinked && outcome.group === 'Commerce') {
        weight *= 2.0;
      }
      if (fame > 500 && outcome.group === 'Press') {
        weight *= 1.5;
      }
      if (contentLength > 200 && outcome.group === 'Engagement') {
        weight *= 1.3;
      }
      if (fame < 100 && outcome.group === 'Growth') {
        weight *= 1.5;
      }

      return { outcome, weight };
    });

    // Weighted random selection
    const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
    let random = Math.random() * totalWeight;
    let selectedOutcome: OutcomeCatalog | null = null;

    for (const { outcome, weight } of weights) {
      random -= weight;
      if (random <= 0) {
        selectedOutcome = outcome;
        break;
      }
    }

    if (!selectedOutcome) {
      selectedOutcome = catalog[0]; // Fallback
    }

    // Apply outcome effects
    const effects = selectedOutcome.effects;
    const baseMetrics = {
      likes: Math.floor(Math.random() * 10) + fame / 20,
      replies: Math.floor(Math.random() * 3),
      retwaats: Math.floor(Math.random() * 5),
      impressions: Math.floor(Math.random() * 50) + fame * 2,
      clicks: Math.floor(Math.random() * 10),
      rsvps: isLinked && twaat.linked_type === 'gig' ? Math.floor(Math.random() * 5) : 0,
      sales: isLinked && ['single', 'album'].includes(twaat.linked_type) ? Math.floor(Math.random() * 3) : 0,
    };

    // Apply multipliers
    const finalMetrics = {
      likes: Math.floor(baseMetrics.likes * (effects.likes_mult || 1)),
      replies: baseMetrics.replies + (effects.replies_add || 0),
      retwaats: baseMetrics.retwaats + (effects.retwaats_add || 0),
      impressions: Math.floor(baseMetrics.impressions * (effects.impressions_mult || 1)),
      clicks: baseMetrics.clicks,
      rsvps: baseMetrics.rsvps + (effects.rsvps_add || 0),
      sales: baseMetrics.sales + (effects.sales_add || 0),
    };

    // Update metrics
    const { error: metricsError } = await supabase
      .from('twaat_metrics')
      .update(finalMetrics)
      .eq('twaat_id', twaat_id);

    if (metricsError) throw metricsError;

    // Update outcome code
    const { error: outcomeError } = await supabase
      .from('twaats')
      .update({ outcome_code: selectedOutcome.code })
      .eq('id', twaat_id);

    if (outcomeError) throw outcomeError;

    // Update follower count if growth outcome
    if (effects.follower_pct) {
      const followerGain = Math.ceil(twaat.account.follower_count * (effects.follower_pct / 100));
      const { error: accountError } = await supabase
        .from('twaater_accounts')
        .update({
          follower_count: twaat.account.follower_count + followerGain
        })
        .eq('id', twaat.account_id);

      if (accountError) throw accountError;
    }

    console.log(`Outcome applied: ${selectedOutcome.code} for twaat ${twaat_id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        outcome: selectedOutcome.code,
        metrics: finalMetrics
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Outcome engine error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
