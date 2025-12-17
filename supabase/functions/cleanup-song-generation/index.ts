import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('[cleanup-song-generation] Starting cleanup of timed out generations...')

    // Call the database function to cleanup timed out generations
    const { data: cleanedCount, error } = await supabase
      .rpc('cleanup_timed_out_generations')

    if (error) {
      console.error('[cleanup-song-generation] Error:', error)
      throw new Error(`Failed to cleanup generations: ${error.message}`)
    }

    console.log(`[cleanup-song-generation] Cleaned up ${cleanedCount || 0} timed out generations`)

    // Also find any songs stuck in 'generating' status for more than 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    
    const { data: stuckSongs, error: stuckError } = await supabase
      .from('songs')
      .update({ audio_generation_status: 'failed' })
      .eq('audio_generation_status', 'generating')
      .lt('audio_generation_started_at', tenMinutesAgo)
      .select('id, title')

    if (stuckError) {
      console.error('[cleanup-song-generation] Error cleaning stuck songs:', stuckError)
    } else if (stuckSongs && stuckSongs.length > 0) {
      console.log(`[cleanup-song-generation] Marked ${stuckSongs.length} stuck songs as failed`)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        timedOutAttempts: cleanedCount || 0,
        stuckSongs: stuckSongs?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[cleanup-song-generation] Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
