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
  let inboxSent = 0

  // Helper to send inbox notification (fire-and-forget, never throws)
  const sendInbox = async (userId: string, category: string, priority: string, title: string, message: string, metadata: Record<string, unknown> = {}, actionType?: string, actionData?: Record<string, unknown>) => {
    try {
      await supabase.from('player_inbox').insert({
        user_id: userId,
        category,
        priority,
        title,
        message,
        metadata,
        action_type: actionType || null,
        action_data: actionData || null,
      })
      inboxSent++
    } catch (e) {
      console.error('[Inbox] Failed to send:', e)
    }
  }

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
      .select('id, fame, weekly_fans, total_fans, popularity, cohesion_score, days_together, chemistry_level, performance_count, created_at, status, morale, reputation_score')

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

        // Calculate days_together from band creation date
        const bandCreated = new Date(band.created_at)
        const newDaysTogether = Math.max(0, Math.floor((Date.now() - bandCreated.getTime()) / (1000 * 60 * 60 * 24)))

        // Calculate cohesion_score based on chemistry, days together, and performance count
        // Cohesion grows with time and activity, scaled 0-100
        const timeComponent = Math.min(40, newDaysTogether * 0.5) // up to 40 from time (80 days)
        const chemistryComponent = ((band.chemistry_level || 0) / 100) * 30 // up to 30 from chemistry
        const performanceComponent = Math.min(30, (band.performance_count || 0) * 1.5) // up to 30 from gigs
        const newCohesionScore = Math.min(100, Math.round(timeComponent + chemistryComponent + performanceComponent))

        // Calculate popularity based on fame, fans, and recent activity
        // Popularity = weighted blend of fame tier + fan engagement + activity recency
        const fameTier = Math.floor(Math.log10(Math.max(band.fame || 1, 1)) * 100) // ~0-600
        const fanEngagement = Math.min(200, Math.floor(((band.total_fans || 0) / 1000) * 10)) // up to 200
        const activityBoost = gigsCount * 50 // recent gigs boost
        const newPopularity = Math.min(1000, fameTier + fanEngagement + activityBoost)

        // === MORALE PASSIVE REGRESSION toward baseline 50 (v1.0.969) ===
        const curMorale = (band as any).morale ?? 50;
        let newMorale = curMorale;
        if (curMorale > 55) {
          newMorale = curMorale - Math.ceil((curMorale - 50) * 0.08); // 8% decay toward 50
        } else if (curMorale < 45) {
          newMorale = curMorale + Math.ceil((50 - curMorale) * 0.05); // 5% recovery toward 50
        }

        // === REPUTATION PASSIVE REGRESSION toward 0 (v1.0.970) ===
        const curRep = (band as any).reputation_score ?? 0;
        let newRep = curRep;
        if (curRep > 5) {
          newRep = curRep - Math.ceil(curRep * 0.03); // 3% decay toward 0
        } else if (curRep < -5) {
          newRep = curRep + Math.ceil(Math.abs(curRep) * 0.02); // 2% recovery toward 0 (scandals linger longer)
        }

        await supabase
          .from('bands')
          .update({
            fame: (band.fame || 0) + totalFameGain,
            weekly_fans: (band.weekly_fans || 0) + totalFansGain,
            total_fans: (band.total_fans || 0) + totalFansGain,
            days_together: newDaysTogether,
            cohesion_score: newCohesionScore,
            popularity: newPopularity,
            morale: newMorale,
            reputation_score: newRep,
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

        // Pre-fetch band sentiment for ticket demand (v1.0.952)
        const gigBandIds = [...new Set(scheduledGigs.map(g => g.band_id).filter(Boolean))];
        const ticketSentimentMap = new Map<string, number>();
        if (gigBandIds.length > 0) {
          const { data: bandSentiments } = await supabase
            .from('bands')
            .select('id, fan_sentiment_score')
            .in('id', gigBandIds);
          for (const b of bandSentiments || []) {
            ticketSentimentMap.set(b.id, (b as any).fan_sentiment_score ?? 0);
          }
        }
        
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

            // Sentiment ticket demand modifier (v1.0.952): 0.6x hostile → 1.4x fanatical
            const ticketSentiment = ticketSentimentMap.get(gig.band_id) ?? 0;
            const ticketSentimentT = (Math.max(-100, Math.min(100, ticketSentiment)) + 100) / 200;
            const ticketDemandMod = parseFloat((0.6 + ticketSentimentT * 0.8).toFixed(2));
            
            let baseDailyRate: number
            if (drawPower >= 1.0) baseDailyRate = 0.25 + (drawPower - 1) * 0.5
            else if (drawPower >= 0.7) baseDailyRate = 0.12 + (drawPower - 0.7) * 0.4
            else if (drawPower >= 0.4) baseDailyRate = 0.05 + (drawPower - 0.4) * 0.2
            else baseDailyRate = 0.02 + drawPower * 0.08
            
            const dailySaleRate = baseDailyRate * priceSensitivity * (1 + advanceBookingBonus) * ticketDemandMod
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
              // Inbox: Eviction alert
              await sendInbox(rental.user_id, 'financial', 'urgent', '🏠 Eviction Notice!', `You couldn't afford your daily rent of $${dailyCharge}. Your rental has been terminated.`, { rental_id: rental.id, daily_charge: dailyCharge }, 'navigate', { route: '/housing' })
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
              // Inbox: Rent charged
              await sendInbox(rental.user_id, 'financial', 'low', '🏠 Rent Charged', `Daily rent of $${dailyCharge} has been deducted from your account.`, { rental_id: rental.id, amount: dailyCharge })
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

        // Inbox: Investment growth summary (batch per user)
        const { data: investmentsByUser } = await supabase
          .from('player_investments')
          .select('user_id, current_value, growth_rate')
          .gt('growth_rate', 0)
        const userInvGrowth = new Map<string, number>()
        for (const inv of investmentsByUser || []) {
          if (!inv.user_id) continue
          const growth = Math.round(inv.current_value * (inv.growth_rate || 0))
          userInvGrowth.set(inv.user_id, (userInvGrowth.get(inv.user_id) || 0) + growth)
        }
        for (const [userId, totalGrowth] of userInvGrowth) {
          if (totalGrowth > 0) {
            await sendInbox(userId, 'financial', 'low', '📈 Investment Growth', `Your investments grew by $${totalGrowth} overnight.`, { total_growth: totalGrowth }, 'navigate', { route: '/investments' })
          }
        }
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

    // === NPC LABEL SCOUTING ===
    console.log('=== NPC Label Scouting ===')
    let npcOffersGenerated = 0
    try {
      // Get all NPC labels (no owner)
      const { data: npcLabels } = await supabase
        .from('labels')
        .select('id, name, reputation_score, genre_focus, balance')
        .is('owner_id', null)
        .gt('balance', 10000)

      // Get all active bands with their fame/genre
      const { data: allBands } = await supabase
        .from('bands')
        .select('id, name, fame, genre, total_fans, status, reputation_score')
        .eq('status', 'active')
        .gt('fame', 50) // Minimum fame threshold to be scouted

      // Get existing active/offered contracts to avoid duplicates
      const { data: existingContracts } = await supabase
        .from('artist_label_contracts')
        .select('band_id, label_id, status')
        .in('status', ['offered', 'pending', 'active', 'negotiating', 'accepted_by_artist'])

      // Get a deal type for offers
      const { data: dealTypes } = await supabase
        .from('label_deal_types')
        .select('id, name, default_artist_royalty, default_label_royalty, default_term_months, default_release_quota')
        .limit(5)

      if (npcLabels && allBands && dealTypes && dealTypes.length > 0) {
        const existingPairs = new Set(
          (existingContracts || []).map(c => `${c.band_id}:${c.label_id}`)
        )

        for (const band of allBands) {
          // Daily scouting chance based on fame tier
          // Higher fame = higher chance of being scouted
          let scoutChance: number
          if (band.fame >= 1000000) scoutChance = 0.15       // 15% daily for megastars
          else if (band.fame >= 100000) scoutChance = 0.10    // 10% for established
          else if (band.fame >= 10000) scoutChance = 0.06     // 6% for mid-tier
          else if (band.fame >= 1000) scoutChance = 0.03      // 3% for emerging
          else if (band.fame >= 100) scoutChance = 0.01       // 1% for newcomers
          else scoutChance = 0.005                             // 0.5% for unknowns

          // Reputation modifier (v1.0.957): good rep boosts scouting, toxic rep kills it
          const bandRepScore = (band as any).reputation_score ?? 0;
          const repScoutMod = bandRepScore <= -40 ? 0.2 : bandRepScore <= -20 ? 0.6 : bandRepScore >= 40 ? 1.3 : bandRepScore >= 20 ? 1.1 : 1.0;
          scoutChance *= repScoutMod;

          if (Math.random() > scoutChance) continue

          // Count existing offers for this band (cap at 3 pending offers)
          const pendingOffers = (existingContracts || []).filter(
            c => c.band_id === band.id && ['offered', 'pending', 'negotiating'].includes(c.status)
          ).length
          if (pendingOffers >= 3) continue

          // Find compatible NPC labels (genre overlap or high rep labels scout broadly)
          const bandGenreLower = (band.genre || '').toLowerCase()
          const compatibleLabels = npcLabels.filter(label => {
            // Skip if already has a deal with this label
            if (existingPairs.has(`${band.id}:${label.id}`)) return false

            // Genre matching
            const labelGenres = (label.genre_focus || []).map((g: string) => g.toLowerCase())
            const genreMatch = labelGenres.some((g: string) =>
              bandGenreLower.includes(g) || g.includes(bandGenreLower)
            )

            // High-rep labels scout more broadly
            if (label.reputation_score >= 80) return genreMatch || Math.random() < 0.3
            return genreMatch
          })

          if (compatibleLabels.length === 0) continue

          // Pick the best-fit label (weighted by reputation)
          const chosenLabel = compatibleLabels[Math.floor(Math.random() * compatibleLabels.length)]

          // Pick a deal type (weighted by band fame)
          let dealType
          if (band.fame >= 100000) {
            // High fame = better deals offered
            dealType = dealTypes.find(d => d.name === 'Distribution Deal') || dealTypes[0]
          } else if (band.fame >= 10000) {
            dealType = dealTypes.find(d => d.name === 'Standard Deal') || dealTypes[0]
          } else {
            dealType = dealTypes.find(d => d.name === '360 Deal') || dealTypes[0]
          }

          // Calculate offer terms based on band fame & label reputation
          const fameMultiplier = Math.min(10, Math.max(0.1, band.fame / 10000))
          const repMultiplier = chosenLabel.reputation_score / 75

          // Advance: $500 to $500,000 scaled by fame & label rep
          const baseAdvance = 2000 + Math.floor(fameMultiplier * repMultiplier * 15000)
          const advance = Math.min(500000, Math.max(500, baseAdvance + Math.floor(Math.random() * baseAdvance * 0.3)))

          // Royalty: higher fame = better royalty for artist
          const baseRoyalty = dealType.default_artist_royalty || 15
          const fameRoyaltyBonus = Math.min(15, Math.floor(fameMultiplier * 3))
          const artistRoyalty = Math.min(50, baseRoyalty + fameRoyaltyBonus)

          // Term: 12-36 months
          const termMonths = dealType.default_term_months || 24

          // Release quota
          const singleQuota = Math.max(2, Math.min(8, Math.floor(2 + fameMultiplier)))
          const albumQuota = Math.max(1, Math.min(4, Math.floor(fameMultiplier * 0.5)))
          const releaseQuota = singleQuota + albumQuota

          // Territories based on label reputation
          let territories: string[]
          if (chosenLabel.reputation_score >= 85) territories = ['NA', 'EU', 'UK', 'ASIA', 'LATAM', 'OCEANIA']
          else if (chosenLabel.reputation_score >= 75) territories = ['NA', 'EU', 'UK']
          else territories = ['NA']

          const startDate = new Date()
          const endDate = new Date()
          endDate.setMonth(endDate.getMonth() + termMonths)

          const contractValue = advance + singleQuota * 5000 + albumQuota * 25000

          const { error: insertError } = await supabase
            .from('artist_label_contracts')
            .insert({
              label_id: chosenLabel.id,
              band_id: band.id,
              deal_type_id: dealType.id,
              status: 'offered',
              last_action_by: 'label',
              advance_amount: advance,
              royalty_artist_pct: artistRoyalty,
              royalty_label_pct: 100 - artistRoyalty,
              single_quota: singleQuota,
              album_quota: albumQuota,
              release_quota: releaseQuota,
              termination_fee_pct: Math.floor(20 + Math.random() * 30),
              manufacturing_covered: chosenLabel.reputation_score >= 75,
              territories,
              contract_value: contractValue,
              start_date: startDate.toISOString(),
              end_date: endDate.toISOString(),
            })

          if (insertError) {
            console.error(`Error creating NPC offer for band ${band.name}:`, insertError)
          } else {
            existingPairs.add(`${band.id}:${chosenLabel.id}`)
            npcOffersGenerated++
            console.log(`NPC offer: ${chosenLabel.name} → ${band.name} ($${advance} advance, ${artistRoyalty}% royalty)`)
          }
        }
      }
      console.log(`NPC label scouting complete: ${npcOffersGenerated} offers generated`)
    } catch (scoutError) {
      console.error('Error in NPC label scouting:', scoutError)
    }

    // === FAN LOYALTY DECAY (v1.0.932) ===
    console.log('=== Processing Fan Loyalty Decay ===')
    let fanDecayBands = 0
    let totalFansLost = 0
    try {
      const GRACE_PERIOD_DAYS = 7;
      const CASUAL_DAILY_DECAY = 0.02;
      const DEDICATED_DAILY_DOWNGRADE = 0.005;
      const SUPERFAN_DAILY_DOWNGRADE = 0.002;

      for (const band of bands || []) {
        try {
          // Get most recent activity date
          const activityChecks = await Promise.all([
            supabase.from('gigs').select('performance_date').eq('band_id', band.id)
              .eq('status', 'completed').order('performance_date', { ascending: false }).limit(1),
            supabase.from('song_releases').select('created_at').eq('band_id', band.id)
              .order('created_at', { ascending: false }).limit(1),
          ]);

          const dates = activityChecks
            .map(c => c.data?.[0])
            .filter(Boolean)
            .map(d => new Date((d as any).performance_date || (d as any).created_at).getTime())
            .filter(t => t > 0);

          const mostRecent = dates.length > 0 ? Math.max(...dates) : Date.now() - 30 * 24 * 60 * 60 * 1000;
          const daysSinceActivity = Math.floor((Date.now() - mostRecent) / (1000 * 60 * 60 * 24));

          if (daysSinceActivity <= GRACE_PERIOD_DAYS) continue;

          const activeDays = daysSinceActivity - GRACE_PERIOD_DAYS;
          const fameProtection = (band.fame || 0) >= 10000 ? 0.3 : (band.fame || 0) >= 5000 ? 0.2 : (band.fame || 0) >= 1000 ? 0.1 : 0;
          const decayMult = 1 - fameProtection;

          // Fetch current fan tiers
          const { data: freshBand } = await supabase
            .from('bands')
            .select('casual_fans, dedicated_fans, superfans, total_fans')
            .eq('id', band.id)
            .single();

          if (!freshBand) continue;

          const casualLost = Math.floor((freshBand.casual_fans || 0) * (1 - Math.pow(1 - CASUAL_DAILY_DECAY * decayMult, activeDays)));
          const dedicatedDown = Math.floor((freshBand.dedicated_fans || 0) * (1 - Math.pow(1 - DEDICATED_DAILY_DOWNGRADE * decayMult, activeDays)));
          const superfanDown = Math.floor((freshBand.superfans || 0) * (1 - Math.pow(1 - SUPERFAN_DAILY_DOWNGRADE * decayMult, activeDays)));

          const churn = casualLost + dedicatedDown + superfanDown;
          if (churn === 0) continue;

          const newCasual = Math.max(0, (freshBand.casual_fans || 0) - casualLost + dedicatedDown);
          const newDedicated = Math.max(0, (freshBand.dedicated_fans || 0) - dedicatedDown + superfanDown);
          const newSuperfans = Math.max(0, (freshBand.superfans || 0) - superfanDown);

          await supabase.from('bands').update({
            casual_fans: newCasual,
            dedicated_fans: newDedicated,
            superfans: newSuperfans,
            total_fans: newCasual + newDedicated + newSuperfans,
          }).eq('id', band.id);

          fanDecayBands++;
          totalFansLost += casualLost;
        } catch (decayErr) {
          console.error(`Fan decay error for band ${band.id}:`, decayErr);
        }
      }
      console.log(`Fan decay: ${fanDecayBands} inactive bands, ${totalFansLost} casual fans lost`);
    } catch (fanDecayError) {
      console.error('Error in fan loyalty decay:', fanDecayError);
    }

    // === REPUTATION DRIFT (v1.0.932) ===
    console.log('=== Processing Reputation Drift ===')
    let reputationDrifted = 0
    try {
      const { data: profilesWithRep } = await supabase
        .from('profiles')
        .select('id, reputation_score')
        .not('reputation_score', 'is', null)

      for (const p of profilesWithRep || []) {
        const score = p.reputation_score || 0;
        if (Math.abs(score) <= 10) continue;
        const drift = score > 0 ? -0.5 : 0.5;
        const newScore = Math.max(-100, Math.min(100, parseFloat((score + drift).toFixed(1))));
        if (newScore !== score) {
          await supabase.from('profiles').update({ reputation_score: newScore } as any).eq('id', p.id);
          reputationDrifted++;
        }
      }
      console.log(`Reputation drift: ${reputationDrifted} profiles adjusted toward neutral`);
    } catch (repErr) {
      console.error('Error in reputation drift:', repErr);
    }

    // === FAN SENTIMENT DRIFT (v1.0.937) ===
    console.log('=== Processing Fan Sentiment Drift ===')
    let sentimentDrifted = 0
    try {
      const { data: profilesWithSentiment } = await supabase
        .from('profiles')
        .select('id, fan_sentiment_score')
        .not('fan_sentiment_score', 'is', null)

      for (const p of profilesWithSentiment || []) {
        const score = (p as any).fan_sentiment_score || 0;
        if (Math.abs(score) <= 5) continue;
        const drift = score > 0 ? -0.5 : 0.5;
        const newScore = Math.max(-100, Math.min(100, parseFloat((score + drift).toFixed(1))));
        if (newScore !== score) {
          await supabase.from('profiles').update({ fan_sentiment_score: newScore } as any).eq('id', p.id);
          sentimentDrifted++;
        }
      }
      console.log(`Fan sentiment drift: ${sentimentDrifted} profiles adjusted toward neutral`);
    } catch (sentErr) {
      console.error('Error in fan sentiment drift:', sentErr);
    }

    // === BAND SENTIMENT DRIFT (v1.0.942) ===
    console.log('=== Processing Band Sentiment Drift ===')
    let bandSentimentDrifted = 0
    try {
      const { data: bandsWithSentiment } = await supabase
        .from('bands')
        .select('id, fan_sentiment_score')

      const sentimentEventInserts: any[] = [];
      for (const b of bandsWithSentiment || []) {
        const score = (b as any).fan_sentiment_score ?? 0;
        if (Math.abs(score) <= 5) continue;
        const drift = score > 0 ? -0.5 : 0.5;
        const newScore = Math.max(-100, Math.min(100, parseFloat((score + drift).toFixed(1))));
        if (newScore !== score) {
          await supabase.from('bands').update({ fan_sentiment_score: newScore } as any).eq('id', b.id);
          sentimentEventInserts.push({
            band_id: b.id,
            event_type: 'daily_drift',
            sentiment_change: drift,
            sentiment_after: newScore,
            source: 'process-daily-updates',
            description: `Sentiment drifted ${drift > 0 ? 'up' : 'down'} toward neutral`,
          });
          bandSentimentDrifted++;
        }
      }
      if (sentimentEventInserts.length > 0) {
        await supabase.from('band_sentiment_events').insert(sentimentEventInserts);
      }
      console.log(`Band sentiment drift: ${bandSentimentDrifted} bands adjusted toward neutral`);
    } catch (bsErr) {
      console.error('Error in band sentiment drift:', bsErr);
    }

    // === IDLE EQUIPMENT DEGRADATION (v1.0.942) ===
    // Equipment slowly loses condition even when not used (storage wear, humidity, etc.)
    console.log('=== Processing Idle Equipment Degradation ===')
    let equipmentDegraded = 0
    try {
      const { data: allEquipment } = await supabase
        .from('player_equipment')
        .select('id, condition')
        .gt('condition', 0)

      for (const item of allEquipment || []) {
        const currentCondition = typeof item.condition === 'number' ? item.condition : 100;
        if (currentCondition <= 0) continue;

        // Idle degradation: -0.2 to -0.5 per day (much slower than gig wear)
        const idleWear = parseFloat((0.2 + Math.random() * 0.3).toFixed(2));
        const newCondition = Math.max(0, parseFloat((currentCondition - idleWear).toFixed(1)));

        if (newCondition !== currentCondition) {
          await supabase.from('player_equipment').update({ condition: newCondition }).eq('id', item.id);
          equipmentDegraded++;
        }
      }
      console.log(`Idle equipment degradation: ${equipmentDegraded} items lost minor condition`);
    } catch (eqErr) {
      console.error('Error in idle equipment degradation:', eqErr);
    }

    // === MEDIA CYCLE DECAY (v1.0.937) ===
    console.log('=== Processing Media Cycle Decay ===')
    let mediaDecayed = 0
    try {
      const { data: bandsWithMedia } = await supabase
        .from('bands')
        .select('id, media_intensity, media_fatigue')

      for (const b of bandsWithMedia || []) {
        const intensity = (b as any).media_intensity || 0;
        const fatigue = (b as any).media_fatigue || 0;
        if (intensity <= 0 && fatigue <= 0) continue;

        const newIntensity = Math.max(0, parseFloat((intensity - 3).toFixed(1)));
        const newFatigue = Math.max(0, parseFloat((fatigue - 1.5).toFixed(1)));

        if (newIntensity !== intensity || newFatigue !== fatigue) {
          await supabase.from('bands').update({
            media_intensity: newIntensity,
            media_fatigue: newFatigue,
          } as any).eq('id', b.id);
          mediaDecayed++;
        }
      }
      console.log(`Media cycle decay: ${mediaDecayed} bands had intensity/fatigue reduced`);
    } catch (mediaErr) {
      console.error('Error in media cycle decay:', mediaErr);
    }

    // === BAND SALARY → MORALE CHECK (v1.0.960) ===
    console.log('=== Processing Band Salary Morale ===')
    let salaryMoraleUpdated = 0
    try {
      const { data: bandsWithMembers } = await supabase
        .from('bands')
        .select('id, band_balance, morale')

      for (const b of bandsWithMembers || []) {
        const { data: paidMembers } = await supabase
          .from('band_members')
          .select('salary')
          .eq('band_id', b.id)
          .eq('is_touring_member', false)
          .gt('salary', 0)

        if (!paidMembers || paidMembers.length === 0) continue

        const totalDailySalary = paidMembers.reduce((sum, m) => sum + Math.round((m.salary || 0) / 7), 0)
        const balance = (b as any).band_balance ?? 0
        const curMorale = (b as any).morale ?? 50

        if (balance < totalDailySalary) {
          // Can't afford salaries — morale drops
          const penalty = balance < 0 ? -4 : -2
          const newMorale = Math.max(0, curMorale + penalty)
          if (newMorale !== curMorale) {
            await supabase.from('bands').update({ morale: newMorale }).eq('id', b.id)
            salaryMoraleUpdated++
            console.log(`Band ${b.id}: can't afford salaries ($${totalDailySalary}/day, balance $${balance}), morale ${curMorale} → ${newMorale}`)
          }
        } else if (balance > totalDailySalary * 30) {
          // Healthy finances — small morale boost
          const boost = 1
          const newMorale = Math.min(100, curMorale + boost)
          if (newMorale !== curMorale) {
            await supabase.from('bands').update({ morale: newMorale }).eq('id', b.id)
            salaryMoraleUpdated++
          }
        }
      }
      console.log(`Salary morale: ${salaryMoraleUpdated} bands affected`)
    } catch (salaryErr) {
      console.error('Error in salary morale check:', salaryErr)
    }

    // === BAND MORALE DRIFT (v1.0.956) ===
    console.log('=== Processing Band Morale Drift ===')
    let moraleDrifted = 0
    try {
      const { data: bandsWithMorale } = await supabase
        .from('bands')
        .select('id, morale')

      for (const b of bandsWithMorale || []) {
        const score = (b as any).morale ?? 50;
        if (Math.abs(score - 50) <= 2) continue;
        const drift = score > 50 ? -1 : 1;
        const newScore = Math.max(0, Math.min(100, score + drift));
        if (newScore !== score) {
          await supabase.from('bands').update({ morale: newScore }).eq('id', b.id);
          moraleDrifted++;
        }
      }
      console.log(`Band morale drift: ${moraleDrifted} bands drifted toward baseline`);
    } catch (moraleErr) {
      console.error('Error in band morale drift:', moraleErr);
    }

    // === BAND REPUTATION DRIFT (v1.0.956) ===
    console.log('=== Processing Band Reputation Drift ===')
    let bandRepDrifted = 0
    try {
      const { data: bandsWithRep } = await supabase
        .from('bands')
        .select('id, reputation_score')

      for (const b of bandsWithRep || []) {
        const score = (b as any).reputation_score ?? 0;
        if (Math.abs(score) <= 10) continue;
        const drift = score > 0 ? -0.5 : 0.5;
        const newScore = Math.max(-100, Math.min(100, parseFloat((score + drift).toFixed(1))));
        if (newScore !== score) {
          await supabase.from('bands').update({ reputation_score: newScore }).eq('id', b.id);
          bandRepDrifted++;
        }
      }
      console.log(`Band reputation drift: ${bandRepDrifted} bands drifted toward neutral`);
    } catch (repErr) {
      console.error('Error in band reputation drift:', repErr);
    }

    // === FAN SENTIMENT DRIFT (v1.0.987) ===
    // Sentiment drifts toward 0 (neutral) — fans forget over time without reinforcement
    console.log('=== Processing Fan Sentiment Drift ===')
    let sentimentDrifted = 0
    try {
      const { data: bandsWithSent } = await supabase
        .from('bands')
        .select('id, fan_sentiment_score')

      for (const b of bandsWithSent || []) {
        const score = (b as any).fan_sentiment_score ?? 0;
        if (Math.abs(score) <= 5) continue;
        // Positive sentiment decays faster than negative recovers (happy fans are fickle; angry fans hold grudges)
        const drift = score > 0 ? -0.8 : 0.4;
        const newScore = Math.max(-100, Math.min(100, parseFloat((score + drift).toFixed(1))));
        if (newScore !== score) {
          await supabase.from('bands').update({ fan_sentiment_score: newScore } as any).eq('id', b.id);
          sentimentDrifted++;
        }
      }
      console.log(`Fan sentiment drift: ${sentimentDrifted} bands drifted toward neutral`);
    } catch (sentErr) {
      console.error('Error in fan sentiment drift:', sentErr);
    }

    // === CROSS-SYSTEM FEEDBACK LOOPS (v1.0.955) ===
    // The 4 health pillars influence each other daily
    console.log('=== Processing Cross-System Feedback Loops ===')
    let feedbackApplied = 0
    try {
      const { data: bandsHealth } = await supabase
        .from('bands')
        .select('id, fan_sentiment_score, media_intensity, media_fatigue, reputation_score, morale')

      const feedbackEventInserts: any[] = [];
      for (const b of bandsHealth || []) {
        const sentimentScore = (b as any).fan_sentiment_score ?? 0;
        const mediaIntensity = (b as any).media_intensity ?? 0;
        const mediaFatigue = (b as any).media_fatigue ?? 0;
        const reputationScore = (b as any).reputation_score ?? 0;
        const moraleScore = (b as any).morale ?? 50;

        // Calculate feedback deltas inline (mirrors src/utils/healthSystemFeedback.ts)
        let sentimentDelta = 0;
        let reputationDelta = 0;
        let moraleDelta = 0;
        let mediaFatigueDelta = 0;
        const triggers: string[] = [];

        // Reputation → Sentiment
        if (reputationScore <= -40) { sentimentDelta -= 1.5; triggers.push('Toxic reputation eroding fan sentiment'); }
        else if (reputationScore <= -20) { sentimentDelta -= 0.5; triggers.push('Controversial reputation hurting sentiment'); }
        if (reputationScore >= 60) { sentimentDelta += 1; triggers.push('Strong reputation boosting fan sentiment'); }

        // Sentiment → Reputation
        if (sentimentScore >= 70) { reputationDelta += 0.5; triggers.push('Devoted fanbase improving public image'); }
        if (sentimentScore <= -50) { reputationDelta -= 1; triggers.push('Hostile fans damaging public perception'); }

        // Media → Reputation
        if (mediaFatigue >= 70) { reputationDelta -= 1; triggers.push('Media oversaturation causing reputation fatigue'); }
        if (mediaIntensity >= 60 && reputationScore >= 30) { reputationDelta += 0.5; sentimentDelta += 0.5; triggers.push('Positive media amplifying good reputation'); }
        if (mediaIntensity >= 60 && reputationScore <= -20) { reputationDelta -= 1; sentimentDelta -= 1; triggers.push('Media spotlight amplifying negative reputation'); }

        // Morale → Sentiment
        if (moraleScore <= 25) { sentimentDelta -= 1; triggers.push('Low morale causing poor performances'); }
        if (moraleScore >= 85) { sentimentDelta += 0.5; triggers.push('High morale boosting show quality'); }

        // Sentiment → Morale
        if (sentimentScore >= 60) { moraleDelta += 1; triggers.push('Fan devotion boosting band morale'); }
        if (sentimentScore <= -40) { moraleDelta -= 1.5; triggers.push('Fan hostility demoralizing the band'); }

        // Media → Morale
        if (mediaIntensity >= 70 && moraleScore <= 35) { moraleDelta -= 1; mediaFatigueDelta += 1; triggers.push('Media pressure stressing low-morale band'); }
        if (mediaIntensity >= 30 && mediaIntensity < 70 && moraleScore >= 60) { moraleDelta += 0.5; triggers.push('Growing media buzz exciting the band'); }

        // Downward spiral
        const badCount = [sentimentScore <= -30, reputationScore <= -30, moraleScore <= 25, mediaFatigue >= 70].filter(Boolean).length;
        if (badCount >= 3) { sentimentDelta -= 0.5; reputationDelta -= 0.5; moraleDelta -= 0.5; triggers.push('Downward spiral: multiple systems in crisis'); }

        // Virtuous cycle
        const goodCount = [sentimentScore >= 50, reputationScore >= 40, moraleScore >= 70, mediaIntensity >= 30 && mediaFatigue <= 40].filter(Boolean).length;
        if (goodCount >= 3) { sentimentDelta += 0.5; reputationDelta += 0.5; moraleDelta += 0.5; triggers.push('Virtuous cycle: multiple systems thriving'); }

        // Skip if no changes
        if (sentimentDelta === 0 && reputationDelta === 0 && moraleDelta === 0 && mediaFatigueDelta === 0) continue;

        const newSentiment = Math.max(-100, Math.min(100, parseFloat((sentimentScore + sentimentDelta).toFixed(1))));
        const newReputation = Math.max(-100, Math.min(100, parseFloat((reputationScore + reputationDelta).toFixed(1))));
        const newMorale = Math.max(0, Math.min(100, parseFloat((moraleScore + moraleDelta).toFixed(1))));
        const newMediaFatigue = Math.max(0, Math.min(100, parseFloat((mediaFatigue + mediaFatigueDelta).toFixed(1))));

        const updatePayload: any = {};
        if (newSentiment !== sentimentScore) updatePayload.fan_sentiment_score = newSentiment;
        if (newReputation !== reputationScore) updatePayload.reputation_score = newReputation;
        if (newMorale !== moraleScore) updatePayload.morale = newMorale;
        if (newMediaFatigue !== mediaFatigue) updatePayload.media_fatigue = newMediaFatigue;

        if (Object.keys(updatePayload).length > 0) {
          await supabase.from('bands').update(updatePayload).eq('id', b.id);
          feedbackApplied++;

          // Log feedback events
          if (triggers.length > 0) {
            feedbackEventInserts.push({
              band_id: b.id,
              event_type: 'feedback_loop',
              sentiment_change: sentimentDelta,
              sentiment_after: newSentiment,
              source: 'cross-system-feedback',
              description: triggers.join('; '),
            });
          }
        }
      }
      if (feedbackEventInserts.length > 0) {
        await supabase.from('band_sentiment_events').insert(feedbackEventInserts);
      }
      console.log(`Cross-system feedback: ${feedbackApplied} bands had health metrics adjusted`);
    } catch (feedbackErr) {
      console.error('Error in cross-system feedback:', feedbackErr);
    }

    console.log(`=== Daily Updates Complete ===`)
    console.log(`Profiles: ${processedProfiles}, Bands: ${processedBands}, Player Syncs: ${playerSyncs}, Ticket Sales: ${ticketSalesUpdated}, Hype Decay: ${hypeDecayCount}, PR Offers: ${prOffersGenerated}, Rentals: ${rentalsCharged}/${rentalsDefaulted}, Investments: ${investmentsGrown}, Modeling: ${modelingCompleted}, NPC Offers: ${npcOffersGenerated}, Band Sentiment Drift: ${bandSentimentDrifted}, Equipment Degraded: ${equipmentDegraded}, Feedback Loops: ${feedbackApplied}, Errors: ${errorCount}`)

    await completeJobRun({
      jobName: 'process-daily-updates',
      runId,
      supabaseClient: supabase,
      durationMs: Date.now() - startedAt,
      processedCount: processedProfiles + processedBands + ticketSalesUpdated + prOffersGenerated + playerSyncs + rentalsCharged + npcOffersGenerated + feedbackApplied,
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
        npc_offers_generated: npcOffersGenerated,
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
        npc_offers_generated: npcOffersGenerated,
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