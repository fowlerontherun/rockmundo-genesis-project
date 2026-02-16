import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'
import {
  completeJobRun,
  failJobRun,
  getErrorMessage,
  safeJson,
  startJobRun,
} from '../_shared/job-logger.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-triggered-by',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const payload = await safeJson<{ triggeredBy?: string; requestId?: string | null }>(req)
  const triggeredBy = payload?.triggeredBy ?? req.headers.get('x-triggered-by') ?? undefined

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseKey)

  let runId: string | null = null
  const startedAt = Date.now()
  let processedProfiles = 0
  let processedBands = 0
  let playerSyncs = 0
  let errorCount = 0

  try {
    console.log(`=== Daily Updates Started at ${new Date().toISOString()} ===`)

    runId = await startJobRun({
      jobName: 'process-daily-updates',
      functionName: 'process-daily-updates',
      supabaseClient: supabase,
      triggeredBy,
      requestPayload: payload ?? null,
      requestId: payload?.requestId ?? null,
    })

    const today = new Date().toISOString().split('T')[0]

    // Fetch band growth config values
    console.log('Fetching band growth config...')
    const { data: growthConfig } = await supabase
      .from('game_balance_config')
      .select('key, value')
      .in('key', [
        'band_daily_fame_min', 'band_daily_fame_max',
        'band_daily_fans_min', 'band_daily_fans_max',
        'band_fame_to_fans_rate',
        'band_player_fame_share', 'band_player_fans_share'
      ])

    const getConfig = (key: string, defaultVal: number): number => {
      const item = growthConfig?.find(c => c.key === key)
      return item ? Number(item.value) : defaultVal
    }

    const fameMin = getConfig('band_daily_fame_min', 5)
    const fameMax = getConfig('band_daily_fame_max', 15)
    const fansMin = getConfig('band_daily_fans_min', 5)
    const fansMax = getConfig('band_daily_fans_max', 20)
    const fameToFansRate = getConfig('band_fame_to_fans_rate', 0.5)
    const playerFameShare = getConfig('band_player_fame_share', 92) / 100
    const playerFansShare = getConfig('band_player_fans_share', 92) / 100

    console.log(`Growth config: fame ${fameMin}-${fameMax}, fans ${fansMin}-${fansMax}, fameToFans ${fameToFansRate}%, playerShare fame ${playerFameShare * 100}% fans ${playerFansShare * 100}%`)

    // Process profiles - award daily fame based on activity
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, fame')

    if (profilesError) throw profilesError

    for (const profile of profiles || []) {
      try {
        // Calculate daily fame gain based on recent activity
        const { data: recentXp } = await supabase
          .from('experience_ledger')
          .select('xp_amount')
          .eq('profile_id', profile.id)
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

        const dailyXp = recentXp?.reduce((sum, entry) => sum + (entry.xp_amount || 0), 0) || 0
        
        // Base passive daily fame gain: random 1-5
        const passiveFameGain = Math.floor(Math.random() * 5) + 1
        
        // Bonus fame from XP activity: 1 fame per 100 XP earned yesterday
        const activityBonus = Math.floor(dailyXp / 100)
        
        const totalFameGain = passiveFameGain + activityBonus

        await supabase
          .from('profiles')
          .update({ fame: (profile.fame || 0) + totalFameGain })
          .eq('id', profile.id)

        processedProfiles++
      } catch (error) {
        console.error(`Error processing profile ${profile.id}:`, error)
        errorCount++
      }
    }

    // Process bands - award daily fame and fans with configurable rates
    const { data: bands, error: bandsError } = await supabase
      .from('bands')
      .select('id, fame, weekly_fans, total_fans')

    if (bandsError) throw bandsError

    for (const band of bands || []) {
      try {
        // Get band's recent activity through gigs, releases, etc
        const { data: recentGigs } = await supabase
          .from('gigs')
          .select('id')
          .eq('band_id', band.id)
          .gte('date', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

        const gigsCount = recentGigs?.length || 0
        
        // Base passive daily fame/fans gain: configurable range
        const passiveFameGain = fameMin + Math.floor(Math.random() * (fameMax - fameMin + 1))
        const passiveFansGain = fansMin + Math.floor(Math.random() * (fansMax - fansMin + 1))
        
        // Bonus from recent activity
        const activityFameBonus = gigsCount * 10
        const activityFansBonus = gigsCount * 5
        
        // Additional fans based on current fame (configurable rate, default 0.5%)
        const fameBasedFansBonus = Math.floor((band.fame || 0) * (fameToFansRate / 100))

        const totalFameGain = passiveFameGain + activityFameBonus
        const totalFansGain = passiveFansGain + activityFansBonus + fameBasedFansBonus

        await supabase
          .from('bands')
          .update({
            fame: (band.fame || 0) + totalFameGain,
            weekly_fans: (band.weekly_fans || 0) + totalFansGain,
            total_fans: (band.total_fans || 0) + totalFansGain
          })
          .eq('id', band.id)

        // === SYNC BAND GAINS TO PLAYER CHARACTERS ===
        // Get active band members (non-touring, with user_id)
        const { data: members } = await supabase
          .from('band_members')
          .select('user_id')
          .eq('band_id', band.id)
          .eq('is_touring_member', false)
          .not('user_id', 'is', null)

        let membersSynced = 0
        if (members && members.length > 0) {
          // Calculate player share (with 5-10% deduction built into config)
          const playerFameGain = Math.floor(totalFameGain * playerFameShare)
          const playerFansGain = Math.floor(totalFansGain * playerFansShare)

          for (const member of members) {
            if (!member.user_id) continue

            try {
              // Get current profile by user_id
              const { data: profile } = await supabase
                .from('profiles')
                .select('id, fame, fans')
                .eq('user_id', member.user_id)
                .single()

              if (profile) {
                await supabase
                  .from('profiles')
                  .update({
                    fame: (profile.fame || 0) + playerFameGain,
                    fans: (profile.fans || 0) + playerFansGain
                  })
                  .eq('id', profile.id)
                
                membersSynced++
                playerSyncs++
              }
            } catch (memberError) {
              console.error(`Error syncing member ${member.user_id}:`, memberError)
            }
          }
        }

        // Log the fame event with player sync data
        await supabase
          .from('band_fame_events')
          .insert({
            band_id: band.id,
            event_type: 'daily_growth',
            fame_gained: totalFameGain,
            event_data: {
              fans_gained: totalFansGain,
              passive_fame: passiveFameGain,
              passive_fans: passiveFansGain,
              fame_based_fans: fameBasedFansBonus,
              gigs_count: gigsCount,
              player_fame_synced: Math.floor(totalFameGain * playerFameShare),
              player_fans_synced: Math.floor(totalFansGain * playerFansShare),
              members_synced: membersSynced,
              date: today
            }
          })

        processedBands++
      } catch (error) {
        console.error(`Error processing band ${band.id}:`, error)
        errorCount++
      }
    }

    // === TICKET SALES SIMULATION ===
    console.log('=== Simulating Ticket Sales ===')
    let ticketSalesUpdated = 0
    
    try {
      // Get all scheduled gigs
      const { data: scheduledGigs, error: gigsError } = await supabase
        .from('gigs')
        .select(`
          id,
          band_id,
          venue_id,
          scheduled_date,
          tickets_sold,
          predicted_tickets,
          ticket_price,
          created_at,
          venues!gigs_venue_id_fkey (capacity)
        `)
        .eq('status', 'scheduled')

      if (gigsError) {
        console.error('Error fetching gigs for ticket sales:', gigsError)
      } else if (scheduledGigs && scheduledGigs.length > 0) {
        console.log(`Processing ticket sales for ${scheduledGigs.length} gigs`)
        
        for (const gig of scheduledGigs) {
          try {
            const { data: band } = await supabase
              .from('bands')
              .select('fame, total_fans')
              .eq('id', gig.band_id)
              .single()

            if (!band) continue

            const venueCapacity = (gig.venues as any)?.capacity || 100
            const currentTicketsSold = gig.tickets_sold || 0
            const scheduledDate = new Date(gig.scheduled_date)
            const createdAt = new Date(gig.created_at)
            const now = new Date()
            
            const daysUntilGig = Math.max(0, Math.ceil((scheduledDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
            const daysBooked = Math.max(1, Math.ceil((scheduledDate.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)))

            // Skip if already sold out
            if (currentTicketsSold >= venueCapacity) continue

            // Calculate draw power
            const fameDrawBase = Math.min(1, (band.fame || 0) / 5000)
            const fanDrawBase = Math.min(1, (band.total_fans || 0) / (venueCapacity * 3))
            const combinedDraw = (fameDrawBase * 0.6) + (fanDrawBase * 0.4)
            const venueSizeModifier = Math.max(0.3, 1 - (venueCapacity / 10000) * 0.5)
            const drawPower = Math.min(1.2, combinedDraw * venueSizeModifier)

            // Calculate daily sales
            const advanceBookingBonus = Math.min(0.3, (daysBooked / 14) * 0.3)
            const priceSensitivity = Math.max(0.5, 1 - ((gig.ticket_price || 20) / 100) * 0.3)
            
            let baseDailyRate: number
            if (drawPower >= 1.0) baseDailyRate = 0.25 + (drawPower - 1) * 0.5
            else if (drawPower >= 0.7) baseDailyRate = 0.12 + (drawPower - 0.7) * 0.4
            else if (drawPower >= 0.4) baseDailyRate = 0.05 + (drawPower - 0.4) * 0.2
            else baseDailyRate = 0.02 + drawPower * 0.08
            
            const dailySaleRate = baseDailyRate * priceSensitivity * (1 + advanceBookingBonus)
            let ticketsToday = Math.round(venueCapacity * dailySaleRate)
            
            // Urgency bonus as gig approaches
            const urgencyMultiplier = daysUntilGig <= 3 ? 1.5 : daysUntilGig <= 7 ? 1.2 : 1.0
            ticketsToday = Math.round(ticketsToday * urgencyMultiplier)
            
            // Add randomness (±20%)
            const randomFactor = 0.8 + Math.random() * 0.4
            ticketsToday = Math.round(ticketsToday * randomFactor)
            
            const remainingTickets = venueCapacity - currentTicketsSold
            ticketsToday = Math.min(ticketsToday, remainingTickets)

            if (ticketsToday > 0) {
              const newTotal = Math.min(currentTicketsSold + ticketsToday, venueCapacity)
              
              const { error: updateError } = await supabase
                .from('gigs')
                .update({
                  tickets_sold: newTotal,
                  last_ticket_update: now.toISOString()
                })
                .eq('id', gig.id)

              if (!updateError) {
                console.log(`Gig ${gig.id}: sold ${ticketsToday} tickets (${currentTicketsSold} -> ${newTotal})`)
                ticketSalesUpdated++
              }
            }
          } catch (gigError) {
            console.error(`Error processing gig ${gig.id} for tickets:`, gigError)
          }
        }
      }
    } catch (ticketError) {
      console.error('Error in ticket sales simulation:', ticketError)
    }

    // === HYPE DECAY FOR UNRELEASED SONGS ===
    console.log('=== Decaying hype for unreleased songs ===')
    let hypeDecayCount = 0
    try {
      const { data, error } = await supabase.rpc('decay_unreleased_song_hype')
      if (error) {
        console.error('Error decaying hype:', error)
      } else {
        // Count affected songs
        const { count } = await supabase
          .from('songs')
          .select('id', { count: 'exact', head: true })
          .in('status', ['written', 'recorded', 'mixing', 'mastering'])
          .gt('hype', 0)
        hypeDecayCount = count || 0
        console.log(`Decayed hype for unreleased songs`)
      }
    } catch (hypeError) {
      console.error('Error in hype decay:', hypeError)
    }

    // === GENERATE PR OFFERS ===
    console.log('=== Generating PR offers ===')
    let prOffersGenerated = 0
    try {
      const { data, error } = await supabase.functions.invoke('generate-pr-offers', {
        body: { triggeredBy: 'daily-updates' }
      })
      
      if (error) {
        console.error('Error generating PR offers:', error)
      } else {
        prOffersGenerated = data?.offersCreated || 0
        console.log(`Generated ${prOffersGenerated} PR offers`)
      }
    } catch (prError) {
      console.error('Error calling generate-pr-offers:', prError)
    }

    // === DAILY RENT COLLECTION ===
    console.log('=== Processing Daily Rent ===')
    let rentalsCharged = 0
    let rentalsDefaulted = 0
    try {
      const { data: activeRentals, error: rentalsError } = await supabase
        .from('player_rentals')
        .select('id, user_id, weekly_cost')
        .eq('status', 'active')

      if (rentalsError) {
        console.error('Error fetching active rentals:', rentalsError)
      } else if (activeRentals && activeRentals.length > 0) {
        for (const rental of activeRentals) {
          try {
            const dailyCharge = Math.round(rental.weekly_cost / 7)
            
            const { data: profile } = await supabase
              .from('profiles')
              .select('id, cash')
              .eq('user_id', rental.user_id)
              .single()

            if (!profile) continue

            if ((profile.cash || 0) < dailyCharge) {
              // Default the rental
              await supabase
                .from('player_rentals')
                .update({ status: 'defaulted', ended_at: new Date().toISOString() })
                .eq('id', rental.id)
              rentalsDefaulted++
              console.log(`Rental ${rental.id} defaulted - player cannot afford rent`)
            } else {
              await supabase
                .from('profiles')
                .update({ cash: (profile.cash || 0) - dailyCharge })
                .eq('id', profile.id)

              await supabase
                .from('player_rentals')
                .update({ last_charged_at: new Date().toISOString() })
                .eq('id', rental.id)
              rentalsCharged++
            }
          } catch (rentalError) {
            console.error(`Error processing rental ${rental.id}:`, rentalError)
            errorCount++
          }
        }
        console.log(`Rent collected: ${rentalsCharged} charged, ${rentalsDefaulted} defaulted`)
      }
    } catch (rentError) {
      console.error('Error in rent collection:', rentError)
    }

    // === DAILY INVESTMENT GROWTH ===
    console.log('=== Processing Investment Growth ===')
    let investmentsGrown = 0
    try {
      const { data: activeInvestments } = await supabase
        .from('player_investments')
        .select('id, current_value, growth_rate')

      if (activeInvestments && activeInvestments.length > 0) {
        for (const inv of activeInvestments) {
          try {
            const dailyRate = (inv.growth_rate || 0)
            if (dailyRate <= 0) continue
            const newValue = Math.round(inv.current_value * (1 + dailyRate))
            if (newValue !== inv.current_value) {
              await supabase
                .from('player_investments')
                .update({ current_value: newValue })
                .eq('id', inv.id)
              investmentsGrown++
            }
          } catch (invError) {
            console.error(`Error growing investment ${inv.id}:`, invError)
            errorCount++
          }
        }
        console.log(`Investments grown: ${investmentsGrown}`)
      }
    } catch (invError) {
      console.error('Error in investment growth:', invError)
    }

    // === MODELING CONTRACT COMPLETION ===
    console.log('=== Completing past modeling contracts ===')
    let modelingCompleted = 0
    try {
      const { data: pastContracts } = await supabase
        .from('player_modeling_contracts')
        .select('id, user_id, band_id, compensation, fame_boost, shoot_date')
        .eq('status', 'accepted')
        .lt('shoot_date', today)

      if (pastContracts && pastContracts.length > 0) {
        for (const contract of pastContracts) {
          try {
            // Mark as completed
            await supabase
              .from('player_modeling_contracts')
              .update({ status: 'completed', completed_at: new Date().toISOString() })
              .eq('id', contract.id)

            // Award compensation to player cash
            if (contract.user_id && contract.compensation) {
              const { data: profile } = await supabase
                .from('profiles')
                .select('id, cash, fame')
                .eq('user_id', contract.user_id)
                .single()

              if (profile) {
                await supabase
                  .from('profiles')
                  .update({
                    cash: (profile.cash || 0) + (contract.compensation || 0),
                    fame: (profile.fame || 0) + (contract.fame_boost || 0),
                  })
                  .eq('id', profile.id)
              }
            }

            // Log earnings if band exists
            if (contract.band_id && contract.compensation) {
              await supabase.from('band_earnings').insert({
                band_id: contract.band_id,
                amount: contract.compensation,
                source: 'modeling',
                description: `Modeling contract completed`,
                earned_by_user_id: contract.user_id,
              })
            }

            modelingCompleted++
          } catch (cErr) {
            console.error(`Error completing modeling contract ${contract.id}:`, cErr)
            errorCount++
          }
        }
        console.log(`Modeling contracts completed: ${modelingCompleted}`)
      }
    } catch (modelErr) {
      console.error('Error in modeling completion:', modelErr)
    }

    console.log(`=== Daily Updates Complete ===`)
    console.log(`Profiles: ${processedProfiles}, Bands: ${processedBands}, Player Syncs: ${playerSyncs}, Ticket Sales: ${ticketSalesUpdated}, Hype Decay: ${hypeDecayCount}, PR Offers: ${prOffersGenerated}, Rentals: ${rentalsCharged}/${rentalsDefaulted}, Investments: ${investmentsGrown}, Modeling: ${modelingCompleted}, Errors: ${errorCount}`)

    await completeJobRun({
      jobName: 'process-daily-updates',
      runId,
      supabaseClient: supabase,
      durationMs: Date.now() - startedAt,
      processedCount: processedProfiles + processedBands + ticketSalesUpdated + prOffersGenerated + playerSyncs + rentalsCharged,
      errorCount,
      resultSummary: {
        profiles_processed: processedProfiles,
        bands_processed: processedBands,
        player_syncs: playerSyncs,
        ticket_sales_updated: ticketSalesUpdated,
        hype_decayed: hypeDecayCount,
        pr_offers_generated: prOffersGenerated,
        rentals_charged: rentalsCharged,
        rentals_defaulted: rentalsDefaulted,
        modeling_completed: modelingCompleted,
      },
    })

    return new Response(
      JSON.stringify({
        success: true,
        profiles_processed: processedProfiles,
        bands_processed: processedBands,
        player_syncs: playerSyncs,
        ticket_sales_updated: ticketSalesUpdated,
        pr_offers_generated: prOffersGenerated,
        errors: errorCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Fatal error in daily updates:', error)

    if (runId) {
      await failJobRun({
        jobName: 'process-daily-updates',
        runId,
        supabaseClient: supabase,
        errorMessage: getErrorMessage(error),
      })
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: getErrorMessage(error),
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})