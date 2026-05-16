// Complete a honeymoon: refill health/energy, bump romance, mark anniversary.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const TIER_BOND = { budget: 10, standard: 25, luxury: 50, world_tour: 100 } as const;
const TIER_HEALTH = { budget: 15, standard: 25, luxury: 40, world_tour: 50 } as const;
const TIER_FAME = { budget: 2, standard: 8, luxury: 25, world_tour: 80 } as const;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { honeymoon_id } = await req.json();
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: hm } = await supabase.from('honeymoons').select('*').eq('id', honeymoon_id).single();
    if (!hm) throw new Error('honeymoon not found');
    if (hm.status === 'completed') {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: marriage } = await supabase.from('marriages').select('*').eq('id', hm.marriage_id).single();
    if (!marriage) throw new Error('marriage missing');

    const tier = hm.package_tier as keyof typeof TIER_BOND;
    const bond = (TIER_BOND[tier] ?? 25);
    const health = (TIER_HEALTH[tier] ?? 25);
    const fame = (TIER_FAME[tier] ?? 8);

    const partnerIds = [marriage.partner_a_id, marriage.partner_b_id].filter(Boolean);
    for (const pid of partnerIds) {
      await supabase.from('profile_attributes').update({
        physical_endurance: 100,
      }).eq('profile_id', pid).catch(() => {});
      await supabase.rpc('add_profile_fame', { p_profile_id: pid, p_amount: fame }).catch(() => {});
    }

    // Bump romance scores
    await supabase.from('character_relationships')
      .update({
        affection_score: 100,
        loyalty_score: 100,
        attraction_score: 100,
      })
      .or(`and(entity_a_id.eq.${marriage.partner_a_id},entity_b_id.eq.${marriage.partner_b_id}),and(entity_a_id.eq.${marriage.partner_b_id},entity_b_id.eq.${marriage.partner_a_id})`)
      .catch(() => {});

    await supabase.from('honeymoons').update({
      status: 'completed',
      bond_gained: bond,
      health_gained: health,
      fame_gained: fame,
    }).eq('id', honeymoon_id);

    await supabase.from('marriages').update({
      honeymoon_id,
      last_anniversary_at: new Date().toISOString(),
    }).eq('id', marriage.id);

    for (const pid of partnerIds) {
      await supabase.from('activity_feed').insert({
        user_id: pid, profile_id: pid,
        activity_type: 'honeymoon_completed',
        message: `🏝️ Honeymoon complete! +${fame} fame, +${health} health, +${bond} bond.`,
        metadata: { honeymoon_id, marriage_id: marriage.id },
      }).catch(() => {});
    }

    return new Response(JSON.stringify({ ok: true, bond, health, fame }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
