import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { calculateLiveSetup, isPerformanceCrewRole } from '../_shared/live-setup.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Authentication required');

    const token = authHeader.replace(/^Bearer\s+/i, '');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) throw new Error('Authentication required');

    const { gigId } = await req.json();
    if (!gigId) throw new Error('gigId is required');

    const { data: gig, error: gigError } = await supabase
      .from('gigs')
      .select('id,band_id,venues!gigs_venue_id_fkey(capacity)')
      .eq('id', gigId)
      .maybeSingle();

    if (gigError) throw gigError;
    if (!gig?.band_id) throw new Error('Gig not found');

    const { data: membership, error: membershipError } = await supabase
      .from('band_members')
      .select('id')
      .eq('band_id', gig.band_id)
      .eq('user_id', authData.user.id)
      .maybeSingle();

    if (membershipError) throw membershipError;
    if (!membership) throw new Error('You are not a member of this band');

    const [equipmentRes, crewRes] = await Promise.all([
      supabase
        .from('band_stage_equipment')
        .select('id,quality_rating')
        .eq('band_id', gig.band_id),
      supabase
        .from('band_crew_members')
        .select('id,crew_type,skill_level')
        .eq('band_id', gig.band_id),
    ]);

    if (equipmentRes.error) throw equipmentRes.error;
    if (crewRes.error) throw crewRes.error;

    const equipment = equipmentRes.data || [];
    const showCrew = (crewRes.data || []).filter((member) => isPerformanceCrewRole(member.crew_type));

    const equipmentQuality = equipment.length > 0
      ? equipment.reduce((sum, item) => sum + Number(item.quality_rating || 0), 0) / equipment.length
      : 40;

    const crewSkill = showCrew.length > 0
      ? showCrew.reduce((sum, member) => sum + Number(member.skill_level || 0), 0) / showCrew.length
      : 40;

    const venueCapacity = Number((gig.venues as { capacity?: number } | null)?.capacity || 0);
    const result = calculateLiveSetup({ equipmentQuality, crewSkill, venueCapacity });

    return new Response(
      JSON.stringify({
        ...result,
        equipmentCount: equipment.length,
        showCrewCount: showCrew.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not calculate Live Setup';
    const status = message === 'Authentication required' ? 401 : message.includes('not a member') ? 403 : 400;
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status },
    );
  }
});
