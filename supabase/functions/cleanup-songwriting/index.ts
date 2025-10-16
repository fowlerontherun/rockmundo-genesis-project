import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Call auto-complete function for expired sessions
    const { data: autoCompleteResult, error: autoCompleteError } = await supabase
      .rpc('auto_complete_songwriting_sessions')

    if (autoCompleteError) {
      console.error('Auto-complete error:', autoCompleteError)
      throw autoCompleteError
    }

    const completedSessions = autoCompleteResult?.[0]?.completed_sessions || 0
    const convertedProjects = autoCompleteResult?.[0]?.converted_projects || 0

    console.log(`Auto-completed ${completedSessions} sessions, converted ${convertedProjects} projects`)

    return new Response(
      JSON.stringify({ 
        success: true,
        completedSessions,
        convertedProjects
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
