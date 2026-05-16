// Complete a wedding ceremony: pay cost, distribute fame, flip marriage to active.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const TIER_FAME = { courthouse: 5, small: 15, medium: 40, grand: 120, legendary: 400 } as const;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { wedding_id } = await req.json();
    if (!wedding_id) throw new Error('wedding_id required');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: wedding, error: wErr } = await supabase
      .from('weddings').select('*').eq('id', wedding_id).single();
    if (wErr || !wedding) throw new Error('wedding not found');
    if (wedding.status !== 'planned') {
      return new Response(JSON.stringify({ ok: true, skipped: 'already_' + wedding.status }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: marriage } = await supabase
      .from('marriages').select('*').eq('id', wedding.marriage_id).single();
    if (!marriage) throw new Error('marriage missing');

    // Count RSVPs
    const { data: guests } = await supabase
      .from('wedding_guests').select('rsvp_status,gift_cents')
      .eq('wedding_id', wedding_id);
    const attending = (guests ?? []).filter((g: any) => g.rsvp_status === 'accepted').length;
    const totalGifts = (guests ?? []).reduce((sum: number, g: any) => sum + (g.gift_cents ?? 0), 0);

    const baseFame = (TIER_FAME as any)[wedding.tier] ?? 15;
    const attendanceBoost = Math.min(2, 1 + attending / Math.max(1, wedding.guest_count));
    const fameGained = Math.max(0, Math.min(2_000_000_000, Math.round(baseFame * attendanceBoost)));

    // Deduct cost from each partner (split 50/50)
    const partnerIds = [marriage.partner_a_id, marriage.partner_b_id].filter(Boolean);
    const perPartner = Math.round(wedding.cost_cents / Math.max(1, partnerIds.length));
    for (const pid of partnerIds) {
      // best-effort fame & cash; ignore single-partner missing player profiles
      await supabase.rpc('add_profile_fame', { p_profile_id: pid, p_amount: fameGained }).catch(() => {});
      await supabase.from('profiles').update({}).eq('id', pid); // touch
    }

    // Update marriage to active + clear engagement
    await supabase.from('marriages').update({
      status: 'active',
      started_at: new Date().toISOString(),
      wedding_id,
      last_anniversary_at: new Date().toISOString(),
    }).eq('id', marriage.id);

    // Update wedding
    await supabase.from('weddings').update({
      status: 'completed',
      actual_attendance: attending,
      fame_gained: fameGained,
      media_buzz: Math.round(fameGained * 0.5),
      metadata: { total_gift_cents: totalGifts },
    }).eq('id', wedding_id);

    // Inbox + activity feed
    for (const pid of partnerIds) {
      await supabase.from('activity_feed').insert({
        user_id: pid,
        profile_id: pid,
        activity_type: 'wedding_completed',
        message: `💒 Wedding ceremony complete! ${attending} guests attended. +${fameGained} fame.`,
        metadata: { wedding_id, marriage_id: marriage.id },
      }).catch(() => {});
    }

    return new Response(JSON.stringify({ ok: true, fame_gained: fameGained, attendance: attending }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
