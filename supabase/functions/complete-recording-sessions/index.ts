import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log(`=== Recording Session Auto-Completion Started at ${new Date().toISOString()} ===`)

    // Find recording sessions that have passed their scheduled end time
    const { data: sessions, error: sessionsError } = await supabase
      .from('recording_sessions')
      .select('*')
      .eq('status', 'in_progress')
      .lt('scheduled_end', new Date().toISOString())

    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError)
      throw sessionsError
    }

    console.log(`Found ${sessions?.length || 0} recording sessions to auto-complete`)

    let completedCount = 0

    for (const session of sessions || []) {
      try {
        console.log(`Processing recording session ${session.id}`)

        // Calculate duration in hours
        const startTime = new Date(session.scheduled_start)
        const endTime = new Date(session.scheduled_end)
        const durationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)

        // Calculate quality based on session parameters
        const baseQuality = session.base_quality || 50
        const producerBonus = session.producer_bonus || 0
        const equipmentBonus = session.equipment_bonus || 0
        const finalQuality = Math.min(100, baseQuality + producerBonus + equipmentBonus)

        // Calculate XP (10-20 XP per hour, modified by quality)
        const baseXpPerHour = 15
        const qualityMultiplier = finalQuality / 50 // 2x at max quality
        const xpEarned = Math.floor(baseXpPerHour * durationHours * qualityMultiplier)

        console.log(`Quality: ${finalQuality}, XP: ${xpEarned}`)

        // Update session to completed
        const { error: updateError } = await supabase
          .from('recording_sessions')
          .update({
            status: 'completed',
            actual_end: new Date().toISOString(),
            final_quality: finalQuality,
            xp_earned: xpEarned,
            notes: session.notes ? `${session.notes}\n\nAuto-completed: Quality ${finalQuality}/100, earned ${xpEarned} XP` : `Auto-completed: Quality ${finalQuality}/100, earned ${xpEarned} XP`,
            updated_at: new Date().toISOString()
          })
          .eq('id', session.id)

        if (updateError) {
          console.error(`Error updating session ${session.id}:`, updateError)
          continue
        }

        // Update the recorded song with final quality
        if (session.song_id) {
          await supabase
            .from('songs')
            .update({
              quality_score: finalQuality,
              updated_at: new Date().toISOString()
            })
            .eq('id', session.song_id)
        }

        // Award XP to participants (band members or solo artist)
        if (session.band_id) {
          const { data: bandMembers } = await supabase
            .from('band_members')
            .select('profile_id')
            .eq('band_id', session.band_id)
            .eq('status', 'active')

          if (bandMembers) {
            for (const member of bandMembers) {
              // Update XP wallet
              await supabase
                .from('player_xp_wallet')
                .upsert({
                  profile_id: member.profile_id,
                  xp_balance: supabase.rpc('increment', { x: xpEarned }),
                  updated_at: new Date().toISOString()
                }, { onConflict: 'profile_id' })

              // Log to experience ledger
              await supabase
                .from('experience_ledger')
                .insert({
                  profile_id: member.profile_id,
                  user_id: member.profile_id, // Assuming profile_id = user_id for now
                  activity_type: 'recording',
                  xp_amount: xpEarned,
                  metadata: {
                    session_id: session.id,
                    song_id: session.song_id,
                    final_quality: finalQuality,
                    auto_completed: true
                  }
                })
            }
          }
        } else if (session.user_id) {
          // Solo artist
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, user_id')
            .eq('user_id', session.user_id)
            .single()

          if (profile) {
            // Update XP wallet
            await supabase
              .from('player_xp_wallet')
              .upsert({
                profile_id: profile.id,
                xp_balance: supabase.rpc('increment', { x: xpEarned }),
                updated_at: new Date().toISOString()
              }, { onConflict: 'profile_id' })

            // Log to experience ledger
            await supabase
              .from('experience_ledger')
              .insert({
                profile_id: profile.id,
                user_id: session.user_id,
                activity_type: 'recording',
                xp_amount: xpEarned,
                metadata: {
                  session_id: session.id,
                  song_id: session.song_id,
                  final_quality: finalQuality,
                  auto_completed: true
                }
              })
          }
        }

        completedCount++
        console.log(`✓ Completed session ${session.id}: Quality ${finalQuality}, XP ${xpEarned}`)
      } catch (error) {
        console.error(`Error processing session ${session.id}:`, error)
      }
    }

    console.log(`=== Recording Session Auto-Completion Complete: ${completedCount} sessions ===`)

    return new Response(
      JSON.stringify({ 
        success: true,
        completedSessions: completedCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Recording session completion error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
