import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { pushNotification, type NotifyCategory } from "@/lib/notify";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useNavigate } from "react-router-dom";

export const useGameEventNotifications = () => {

  const { user } = useAuth();
  const { profileId } = useActiveProfile();
  const navigate = useNavigate();
  const [subscriptionGeneration, setSubscriptionGeneration] = useState(0);
  const userBandIdsRef = useRef<{ profileId: string | null; ids: string[] }>({ profileId: null, ids: [] });
  const activeIdentityRef = useRef<{ userId: string | null; profileId: string | null }>({ userId: null, profileId: null });
  const chartInFlightRef = useRef(new Set<string>());

  // Invalidate old callbacks immediately after a character change commits.
  useLayoutEffect(() => {
    activeIdentityRef.current = { userId: user?.id ?? null, profileId: profileId ?? null };
    userBandIdsRef.current = { profileId: profileId ?? null, ids: [] };
  }, [user?.id, profileId]);

  const isCurrentBand = (bandId?: string | null) =>
    Boolean(bandId && userBandIdsRef.current.profileId === profileId && userBandIdsRef.current.ids.includes(bandId));

  const notify = (args: { category: string; type: string; title: string; message?: string; actionPath?: string; metadata?: Record<string, unknown>; eventKey?: string; accountWide?: boolean }) => {
    if (!user?.id || !profileId ||
      activeIdentityRef.current.userId !== user.id ||
      activeIdentityRef.current.profileId !== profileId) return Promise.resolve(null);
    return pushNotification({
      userId: user.id,
      profileId: args.accountWide ? null : (profileId ?? null),
      category: args.category as NotifyCategory,
      type: args.type as any,
      title: args.title,
      message: args.message,
      actionPath: args.actionPath,
      metadata: args.metadata,
      eventKey: args.eventKey,
    });
  };

  // Fetch only for the currently selected character. Ignore late responses
  // from the previously selected character after a switch/unmount.
  useEffect(() => {
    if (!user?.id || !profileId) return;
    let cancelled = false;
    const fetchBandIds = async () => {
      const { data, error } = await supabase
        .from("band_members")
        .select("band_id")
        .eq("profile_id", profileId)
        .eq("member_status", "active");
      if (cancelled || activeIdentityRef.current.userId !== user.id ||
        activeIdentityRef.current.profileId !== profileId) return;
      userBandIdsRef.current = {
        profileId,
        ids: error ? [] : (data?.map((row) => row.band_id) ?? []),
      };
    };
    void fetchBandIds();
    return () => { cancelled = true; };
  }, [user?.id, profileId]);

  useEffect(() => {
    if (!user?.id || !profileId) return;

    const channels: ReturnType<typeof supabase.channel>[] = [];
    let retryHandle: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;
    const reconcile = async () => {
      if (activeIdentityRef.current.userId !== user.id ||
          activeIdentityRef.current.profileId !== profileId) return;
      const { error } = await (supabase as any).rpc("reconcile_my_game_notifications", {
        p_profile_id: profileId,
      });
      if (error) console.error("[notifications] server reconciliation failed", error);
    };
    const retrySubscription = (status: string) => {
      if (status === "SUBSCRIBED") { void reconcile(); return; }
      if (!["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status) || stopped || retryHandle) return;
      console.warn("[notifications] Realtime channel failed:", status);
      retryHandle = setTimeout(() => {
        retryHandle = null;
        if (!stopped) setSubscriptionGeneration((current) => current + 1);
      }, 15_000);
    };
    const resume = () => {
      if (document.visibilityState === "visible") {
        void reconcile();
        setSubscriptionGeneration((current) => current + 1);
      }
    };
    const reconnect = () => {
      void reconcile();
      setSubscriptionGeneration((current) => current + 1);
    };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", reconnect);
    void reconcile();

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
          // Achievements are earned by a character, not simply an auth user.
          // Legacy unscoped events must not be attributed to the active character.
          if (!payload.new.profile_id || payload.new.profile_id !== profileId) return;
          const { data: achievement } = await supabase
            .from('achievements')
            .select('name, description, rarity')
            .eq('id', payload.new.achievement_id)
            .single();

          if (achievement) {
            notify({
              eventKey: `achievement:${payload.new.id}`,
              category: 'achievement',
              type: 'achievement',
              title: `Achievement Unlocked!`,
              message: `${achievement.name} - ${achievement.description}`,
            });
          }
        }
      )
      .subscribe(retrySubscription);
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
          const isOwner = userId === user.id || isCurrentBand(bandId);
          
          if (isOwner && oldStatus === 'manufacturing' && newStatus === 'released') {
            notify({
              eventKey: `release_manufactured:${payload.new.id}`,
              category: 'release',
              type: 'success',
              title: 'Manufacturing Complete!',
              message: `Your release "${payload.new.title}" has finished manufacturing and is now available!`,
              actionPath: '/release-manager',
            });
          }
        }
      )
      .subscribe(retrySubscription);
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
            
            const isOwner = song?.user_id === user.id || isCurrentBand(song?.band_id);
            
            if (isOwner && song) {
              notify({
              eventKey: `recording_completed:${payload.new.id}`,
              category: 'recording',
              type: 'success',
              title: 'Recording Complete!',
              message: `"${song.title}" recording session finished with quality score ${payload.new.quality_score || 'N/A'}`,
              actionPath: '/recording-studio',
            });
            }
          }
        }
      )
      .subscribe(retrySubscription);
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
          
          if (gig && isCurrentBand(gig.band_id)) {
            const rating = outcome.overall_rating || 0;
            const venueName = (gig.venues as any)?.name || 'Unknown Venue';
            
            if (rating >= 90) {
              notify({
              eventKey: `gig_outcome:${outcome.id}`,
              category: 'gig_result',
              type: 'success',
              title: '🔥 Legendary Performance!',
              message: `Your gig at ${venueName} was incredible! Rating: ${rating}%`,
              actionPath: '/gig-booking',
            });
            } else if (rating >= 70) {
              notify({
              eventKey: `gig_outcome:${outcome.id}`,
              category: 'gig_result',
              type: 'success',
              title: 'Great Show!',
              message: `Your gig at ${venueName} went well! Rating: ${rating}%`,
              actionPath: '/gig-booking',
            });
            } else if (rating < 50) {
              notify({
              eventKey: `gig_outcome:${outcome.id}`,
              category: 'gig_result',
              type: 'warning',
              title: 'Tough Crowd',
              message: `The gig at ${venueName} didn't go as planned. Rating: ${rating}%`,
              actionPath: '/gig-booking',
            });
            } else {
              notify({
              eventKey: `gig_outcome:${outcome.id}`,
              category: 'gig_result',
              type: 'info',
              title: 'Gig Complete',
              message: `Your gig at ${venueName} is finished. Rating: ${rating}%`,
            });
            }
          }
        }
      )
      .subscribe(retrySubscription);
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
          
          if (isCurrentBand(offer.band_id)) {
            const { data: venue } = await supabase
              .from('venues')
              .select('name')
              .eq('id', offer.venue_id)
              .single();
            
            notify({
              eventKey: `gig_offer:${offer.id}`,
              category: 'gig_result',
              type: 'offer',
              title: 'New Gig Offer!',
              message: `${venue?.name || 'A venue'} wants to book your band! Payout: $${offer.offered_payout || 'TBD'}`,
              actionPath: '/gig-booking',
            });
          }
        }
      )
      .subscribe(retrySubscription);
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
          
          if (isCurrentBand(sponsorship.band_id) && sponsorship.status === 'pending') {
            notify({
              eventKey: `sponsor_offer:${sponsorship.id}`,
              category: 'sponsorship',
              type: 'offer',
              title: 'Sponsorship Offer!',
              message: `A brand wants to sponsor your band! Value: $${sponsorship.contract_value || 'TBD'}`,
              actionPath: '/sponsorships',
            });
          }
        }
      )
      .subscribe(retrySubscription);
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
          
          if (isCurrentBand(participant.band_id) && participant.status === 'invited') {
            const { data: festival } = await supabase
              .from('game_events')
              .select('title')
              .eq('id', participant.event_id)
              .single();
            
            notify({
              eventKey: `festival_invite:${participant.id}`,
              category: 'offer',
              type: 'offer',
              title: 'Festival Invitation!',
              message: `You've been invited to perform at ${festival?.title || 'a festival'}!`,
              actionPath: '/festivals',
            });
          }
        }
      )
      .subscribe(retrySubscription);
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
          
          if (isCurrentBand(contract.band_id) && contract.status === 'pending') {
            const { data: label } = await supabase
              .from('labels')
              .select('name')
              .eq('id', contract.label_id)
              .single();
            
            notify({
              eventKey: `record_deal:${contract.id}`,
              category: 'record_label',
              type: 'offer',
              title: 'Record Deal Offer!',
              message: `${label?.name || 'A record label'} wants to sign your band!`,
              actionPath: '/record-labels',
            });
          }
        }
      )
      .subscribe(retrySubscription);
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
          
          notify({
              eventKey: `band_invite:${invite.id}`,
              category: 'social',
              type: 'band_invite',
              title: 'Band Invitation!',
              message: `You've been invited to join ${band?.name || 'a band'}!`,
              actionPath: '/band/members',
              metadata: { band_id: invite.band_id, band_invitation_id: invite.id },
            });
        }
      )
      .subscribe(retrySubscription);
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
          
          if (isCurrentBand(payload.new.band_id) && 
              oldStatus !== 'completed' && newStatus === 'completed') {
            notify({
              eventKey: `rehearsal_completed:${payload.new.id}`,
              category: 'gig_result',
              type: 'success',
              title: 'Rehearsal Complete!',
              message: `Your band rehearsal has finished. Chemistry +${payload.new.chemistry_gain || 0}`,
            });
          }
        }
      )
      .subscribe(retrySubscription);
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
            notify({
              eventKey: `songwriting_completed:${payload.new.id}`,
              category: 'music',
              type: 'success',
              title: 'Song Complete!',
              message: `"${payload.new.title || 'Your song'}" is finished! Quality: ${payload.new.quality_score || 'N/A'}`,
              actionPath: '/songwriting',
            });
          }
        }
      )
      .subscribe(retrySubscription);
    channels.push(songwritingChannel);

    // === CHART ENTRY (Song charts for the first time or improves position) ===
    // Server atomically creates the alert and claims the 12-hour cooldown.
    // Client-side read + upsert was not safe across multiple active tabs.
    const chartChannel = supabase
      .channel('chart-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chart_entries' },
        async (payload) => {
          const entry = payload.new;
          if (!entry?.id || typeof entry.rank !== 'number' || entry.rank > 40) return;
          if (activeIdentityRef.current.userId !== user.id ||
              activeIdentityRef.current.profileId !== profileId) return;

          const chartKey = `${profileId}:${entry.song_id}:${entry.chart_type}`;
          if (chartInFlightRef.current.has(chartKey)) return;
          chartInFlightRef.current.add(chartKey);
          try {
            await notify({
              eventKey: `chart_entry:${entry.id}`,
              category: "music",
              type: "achievement",
              title: "New Chart Entry",
              message: "Your song has entered the charts.",
              actionPath: "/charts",
            });
          } finally {
            chartInFlightRef.current.delete(chartKey);
          }
        },
      )
      .subscribe(retrySubscription);
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
            notify({
              eventKey: `vip_activation:${sub.id}`,
              accountWide: true,
              category: 'achievement',
              type: 'achievement',
              title: '⭐ VIP Status Activated!',
            });
          }
        }
      )
      .subscribe(retrySubscription);
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
          
          // Check if this notification belongs to the active persona or
          // one of their current band accounts. Twaater owner_id stores the
          // profile/band id, not the auth user id.
          const { data: account } = await supabase
            .from('twaater_accounts')
            .select('owner_type, owner_id')
            .eq('id', notif.account_id)
            .maybeSingle();

          const ownsNotificationAccount =
            (account?.owner_type === 'persona' && account.owner_id === profileId) ||
            (account?.owner_type === 'band' && isCurrentBand(account.owner_id));

          if (ownsNotificationAccount) {
            const typeMessages: Record<string, { title: string; message: string }> = {
              'follow': { title: 'New Follower!', message: 'Someone started following you on Twaater' },
              'like': { title: 'New Like!', message: 'Someone liked your twaat' },
              'retwaat': { title: 'Retwaated!', message: 'Someone retwaated your post' },
              'mention': { title: 'Mentioned!', message: 'You were mentioned in a twaat' },
              'reply': { title: 'New Reply!', message: 'Someone replied to your twaat' },
            };
            
            const msg = typeMessages[notif.type] || { title: 'Twaater', message: 'New activity' };
            
            notify({
              eventKey: `twaater_notification:${notif.id}`,
              category: 'social',
              type: 'info',
              title: msg.title,
              message: msg.message,
              actionPath: '/twaater',
            });
          }
        }
      )
      .subscribe(retrySubscription);
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
          
          const isOwner = userId === user.id || isCurrentBand(bandId);
          
          if (isOwner && oldStatus === 'generating' && newStatus === 'completed') {
            notify({
              eventKey: `audio_generated:${payload.new.id}`,
              category: 'record_label',
              type: 'success',
              title: '🎵 Audio Generated!',
              message: `AI audio for "${payload.new.title}" is ready to play!`,
              actionPath: '/song-catalog',
            });
          } else if (isOwner && oldStatus === 'generating' && newStatus === 'failed') {
            notify({
              eventKey: `audio_failed:${payload.new.id}`,
              category: 'recording',
              type: 'warning',
              title: 'Audio Generation Failed',
              message: `Could not generate audio for "${payload.new.title}". Try again later.`,
            });
          }
        }
      )
      .subscribe(retrySubscription);
    channels.push(audioGenChannel);

    return () => {
      stopped = true;
      if (retryHandle) clearTimeout(retryHandle);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", reconnect);
      channels.forEach(channel => void supabase.removeChannel(channel));
    };
  }, [user?.id, profileId, navigate, subscriptionGeneration]);
};
