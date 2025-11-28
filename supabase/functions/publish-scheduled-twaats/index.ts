import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Publishing scheduled twaats...');

    // Find twaats scheduled for now or earlier
    const { data: scheduledTwaats, error: fetchError } = await supabaseClient
      .from('twaats')
      .select('*')
      .not('scheduled_for', 'is', null)
      .lte('scheduled_for', new Date().toISOString())
      .is('deleted_at', null);

    if (fetchError) {
      console.error('Error fetching scheduled twaats:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${scheduledTwaats?.length || 0} scheduled twaats to publish`);

    if (!scheduledTwaats || scheduledTwaats.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          published: 0,
          message: 'No twaats ready to publish' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Publish each twaat by clearing scheduled_for
    const { error: updateError } = await supabaseClient
      .from('twaats')
      .update({ 
        scheduled_for: null,
        created_at: new Date().toISOString()
      })
      .in('id', scheduledTwaats.map(t => t.id));

    if (updateError) {
      console.error('Error publishing twaats:', updateError);
      throw updateError;
    }

    console.log(`Successfully published ${scheduledTwaats.length} twaats`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        published: scheduledTwaats.length,
        message: `Published ${scheduledTwaats.length} scheduled twaats`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in publish-scheduled-twaats:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});