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

    // ============ AUTHENTICATION CHECK ============
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Unauthorized: No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the JWT token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Invalid token:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============ ADMIN ROLE CHECK ============
    const { data: role, error: roleError } = await supabase.rpc('get_user_role', { _user_id: user.id });
    
    if (roleError || role !== 'admin') {
      console.error('Admin access denied for user:', user.id, 'Role:', role);
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Admin action authorized for user:', user.id);

    // ============ INPUT VALIDATION ============
    const { gigIds } = await req.json();

    if (!Array.isArray(gigIds) || gigIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'gigIds must be a non-empty array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate UUID format for all IDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (const id of gigIds) {
      if (typeof id !== 'string' || !uuidRegex.test(id)) {
        return new Response(
          JSON.stringify({ error: `Invalid UUID format: ${id}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Limit batch size to prevent abuse
    if (gigIds.length > 50) {
      return new Response(
        JSON.stringify({ error: 'Maximum 50 gigs can be processed at once' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============ EXECUTE ADMIN ACTION ============
    const results = [];

    for (const gigId of gigIds) {
      try {
        // Get gig details
        const { data: gig, error: gigError } = await supabase
          .from('gigs')
          .select('id, setlist_id, band_id, status')
          .eq('id', gigId)
          .single();

        if (gigError || !gig) {
          results.push({ gigId, success: false, error: gigError?.message || 'Gig not found' });
          continue;
        }

        // Determine new status based on setlist existence
        let newStatus = 'completed';
        if (!gig.setlist_id) {
          newStatus = 'cancelled';
        }

        // Update the gig
        const { error: updateError } = await supabase
          .from('gigs')
          .update({ 
            status: newStatus,
            completed_at: newStatus === 'completed' ? new Date().toISOString() : null
          })
          .eq('id', gigId);

        if (updateError) {
          results.push({ gigId, success: false, error: updateError.message });
        } else {
          results.push({ gigId, success: true, newStatus });
        }
      } catch (error: any) {
        results.push({ gigId, success: false, error: error.message });
      }
    }

    console.log('Fix stuck gigs completed by admin:', user.id, 'Results:', results.length);

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
