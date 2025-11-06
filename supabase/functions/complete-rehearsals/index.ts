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

    console.log(`=== Rehearsal Auto-Completion Started at ${new Date().toISOString()} ===`)

    // Find rehearsals that have passed their scheduled end time
    const { data: rehearsals, error: rehearsalsError } = await supabase
      .from('band_rehearsals')
      .select('*')
      .eq('status', 'in_progress')
      .lt('scheduled_end', new Date().toISOString())

    if (rehearsalsError) {
      console.error('Error fetching rehearsals:', rehearsalsError)
      throw rehearsalsError
    }

    console.log(`Found ${rehearsals?.length || 0} rehearsals to auto-complete`)

    let completedCount = 0

    for (const rehearsal of rehearsals || []) {
      try {
        console.log(`Processing rehearsal ${rehearsal.id} for band ${rehearsal.band_id}`)

        // Calculate duration in hours
        const startTime = new Date(rehearsal.scheduled_start)
        const endTime = new Date(rehearsal.scheduled_end)
        const durationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)

        // Calculate XP and gains (base formula: 10-20 XP per hour)
        const baseXpPerHour = 10 + Math.floor(Math.random() * 10)
        const xpEarned = Math.floor(baseXpPerHour * durationHours)
        const chemistryGain = Math.floor(Math.random() * 5) + 3 // 3-7 points
        const familiarityGain = Math.floor(Math.random() * 10) + 10 // 10-20 points

        // Update rehearsal to completed
        const { error: updateError } = await supabase
          .from('band_rehearsals')
          .update({
            status: 'completed',
            actual_end: new Date().toISOString(),
            xp_earned: xpEarned,
            chemistry_gained: chemistryGain,
            notes: rehearsal.notes ? `${rehearsal.notes}\n\nAuto-completed: Earned ${xpEarned} XP, +${chemistryGain} chemistry` : `Auto-completed: Earned ${xpEarned} XP, +${chemistryGain} chemistry`,
            updated_at: new Date().toISOString()
          })
          .eq('id', rehearsal.id)

        if (updateError) {
          console.error(`Error updating rehearsal ${rehearsal.id}:`, updateError)
          continue
        }

        // Get band members to award XP
        const { data: bandMembers, error: membersError } = await supabase
          .from('band_members')
          .select('profile_id')
          .eq('band_id', rehearsal.band_id)
          .eq('status', 'active')

        if (!membersError && bandMembers) {
          // Award XP via progression function
          for (const member of bandMembers) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('user_id')
              .eq('id', member.profile_id)
              .single()

            if (profile?.user_id) {
              await supabase.functions.invoke('progression', {
                body: {
                  action: 'award_action_xp',
                  amount: xpEarned,
                  category: 'practice',
                  action_key: 'rehearsal',
                  metadata: {
                    rehearsal_id: rehearsal.id,
                    band_id: rehearsal.band_id,
                    duration_hours: durationHours,
                    chemistry_gained: chemistryGain,
                    auto_completed: true
                  }
                }
              })
            }
          }
        }

        // Update band chemistry if applicable
        if (chemistryGain > 0) {
          await supabase
            .rpc('increment_band_chemistry', {
              p_band_id: rehearsal.band_id,
              p_amount: chemistryGain
            })
            .catch(err => console.error('Error updating band chemistry:', err))
        }

        // Update song familiarity if setlist was specified
        if (rehearsal.setlist_id) {
          const { data: setlistSongs } = await supabase
            .from('setlist_songs')
            .select('song_id')
            .eq('setlist_id', rehearsal.setlist_id)

          if (setlistSongs) {
            for (const song of setlistSongs) {
              // Update band_song_familiarity
              await supabase
                .from('band_song_familiarity')
                .upsert({
                  band_id: rehearsal.band_id,
                  song_id: song.song_id,
                  familiarity: supabase.rpc('increment', { x: familiarityGain }),
                  updated_at: new Date().toISOString()
                }, {
                  onConflict: 'band_id,song_id'
                })

              // Update song_rehearsals for gig performance calculations
              const { data: existingRehearsal } = await supabase
                .from('song_rehearsals')
                .select('rehearsal_level')
                .eq('band_id', rehearsal.band_id)
                .eq('song_id', song.song_id)
                .single()

              const newLevel = Math.min(10, (existingRehearsal?.rehearsal_level || 0) + 1)
              
              await supabase
                .from('song_rehearsals')
                .upsert({
                  band_id: rehearsal.band_id,
                  song_id: song.song_id,
                  rehearsal_level: newLevel,
                  last_rehearsed: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                }, {
                  onConflict: 'band_id,song_id'
                })
            }
          }
        }

        // Update song rehearsal for single song practice
        if (rehearsal.selected_song_id) {
          const { data: existingRehearsal } = await supabase
            .from('song_rehearsals')
            .select('rehearsal_level')
            .eq('band_id', rehearsal.band_id)
            .eq('song_id', rehearsal.selected_song_id)
            .single()

          const newLevel = Math.min(10, (existingRehearsal?.rehearsal_level || 0) + 1)
          
          await supabase
            .from('song_rehearsals')
            .upsert({
              band_id: rehearsal.band_id,
              song_id: rehearsal.selected_song_id,
              rehearsal_level: newLevel,
              last_rehearsed: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'band_id,song_id'
            })
        }

        completedCount++
        console.log(`Completed rehearsal ${rehearsal.id}: ${xpEarned} XP, +${chemistryGain} chemistry`)
      } catch (error) {
        console.error(`Error processing rehearsal ${rehearsal.id}:`, error)
      }
    }

    console.log(`=== Rehearsal Auto-Completion Complete: ${completedCount} rehearsals ===`)

    return new Response(
      JSON.stringify({ 
        success: true,
        completedRehearsals: completedCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Rehearsal completion error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
