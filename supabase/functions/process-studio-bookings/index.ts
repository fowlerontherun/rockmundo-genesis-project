import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper: get company owner's band reputation
async function getCompanyOwnerReputation(supabase: any, companyId: string): Promise<{ bandId: string | null; repScore: number }> {
  try {
    const { data: company } = await supabase
      .from('companies')
      .select('owner_id')
      .eq('id', companyId)
      .single();
    if (!company?.owner_id) return { bandId: null, repScore: 0 };

    const { data: member } = await supabase
      .from('band_members')
      .select('band_id, bands(id, reputation_score, morale)')
      .eq('user_id', company.owner_id)
      .eq('role', 'leader')
      .limit(1)
      .single();
    if (member?.bands) {
      return { bandId: member.band_id, repScore: member.bands.reputation_score ?? 0 };
    }
  } catch (_e) { /* no band */ }
  return { bandId: null, repScore: 0 };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('[process-studio-bookings] Starting studio booking processing...');

  try {
    const now = new Date().toISOString();
    let processedCount = 0;
    let totalRevenue = 0;

    // Cache reputation lookups per company
    const repCache: Record<string, { bandId: string | null; repScore: number }> = {};

    // Process completed recording sessions at company-owned studios
    const { data: recordingSessions } = await supabase
      .from('recording_sessions')
      .select(`
        id,
        studio_id,
        total_cost,
        status,
        city_studios!inner(
          id,
          name,
          company_id,
          is_company_owned
        )
      `)
      .eq('status', 'completed')
      .eq('city_studios.is_company_owned', true)
      .not('city_studios.company_id', 'is', null);

    for (const session of recordingSessions || []) {
      const studio = session.city_studios as any;
      if (!studio?.company_id) continue;

      const { data: existingTx } = await supabase
        .from('company_transactions')
        .select('id')
        .eq('metadata->recording_session_id', session.id)
        .single();

      if (existingTx) continue;

      // Get reputation modifier for this studio's company owner
      if (!repCache[studio.company_id]) {
        repCache[studio.company_id] = await getCompanyOwnerReputation(supabase, studio.company_id);
      }
      const { bandId, repScore } = repCache[studio.company_id];
      // Revenue scaling: 0.9x (toxic) → 1.1x (iconic)
      const repMod = parseFloat((0.9 + ((repScore + 100) / 200) * 0.2).toFixed(3));

      const baseRevenue = session.total_cost || 0;
      const sessionRevenue = Math.round(baseRevenue * repMod);
      
      if (sessionRevenue > 0) {
        const { data: company } = await supabase
          .from('companies')
          .select('balance')
          .eq('id', studio.company_id)
          .single();

        const newBalance = (company?.balance || 0) + sessionRevenue;

        await supabase
          .from('companies')
          .update({ 
            balance: newBalance,
            updated_at: now
          })
          .eq('id', studio.company_id);

        await supabase
          .from('company_transactions')
          .insert({
            company_id: studio.company_id,
            transaction_type: 'income',
            amount: sessionRevenue,
            description: `Recording session at ${studio.name}`,
            category: 'studio_income',
            metadata: { recording_session_id: session.id, reputation_modifier: repMod }
          });

        // Update studio stats
        await supabase
          .from('city_studios')
          .update({ 
            total_revenue: (studio.total_revenue || 0) + sessionRevenue,
            sessions_completed: (studio.sessions_completed || 0) + 1
          })
          .eq('id', studio.id);

        // Award +1 morale for successful studio revenue
        if (bandId) {
          const { data: band } = await supabase
            .from('bands')
            .select('morale')
            .eq('id', bandId)
            .single();
          if (band) {
            const newMorale = Math.min(100, (band.morale ?? 50) + 1);
            await supabase.from('bands').update({ morale: newMorale }).eq('id', bandId);
          }
        }

        processedCount++;
        totalRevenue += sessionRevenue;

        console.log(`[process-studio-bookings] Recording ${session.id}: $${sessionRevenue} (repMod ${repMod})`);
      }
    }

    // Process completed rehearsals at company-owned rooms
    const { data: rehearsals } = await supabase
      .from('band_rehearsals')
      .select(`
        id,
        rehearsal_room_id,
        total_cost,
        status,
        rehearsal_rooms!inner(
          id,
          name,
          company_id,
          is_company_owned
        )
      `)
      .eq('status', 'completed')
      .eq('rehearsal_rooms.is_company_owned', true)
      .not('rehearsal_rooms.company_id', 'is', null);

    for (const rehearsal of rehearsals || []) {
      const room = rehearsal.rehearsal_rooms as any;
      if (!room?.company_id) continue;

      const { data: existingTx } = await supabase
        .from('company_transactions')
        .select('id')
        .eq('metadata->rehearsal_id', rehearsal.id)
        .single();

      if (existingTx) continue;

      // Get reputation modifier
      if (!repCache[room.company_id]) {
        repCache[room.company_id] = await getCompanyOwnerReputation(supabase, room.company_id);
      }
      const { bandId: rBandId, repScore: rRepScore } = repCache[room.company_id];
      const rehearsalRepMod = parseFloat((0.9 + ((rRepScore + 100) / 200) * 0.2).toFixed(3));

      const baseRehearsal = rehearsal.total_cost || 0;
      const rehearsalRevenue = Math.round(baseRehearsal * rehearsalRepMod);
      
      if (rehearsalRevenue > 0) {
        const { data: company } = await supabase
          .from('companies')
          .select('balance')
          .eq('id', room.company_id)
          .single();

        const newBalance = (company?.balance || 0) + rehearsalRevenue;

        await supabase
          .from('companies')
          .update({ 
            balance: newBalance,
            updated_at: now
          })
          .eq('id', room.company_id);

        await supabase
          .from('company_transactions')
          .insert({
            company_id: room.company_id,
            transaction_type: 'income',
            amount: rehearsalRevenue,
            description: `Rehearsal booking at ${room.name}`,
            category: 'rehearsal_income',
            metadata: { rehearsal_id: rehearsal.id, reputation_modifier: rehearsalRepMod }
          });

        // Update room stats
        await supabase
          .from('rehearsal_rooms')
          .update({ 
            total_revenue: (room.total_revenue || 0) + rehearsalRevenue,
            sessions_completed: (room.sessions_completed || 0) + 1
          })
          .eq('id', room.id);

        // Award +1 morale for rehearsal revenue
        if (rBandId) {
          const { data: band } = await supabase
            .from('bands')
            .select('morale')
            .eq('id', rBandId)
            .single();
          if (band) {
            const newMorale = Math.min(100, (band.morale ?? 50) + 1);
            await supabase.from('bands').update({ morale: newMorale }).eq('id', rBandId);
          }
        }

        processedCount++;
        totalRevenue += rehearsalRevenue;

        console.log(`[process-studio-bookings] Rehearsal ${rehearsal.id}: $${rehearsalRevenue} (repMod ${rehearsalRepMod})`);
      }
    }

    console.log(`[process-studio-bookings] Complete: ${processedCount} sessions, $${totalRevenue.toFixed(2)} revenue`);

    return new Response(JSON.stringify({
      success: true,
      processed: processedCount,
      totalRevenue
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[process-studio-bookings] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
