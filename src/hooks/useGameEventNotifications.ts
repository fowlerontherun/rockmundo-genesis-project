import { useEffect, useRef } from "react";
import { useNotifications } from "@/contexts/NotificationContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useNavigate } from "react-router-dom";

export const useGameEventNotifications = () => {
  const { addNotification } = useNotifications();
  const { user } = useAuth();
  const navigate = useNavigate();
  const userBandIdsRef = useRef<string[]>([]);

  // Fetch user's band IDs for filtering band-related notifications
  useEffect(() => {
    if (!user?.id) return;

    const fetchBandIds = async () => {
      const { data } = await supabase
        .from("band_members")
        .select("band_id")
        .eq("user_id", user.id);
      
      userBandIdsRef.current = data?.map(d => d.band_id) || [];
    };

    fetchBandIds();
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    const channels: ReturnType<typeof supabase.channel>[] = [];

    // === ACHIEVEMENTS ===
    const achievementsChannel = supabase
      .channel('achievement-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'player_achievements',
          filter: `user_id=eq.${user.id}`
        },
        async (payload) => {
          const { data: achievement } = await supabase
            .from('achievements')
            .select('name, description, rarity')
            .eq('id', payload.new.achievement_id)
            .single();

          if (achievement) {
            addNotification({
              type: 'achievement',
              title: `Achievement Unlocked!`,
              message: `${achievement.name} - ${achievement.description}`,
            });
          }
        }
      )
      .subscribe();
    channels.push(achievementsChannel);

    // === RELEASE MANUFACTURING COMPLETION ===
    const manufacturingChannel = supabase
      .channel('manufacturing-notifications')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'releases'
        },
        (payload) => {
          const oldStatus = payload.old?.release_status;
          const newStatus = payload.new?.release_status;
          const userId = payload.new?.user_id;
          const bandId = payload.new?.band_id;
          
          // Check if this release belongs to the user
          const isOwner = userId === user.id || userBandIdsRef.current.includes(bandId);
          
          if (isOwner && oldStatus === 'manufacturing' && newStatus === 'released') {
            addNotification({
              type: 'success',
              title: 'Manufacturing Complete!',
              message: `Your release "${payload.new.title}" has finished manufacturing and is now available!`,
              action: {
                label: 'View Releases',
                onClick: () => navigate('/release-manager'),
              },
            });
          }
        }
      )
      .subscribe();
    channels.push(manufacturingChannel);

    // === RECORDING SESSION COMPLETION ===
    const recordingChannel = supabase
      .channel('recording-notifications')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'recording_sessions'
        },
        async (payload) => {
          const oldStatus = payload.old?.status;
          const newStatus = payload.new?.status;
          
          if (oldStatus !== 'completed' && newStatus === 'completed') {
            // Get song details
            const { data: song } = await supabase
              .from('songs')
              .select('title, user_id, band_id')
              .eq('id', payload.new.song_id)
              .single();
            
            const isOwner = song?.user_id === user.id || userBandIdsRef.current.includes(song?.band_id);
            
            if (isOwner && song) {
              addNotification({
                type: 'success',
                title: 'Recording Complete!',
                message: `"${song.title}" recording session finished with quality score ${payload.new.quality_score || 'N/A'}`,
                action: {
                  label: 'View Recording',
                  onClick: () => navigate('/recording-studio'),
                },
              });
            }
          }
        }
      )
      .subscribe();
    channels.push(recordingChannel);

    // === GIG OUTCOMES ===
    const gigOutcomeChannel = supabase
      .channel('gig-outcome-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'gig_outcomes'
        },
        async (payload) => {
          const outcome = payload.new;
          
          // Get gig details to check ownership
          const { data: gig } = await supabase
            .from('gigs')
            .select('band_id, venue_id, venues(name)')
            .eq('id', outcome.gig_id)
            .single();
          
          if (gig && userBandIdsRef.current.includes(gig.band_id)) {
            const rating = outcome.overall_rating || 0;
            const venueName = (gig.venues as any)?.name || 'Unknown Venue';
            
            if (rating >= 90) {
              addNotification({
                type: 'success',
                title: '🔥 Legendary Performance!',
                message: `Your gig at ${venueName} was incredible! Rating: ${rating}%`,
                action: {
                  label: 'View Results',
                  onClick: () => navigate('/gig-booking'),
                },
              });
            } else if (rating >= 70) {
              addNotification({
                type: 'success',
                title: 'Great Show!',
                message: `Your gig at ${venueName} went well! Rating: ${rating}%`,
                action: {
                  label: 'View Results',
                  onClick: () => navigate('/gig-booking'),
                },
              });
            } else if (rating < 50) {
              addNotification({
                type: 'warning',
                title: 'Tough Crowd',
                message: `The gig at ${venueName} didn't go as planned. Rating: ${rating}%`,
                action: {
                  label: 'View Results',
                  onClick: () => navigate('/gig-booking'),
                },
              });
            } else {
              addNotification({
                type: 'info',
                title: 'Gig Complete',
                message: `Your gig at ${venueName} is finished. Rating: ${rating}%`,
              });
            }
          }
        }
      )
      .subscribe();
    channels.push(gigOutcomeChannel);

    // === GIG OFFERS ===
    const gigOffersChannel = supabase
      .channel('gig-offers-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'gig_offers'
        },
        async (payload) => {
          const offer = payload.new;
          
          if (userBandIdsRef.current.includes(offer.band_id)) {
            const { data: venue } = await supabase
              .from('venues')
              .select('name')
              .eq('id', offer.venue_id)
              .single();
            
            addNotification({
              type: 'offer',
              title: 'New Gig Offer!',
              message: `${venue?.name || 'A venue'} wants to book your band! Payout: $${offer.offered_payout || 'TBD'}`,
              action: {
                label: 'View Offer',
                onClick: () => navigate('/gig-booking'),
              },
            });
          }
        }
      )
      .subscribe();
    channels.push(gigOffersChannel);

    // === SPONSOR OFFERS ===
    const sponsorChannel = supabase
      .channel('sponsor-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'band_sponsorships'
        },
        (payload) => {
          const sponsorship = payload.new;
          
          if (userBandIdsRef.current.includes(sponsorship.band_id) && sponsorship.status === 'pending') {
            addNotification({
              type: 'offer',
              title: 'Sponsorship Offer!',
              message: `A brand wants to sponsor your band! Value: $${sponsorship.contract_value || 'TBD'}`,
              action: {
                label: 'View Offers',
                onClick: () => navigate('/sponsorships'),
              },
            });
          }
        }
      )
      .subscribe();
    channels.push(sponsorChannel);

    // === FESTIVAL OFFERS (via game_events participants) ===
    const festivalChannel = supabase
      .channel('festival-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'festival_participants'
        },
        async (payload) => {
          const participant = payload.new;
          
          if (userBandIdsRef.current.includes(participant.band_id) && participant.status === 'invited') {
            const { data: festival } = await supabase
              .from('game_events')
              .select('title')
              .eq('id', participant.event_id)
              .single();
            
            addNotification({
              type: 'offer',
              title: 'Festival Invitation!',
              message: `You've been invited to perform at ${festival?.title || 'a festival'}!`,
              action: {
                label: 'View Festival',
                onClick: () => navigate('/festivals'),
              },
            });
          }
        }
      )
      .subscribe();
    channels.push(festivalChannel);

    // === RECORD LABEL CONTRACT OFFERS ===
    const labelChannel = supabase
      .channel('label-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'artist_label_contracts'
        },
        async (payload) => {
          const contract = payload.new;
          
          if (userBandIdsRef.current.includes(contract.band_id) && contract.status === 'pending') {
            const { data: label } = await supabase
              .from('labels')
              .select('name')
              .eq('id', contract.label_id)
              .single();
            
            addNotification({
              type: 'offer',
              title: 'Record Deal Offer!',
              message: `${label?.name || 'A record label'} wants to sign your band!`,
              action: {
                label: 'View Contract',
                onClick: () => navigate('/record-labels'),
              },
            });
          }
        }
      )
      .subscribe();
    channels.push(labelChannel);

    // === BAND INVITATIONS ===
    const bandInviteChannel = supabase
      .channel('band-invite-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'band_invitations',
          filter: `invited_user_id=eq.${user.id}`
        },
        async (payload) => {
          const invite = payload.new;
          
          const { data: band } = await supabase
            .from('bands')
            .select('name')
            .eq('id', invite.band_id)
            .single();
          
          addNotification({
            type: 'offer',
            title: 'Band Invitation!',
            message: `You've been invited to join ${band?.name || 'a band'}!`,
            action: {
              label: 'View Invitation',
              onClick: () => navigate('/bands'),
            },
          });
        }
      )
      .subscribe();
    channels.push(bandInviteChannel);

    // === REHEARSAL COMPLETION ===
    const rehearsalChannel = supabase
      .channel('rehearsal-notifications')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'band_rehearsals'
        },
        (payload) => {
          const oldStatus = payload.old?.status;
          const newStatus = payload.new?.status;
          
          if (userBandIdsRef.current.includes(payload.new.band_id) && 
              oldStatus !== 'completed' && newStatus === 'completed') {
            addNotification({
              type: 'success',
              title: 'Rehearsal Complete!',
              message: `Your band rehearsal has finished. Chemistry +${payload.new.chemistry_gain || 0}`,
            });
          }
        }
      )
      .subscribe();
    channels.push(rehearsalChannel);

    // === SONGWRITING PROJECT COMPLETION ===
    const songwritingChannel = supabase
      .channel('songwriting-notifications')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'songwriting_projects',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const oldStatus = payload.old?.status;
          const newStatus = payload.new?.status;
          
          if (oldStatus !== 'completed' && newStatus === 'completed') {
            addNotification({
              type: 'success',
              title: 'Song Complete!',
              message: `"${payload.new.title || 'Your song'}" is finished! Quality: ${payload.new.quality_score || 'N/A'}`,
              action: {
                label: 'View Song',
                onClick: () => navigate('/songwriting'),
              },
            });
          }
        }
      )
      .subscribe();
    channels.push(songwritingChannel);

    // === CHART ENTRY (Song charts for the first time or improves position) ===
    // Rate limited to once every 12 hours per song/chart type
    const chartChannel = supabase
      .channel('chart-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chart_entries'
        },
        async (payload) => {
          const entry = payload.new;
          
          // Only notify for top 40 entries
          if (entry.rank > 40) return;
          
          const { data: song } = await supabase
            .from('songs')
            .select('title, user_id, band_id')
            .eq('id', entry.song_id)
            .single();
          
          const isOwner = song?.user_id === user.id || userBandIdsRef.current.includes(song?.band_id);
          
          if (isOwner && song) {
            // Check 12-hour cooldown before sending notification
            const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
            const { data: existingCooldown } = await supabase
              .from('chart_notification_cooldowns' as any)
              .select('id, last_notified_at')
              .eq('user_id', user.id)
              .eq('song_id', entry.song_id)
              .eq('chart_type', entry.chart_type)
              .gte('last_notified_at', twelveHoursAgo)
              .maybeSingle();
            
            // Skip notification if within cooldown period
            if (existingCooldown) return;
            
            // Upsert cooldown record
            await supabase
              .from('chart_notification_cooldowns' as any)
              .upsert({
                user_id: user.id,
                song_id: entry.song_id,
                chart_type: entry.chart_type,
                last_notified_at: new Date().toISOString(),
              }, { onConflict: 'user_id,song_id,chart_type' });
            
            const chartName = entry.chart_type === 'streaming' ? 'Streaming Charts' :
                            entry.chart_type === 'radio_airplay' ? 'Radio Charts' :
                            entry.chart_type === 'record_sales' ? 'Sales Charts' : 'Charts';
            
            if (entry.rank <= 10) {
              addNotification({
                type: 'achievement',
                title: `🏆 Top 10 Hit!`,
                message: `"${song.title}" is #${entry.rank} on the ${chartName}!`,
                action: {
                  label: 'View Charts',
                  onClick: () => navigate('/country-charts'),
                },
              });
            } else {
              addNotification({
                type: 'success',
                title: 'Charting!',
                message: `"${song.title}" entered the ${chartName} at #${entry.rank}!`,
                action: {
                  label: 'View Charts',
                  onClick: () => navigate('/country-charts'),
                },
              });
            }
          }
        }
      )
      .subscribe();
    channels.push(chartChannel);

    // === VIP SUBSCRIPTION CHANGES ===
    const vipChannel = supabase
      .channel('vip-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'vip_subscriptions',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const sub = payload.new;
          
          if (sub.status === 'active') {
            addNotification({
              type: 'achievement',
              title: '⭐ VIP Status Activated!',
              message: sub.subscription_type === 'trial' 
                ? 'Welcome! Your 2-month VIP trial has started.'
                : 'Thank you for becoming a VIP member!',
            });
          }
        }
      )
      .subscribe();
    channels.push(vipChannel);

    // === TWAATER NOTIFICATIONS (mentions, follows, etc.) ===
    const twaaterChannel = supabase
      .channel('twaater-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'twaater_notifications'
        },
        async (payload) => {
          const notif = payload.new;
          
          // Check if this notification is for the user's account
          const { data: account } = await supabase
            .from('twaater_accounts')
            .select('owner_id')
            .eq('id', notif.account_id)
            .single();
          
          if (account?.owner_id === user.id) {
            const typeMessages: Record<string, { title: string; message: string }> = {
              'follow': { title: 'New Follower!', message: 'Someone started following you on Twaater' },
              'like': { title: 'New Like!', message: 'Someone liked your twaat' },
              'retwaat': { title: 'Retwaated!', message: 'Someone retwaated your post' },
              'mention': { title: 'Mentioned!', message: 'You were mentioned in a twaat' },
              'reply': { title: 'New Reply!', message: 'Someone replied to your twaat' },
            };
            
            const msg = typeMessages[notif.type] || { title: 'Twaater', message: 'New activity' };
            
            addNotification({
              type: 'info',
              title: msg.title,
              message: msg.message,
              action: {
                label: 'Open Twaater',
                onClick: () => navigate('/twaater'),
              },
            });
          }
        }
      )
      .subscribe();
    channels.push(twaaterChannel);

    // === AI SONG AUDIO GENERATION COMPLETE ===
    const audioGenChannel = supabase
      .channel('audio-gen-notifications')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'songs'
        },
        (payload) => {
          const oldStatus = payload.old?.audio_generation_status;
          const newStatus = payload.new?.audio_generation_status;
          const userId = payload.new?.user_id;
          const bandId = payload.new?.band_id;
          
          const isOwner = userId === user.id || userBandIdsRef.current.includes(bandId);
          
          if (isOwner && oldStatus === 'generating' && newStatus === 'completed') {
            addNotification({
              type: 'success',
              title: '🎵 Audio Generated!',
              message: `AI audio for "${payload.new.title}" is ready to play!`,
              action: {
                label: 'Listen Now',
                onClick: () => navigate('/song-catalog'),
              },
            });
          } else if (isOwner && oldStatus === 'generating' && newStatus === 'failed') {
            addNotification({
              type: 'warning',
              title: 'Audio Generation Failed',
              message: `Could not generate audio for "${payload.new.title}". Try again later.`,
            });
          }
        }
      )
      .subscribe();
    channels.push(audioGenChannel);

    return () => {
      channels.forEach(channel => supabase.removeChannel(channel));
    };
  }, [user?.id, addNotification, navigate]);
};
