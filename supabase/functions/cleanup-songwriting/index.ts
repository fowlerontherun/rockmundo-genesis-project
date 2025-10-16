import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Auto-unlock expired projects
    const now = new Date().toISOString()
    const { data: expiredProjects, error: fetchError } = await supabase
      .from('songwriting_projects')
      .select('id, title')
      .eq('is_locked', true)
      .lt('locked_until', now)

    if (fetchError) throw fetchError

    if (expiredProjects && expiredProjects.length > 0) {
      const { error: unlockError } = await supabase
        .from('songwriting_projects')
        .update({ 
          is_locked: false, 
          locked_until: null 
        })
        .in('id', expiredProjects.map(p => p.id))

      if (unlockError) throw unlockError

      console.log(`Unlocked ${expiredProjects.length} expired projects`)
    }

    // Clean up abandoned sessions (older than 24 hours, no session_end)
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: abandonedSessions, error: sessionFetchError } = await supabase
      .from('songwriting_sessions')
      .select('id')
      .is('session_end', null)
      .lt('session_start', cutoff)

    if (sessionFetchError) throw sessionFetchError

    if (abandonedSessions && abandonedSessions.length > 0) {
      const { error: cleanupError } = await supabase
        .from('songwriting_sessions')
        .update({
          session_end: supabase.rpc('now'),
          completed_at: supabase.rpc('now'),
          notes: 'Auto-completed (abandoned session)'
        })
        .in('id', abandonedSessions.map(s => s.id))

      if (cleanupError) throw cleanupError

      console.log(`Cleaned up ${abandonedSessions.length} abandoned sessions`)
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        unlockedProjects: expiredProjects?.length || 0,
        cleanedSessions: abandonedSessions?.length || 0
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Cleanup error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
