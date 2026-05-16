// Daily cron: auto-completes births, age progression, monthly costs, anniversary, scheduled weddings/honeymoons.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const now = new Date();
    const nowIso = now.toISOString();
    const summary: Record<string, number> = {};

    // 1. Auto-create system inbox for pending births
    const { data: births } = await supabase.from('child_requests')
      .select('id,parent_a_id,parent_b_id,gestation_ends_at,status,metadata')
      .eq('status', 'accepted')
      .lte('gestation_ends_at', nowIso)
      .limit(200);
    summary.births_ready = births?.length ?? 0;
    for (const b of births ?? []) {
      if ((b.metadata as any)?.birth_notified) continue;
      for (const pid of [b.parent_a_id, b.parent_b_id].filter(Boolean)) {
        await supabase.from('inbox_messages').insert({
          profile_id: pid,
          subject: '👶 Your child has arrived!',
          body: 'Open the Family page to name your newborn.',
          category: 'family',
          metadata: { profile_id: pid, child_request_id: b.id },
        }).catch(() => {});
      }
      await supabase.from('child_requests').update({
        metadata: { ...(b.metadata as any || {}), birth_notified: true },
      }).eq('id', b.id);
    }

    // 2. Trigger scheduled weddings
    const { data: weddings } = await supabase.from('weddings')
      .select('id,ceremony_at,status').eq('status', 'planned').lte('ceremony_at', nowIso).limit(50);
    summary.weddings_completed = 0;
    for (const w of weddings ?? []) {
      const res = await supabase.functions.invoke('complete-wedding', { body: { wedding_id: w.id } });
      if (!res.error) summary.weddings_completed++;
    }

    // 3. Trigger ended honeymoons
    const { data: hms } = await supabase.from('honeymoons')
      .select('id,ends_at,status').eq('status', 'active').lte('ends_at', nowIso).limit(50);
    summary.honeymoons_completed = 0;
    for (const h of hms ?? []) {
      const res = await supabase.functions.invoke('complete-honeymoon', { body: { honeymoon_id: h.id } });
      if (!res.error) summary.honeymoons_completed++;
    }
    // also: start scheduled honeymoons
    const { data: pendingHms } = await supabase.from('honeymoons')
      .select('id,starts_at,status').eq('status', 'planned').lte('starts_at', nowIso).limit(50);
    for (const h of pendingHms ?? []) {
      await supabase.from('honeymoons').update({ status: 'active' }).eq('id', h.id);
    }

    // 4. Anniversaries (yearly)
    const yearAgo = new Date(now.getTime() - 365 * 24 * 3600 * 1000).toISOString();
    const { data: anniversaries } = await supabase.from('marriages')
      .select('id,partner_a_id,partner_b_id,anniversary_count,last_anniversary_at')
      .eq('status', 'active')
      .lte('last_anniversary_at', yearAgo)
      .limit(100);
    summary.anniversaries = anniversaries?.length ?? 0;
    for (const m of anniversaries ?? []) {
      for (const pid of [m.partner_a_id, m.partner_b_id].filter(Boolean)) {
        await supabase.from('inbox_messages').insert({
          profile_id: pid,
          subject: '💍 Wedding Anniversary!',
          body: `Celebrating ${(m.anniversary_count ?? 0) + 1} year(s) of marriage. Consider a vow renewal!`,
          category: 'family',
          metadata: { profile_id: pid, marriage_id: m.id },
        }).catch(() => {});
      }
      await supabase.from('marriages').update({
        last_anniversary_at: nowIso,
        anniversary_count: (m.anniversary_count ?? 0) + 1,
      }).eq('id', m.id);
    }

    // 5. Child age progression - recompute current_age from birth_game_date, fire stage events
    const { data: children } = await supabase.from('player_children')
      .select('id,parent_a_id,parent_b_id,name,birth_game_date,current_age,school_stage,playability_state')
      .neq('playability_state', 'playable')
      .limit(500);
    summary.children_progressed = 0;
    // Game time: 1:4, epoch Jan 1 2026
    const epochMs = new Date('2026-01-01T00:00:00Z').getTime();
    const gameDaysSinceEpoch = Math.floor((now.getTime() - epochMs) / (24 * 3600 * 1000)) * 4;
    for (const c of children ?? []) {
      const birth = c.birth_game_date as any;
      let liveAge = 0;
      if (birth?.gameYear) {
        // birth was set with game year/month/day
        const gameYearNow = 2026 + Math.floor(gameDaysSinceEpoch / 120);
        liveAge = Math.max(0, gameYearNow - birth.gameYear);
      } else if (birth?.date) {
        const ageMs = now.getTime() - new Date(birth.date).getTime();
        // accelerated: 1 real day = 4 game days; 120 game days = 1 year
        const gameDays = (ageMs / (24 * 3600 * 1000)) * 4;
        liveAge = Math.floor(gameDays / 120);
      }
      const stage = liveAge >= 18 ? 'graduated'
        : liveAge >= 14 ? 'high' : liveAge >= 11 ? 'middle'
        : liveAge >= 6 ? 'primary' : liveAge >= 4 ? 'preschool'
        : liveAge >= 2 ? 'toddler' : 'infant';
      if (liveAge !== c.current_age || stage !== c.school_stage) {
        await supabase.from('player_children').update({
          current_age: liveAge,
          school_stage: stage,
          last_progressed_at: nowIso,
        }).eq('id', c.id);
        if (stage !== c.school_stage) {
          for (const pid of [c.parent_a_id, c.parent_b_id].filter(Boolean)) {
            await supabase.from('inbox_messages').insert({
              profile_id: pid,
              subject: `🎒 ${c.name} is now in ${stage}`,
              body: `Your child has entered the ${stage} stage at age ${liveAge}.`,
              category: 'family',
              metadata: { profile_id: pid, child_id: c.id, stage },
            }).catch(() => {});
          }
        }
        summary.children_progressed++;
      }
    }

    return new Response(JSON.stringify({ ok: true, ...summary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
