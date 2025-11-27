import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { gigIds } = await req.json();

    if (!gigIds || !Array.isArray(gigIds)) {
      throw new Error('gigIds array is required');
    }

    const results = [];

    for (const gigId of gigIds) {
      try {
        // Check if gig has a setlist
        const { data: gig } = await supabase
          .from('gigs')
          .select('setlist_id, band_id')
          .eq('id', gigId)
          .single();

        if (!gig) {
          results.push({ gigId, success: false, error: 'Gig not found' });
          continue;
        }

        if (!gig.setlist_id) {
          // Gig has no setlist - mark as cancelled
          await supabase
            .from('gigs')
            .update({ 
              status: 'cancelled',
              completed_at: new Date().toISOString()
            })
            .eq('id', gigId);

          results.push({ gigId, success: true, action: 'cancelled (no setlist)' });
        } else {
          // Force complete the stuck gig
          await supabase
            .from('gigs')
            .update({ 
              status: 'completed',
              completed_at: new Date().toISOString()
            })
            .eq('id', gigId);

          results.push({ gigId, success: true, action: 'completed' });
        }
      } catch (error: any) {
        results.push({ gigId, success: false, error: error.message });
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
