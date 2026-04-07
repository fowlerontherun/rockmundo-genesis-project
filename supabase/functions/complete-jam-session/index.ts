import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Instrument name to hierarchical skill slug mapping
// The {tier} placeholder will be replaced based on participant's current skill level
const INSTRUMENT_TO_SKILL_MAP: Record<string, string> = {
  // String instruments
  "acoustic guitar": "instruments_{tier}_acoustic_guitar",
  "electric guitar": "instruments_{tier}_electric_guitar",
  "classical guitar": "instruments_{tier}_classical_guitar",
  "bass": "instruments_{tier}_bass_guitar",
  "bass guitar": "instruments_{tier}_bass_guitar",
  "upright bass": "instruments_{tier}_upright_bass",
  "violin": "instruments_{tier}_violin",
  "viola": "instruments_{tier}_viola",
  "cello": "instruments_{tier}_cello",
  "banjo": "instruments_{tier}_banjo",
  "mandolin": "instruments_{tier}_mandolin",
  "ukulele": "instruments_{tier}_ukulele",
  "harp": "instruments_{tier}_harp",
  // Keys
  "keyboard": "instruments_{tier}_keyboard",
  "piano": "instruments_{tier}_piano",
  "synthesizer": "instruments_{tier}_synthesizer",
  "organ": "instruments_{tier}_organ",
  // Drums & Percussion
  "drums": "instruments_{tier}_drums",
  "percussion": "instruments_{tier}_percussion",
  "congas": "instruments_{tier}_congas",
  "bongos": "instruments_{tier}_bongos",
  "djembe": "instruments_{tier}_djembe",
  "cajon": "instruments_{tier}_cajon",
  // Vocals
  "vocals": "instruments_{tier}_vocals",
  "lead vocals": "instruments_{tier}_vocals",
  "backup vocals": "instruments_{tier}_backup_vocals",
  // Winds
  "saxophone": "instruments_{tier}_saxophone",
  "trumpet": "instruments_{tier}_trumpet",
  "trombone": "instruments_{tier}_trombone",
  "clarinet": "instruments_{tier}_clarinet",
  "flute": "instruments_{tier}_flute",
  // DJ
  "turntables": "instruments_{tier}_turntables",
  "dj": "instruments_{tier}_turntables",
};

// Get skill tier based on current XP
function getSkillTier(currentXp: number): string {
  if (currentXp >= 650) return "mastery";
  if (currentXp >= 250) return "professional";
  return "basic";
}

// Get the actual skill slug based on instrument and current XP
function getSkillSlug(instrument: string, currentXp: number): string {
  const template = INSTRUMENT_TO_SKILL_MAP[instrument.toLowerCase()];
  if (!template) {
    // Default to generic if instrument not found
    return `instruments_${getSkillTier(currentXp)}_${instrument.toLowerCase().replace(/\s+/g, '_')}`;
  }
  return template.replace("{tier}", getSkillTier(currentXp));
}

// Auto-generated song titles
const JAM_SONG_PREFIXES = [
  "Midnight", "Electric", "Groove", "Sunset", "Urban", "Cosmic", "Velvet",
  "Neon", "Crystal", "Thunder", "Golden", "Silver", "Mystic", "Wild"
];
const JAM_SONG_SUFFIXES = [
  "Jam", "Session", "Vibes", "Flow", "Rhythm", "Beat", "Groove",
  "Moment", "Dream", "Wave", "Pulse", "Echo", "Fire", "Spirit"
];

function generateSongTitle(): string {
  const prefix = JAM_SONG_PREFIXES[Math.floor(Math.random() * JAM_SONG_PREFIXES.length)];
  const suffix = JAM_SONG_SUFFIXES[Math.floor(Math.random() * JAM_SONG_SUFFIXES.length)];
  return `${prefix} ${suffix}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authorization header for user validation
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify the JWT token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get caller's profile
    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!callerProfile) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { session_id } = await req.json();

    if (!session_id) {
      return new Response(JSON.stringify({ error: 'session_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Completing jam session ${session_id} by user ${user.id}`);

    // Get session details
    const { data: session, error: sessionError } = await supabase
      .from('jam_sessions')
      .select('*')
      .eq('id', session_id)
      .single();

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify caller is the host
    if (session.host_id !== callerProfile.id) {
      return new Response(JSON.stringify({ error: 'Only the host can complete the session' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify session is active
    if (session.status !== 'active') {
      return new Response(JSON.stringify({ error: `Session is ${session.status}, must be active to complete` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get participants
    const { data: participants, error: participantsError } = await supabase
      .from('jam_session_participants')
      .select('profile_id, instrument_skill_slug')
      .eq('jam_session_id', session_id);

    if (participantsError) {
      console.error('Error fetching participants:', participantsError);
      return new Response(JSON.stringify({ error: 'Failed to fetch participants' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Include host in participants if not already
    const participantIds = participants?.map(p => p.profile_id) || [];
    if (!participantIds.includes(session.host_id)) {
      participantIds.push(session.host_id);
    }

    const participantCount = participantIds.length;
    console.log(`Session has ${participantCount} participants`);

    // Calculate session duration (in minutes)
    const startedAt = session.started_at ? new Date(session.started_at) : new Date(session.created_at);
    const now = new Date();
    const durationMinutes = Math.max(10, Math.min(120, Math.floor((now.getTime() - startedAt.getTime()) / 60000)));
    console.log(`Session duration: ${durationMinutes} minutes`);

    // Get unique instruments for synergy calculation
    const uniqueInstruments = new Set<string>();
    for (const p of participants || []) {
      if (p.instrument_skill_slug) {
        uniqueInstruments.add(p.instrument_skill_slug);
      }
    }
    const instrumentDiversity = Math.max(1, uniqueInstruments.size);

    // Calculate synergy and mood scores
    let baseSynergy = 50 + (instrumentDiversity * 10);
    let synergyScore = Math.min(100, baseSynergy + Math.floor(Math.random() * 15));
    let moodScore = session.mood_score || Math.min(100, 50 + Math.floor(durationMinutes / 3) + Math.floor(Math.random() * 20));

    // === NPC CAMEO ROLL ===
    // 15% base chance for an NPC to appear, genre match increases odds
    let npcMentor: any = null;
    const npcRoll = Math.random();
    const npcBaseChance = 0.15;
    
    if (npcRoll < npcBaseChance) {
      // Fetch active NPC mentors
      const { data: mentors } = await supabase
        .from('jam_npc_mentors')
        .select('*')
        .eq('is_active', true);

      if (mentors && mentors.length > 0) {
        // Weighted selection: genre-matching NPCs get 3x weight, rarity affects weight
        const rarityWeights: Record<string, number> = { common: 4, uncommon: 3, rare: 2, legendary: 1 };
        const weighted = mentors.map(m => ({
          ...m,
          weight: (rarityWeights[m.rarity] || 2) * (m.genre_affinity?.toLowerCase() === session.genre?.toLowerCase() ? 3 : 1),
        }));
        const totalWeight = weighted.reduce((s, m) => s + m.weight, 0);
        let pick = Math.random() * totalWeight;
        for (const m of weighted) {
          pick -= m.weight;
          if (pick <= 0) { npcMentor = m; break; }
        }
        if (!npcMentor) npcMentor = weighted[0];

        console.log(`NPC Cameo: ${npcMentor.name} (${npcMentor.rarity}) — buff: ${npcMentor.buff_type} +${npcMentor.buff_value}`);

        // Apply NPC buff to session scores
        if (npcMentor.buff_type === 'mood_boost') {
          moodScore = Math.min(100, moodScore + Number(npcMentor.buff_value));
        } else if (npcMentor.buff_type === 'synergy_boost') {
          synergyScore = Math.min(100, synergyScore + Number(npcMentor.buff_value));
        }
      }
    }

    console.log(`Synergy: ${synergyScore}, Mood: ${moodScore}, NPC: ${npcMentor?.name || 'none'}`);

    // Calculate XP rewards
    // Base: 25 XP per 10 minutes (max 2 hours = 300 XP base)
    const timeSlots = Math.floor(durationMinutes / 10);
    const baseXp = Math.min(12, timeSlots) * 25; // Cap at 300 XP

    // Bonuses
    const synergyBonus = Math.floor(baseXp * (instrumentDiversity * 0.10)); // +10% per unique instrument
    const moodBonus = moodScore >= 85 ? Math.floor(baseXp * 0.25) : moodScore >= 70 ? Math.floor(baseXp * 0.15) : 0;
    const participantBonus = Math.floor(baseXp * ((participantCount - 1) * 0.05)); // +5% per additional player
    // NPC XP boost
    const npcXpBonus = npcMentor?.buff_type === 'xp_boost' ? Math.floor(baseXp * Number(npcMentor.buff_value)) : 0;

    const totalXpPerPlayer = baseXp + synergyBonus + moodBonus + participantBonus + npcXpBonus;
    console.log(`XP calculation: base=${baseXp}, synergy=${synergyBonus}, mood=${moodBonus}, participants=${participantBonus}, npc=${npcXpBonus}, total=${totalXpPerPlayer}`);

    // Calculate skill XP gain
    // 5 skill XP per 10 minutes, tier multipliers
    const baseSkillXp = Math.floor(durationMinutes / 10) * 5;
    // NPC skill XP boost multiplier
    const npcSkillXpMultiplier = npcMentor?.buff_type === 'skill_xp_boost' ? 1 + Number(npcMentor.buff_value) : 1;

    // Gifted song calculation
    // Base 0.75% + modifiers
    let giftedSongChance = 0.0075;
    giftedSongChance += Math.max(0, (participantCount - 2)) * 0.0025; // +0.25% per player above 2
    if (synergyScore >= 80) giftedSongChance += 0.005; // +0.5% if high synergy
    if (moodScore >= 80) giftedSongChance += 0.0025; // +0.25% if good mood
    // NPC gift chance boost
    if (npcMentor?.buff_type === 'gift_chance_boost') {
      giftedSongChance += Number(npcMentor.buff_value);
    }
    const maxChance = 0.035; // Cap at 3.5%
    giftedSongChance = Math.min(maxChance, giftedSongChance);

    console.log(`Gifted song chance: ${(giftedSongChance * 100).toFixed(2)}%`);

    // Roll for gifted song
    const songRoll = Math.random();
    let giftedSongId: string | null = null;
    let giftedSongRecipientId: string | null = null;

    if (songRoll < giftedSongChance) {
      // Pick a random recipient
      const recipientIdx = Math.floor(Math.random() * participantIds.length);
      giftedSongRecipientId = participantIds[recipientIdx];

      // Check weekly limit (1 per participant per week)
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const { count: weeklyGiftCount } = await supabase
        .from('jam_gifted_song_log')
        .select('*', { count: 'exact', head: true })
        .eq('profile_id', giftedSongRecipientId)
        .gte('created_at', oneWeekAgo.toISOString());

      if ((weeklyGiftCount || 0) < 1) {
        // Create the gifted song
        const songTitle = generateSongTitle();
        const songQuality = 40 + Math.floor(Math.random() * 31); // 40-70

        const { data: newSong, error: songError } = await supabase
          .from('songs')
          .insert({
            title: songTitle,
            genre: session.genre,
            tempo: session.tempo,
            quality_score: songQuality,
            status: 'demo',
            duration_seconds: 180 + Math.floor(Math.random() * 120), // 3-5 minutes
            lyrics: null,
          })
          .select('id')
          .single();

        if (!songError && newSong) {
          giftedSongId = newSong.id;
          console.log(`Created gifted song: ${songTitle} (ID: ${giftedSongId})`);

          // Log the gift
          await supabase.from('jam_gifted_song_log').insert({
            profile_id: giftedSongRecipientId,
            session_id: session_id,
            song_id: giftedSongId,
          });
        }
      } else {
        console.log(`Recipient ${giftedSongRecipientId} already received a gifted song this week`);
      }
    }

    // Process outcomes for each participant
    const outcomes = [];
    let totalXpAwarded = 0;

    for (const participantId of participantIds) {
      // Find participant record
      const participantRecord = participants?.find(p => p.profile_id === participantId);
      const instrumentSkillSlug = participantRecord?.instrument_skill_slug || 'instruments_basic_acoustic_guitar';

      // Get current skill XP for tier calculation
      const { data: skillProgress } = await supabase
        .from('skill_progress')
        .select('current_xp')
        .eq('profile_id', participantId)
        .eq('skill_slug', instrumentSkillSlug)
        .single();

      const currentSkillXp = skillProgress?.current_xp || 0;
      const tier = getSkillTier(currentSkillXp);
      
      // Tier multiplier for skill XP
      const tierMultiplier = tier === 'mastery' ? 1.4 : tier === 'professional' ? 1.2 : 1.0;
      const skillXpGained = Math.floor(baseSkillXp * tierMultiplier * npcSkillXpMultiplier);

      // Chemistry gain (for bands)
      const chemistryGained = Math.floor(durationMinutes / 15) * 2; // 2 chemistry per 15 mins

      // Performance rating (50-100 based on various factors)
      const performanceRating = Math.min(100, 50 + Math.floor(synergyScore / 3) + Math.floor(moodScore / 5));

      // Is this participant the gifted song recipient?
      const isGiftedRecipient = giftedSongId && participantId === giftedSongRecipientId;

      // Insert outcome
      const { data: outcome, error: outcomeError } = await supabase
        .from('jam_session_outcomes')
        .insert({
          session_id: session_id,
          participant_id: participantId,
          xp_earned: totalXpPerPlayer,
          chemistry_gained: chemistryGained,
          skill_slug: instrumentSkillSlug,
          skill_xp_gained: skillXpGained,
          gifted_song_id: isGiftedRecipient ? giftedSongId : null,
          performance_rating: performanceRating,
        })
        .select()
        .single();

      if (outcomeError) {
        console.error(`Error inserting outcome for ${participantId}:`, outcomeError);
      } else {
        outcomes.push(outcome);
      }

      // Award XP to profile
      const { error: rpcError } = await supabase.rpc('increment_profile_xp', { 
        profile_id_param: participantId, 
        xp_amount: totalXpPerPlayer 
      });
      
      if (rpcError) {
        // Fallback: direct update
        const { data: profile } = await supabase
          .from('profiles')
          .select('experience')
          .eq('id', participantId)
          .single();
        
        if (profile) {
          await supabase
            .from('profiles')
            .update({ experience: (profile.experience || 0) + totalXpPerPlayer })
            .eq('id', participantId);
        }
      }

      // Award skill XP
      await supabase
        .from('skill_progress')
        .upsert({
          profile_id: participantId,
          skill_slug: instrumentSkillSlug,
          current_xp: currentSkillXp + skillXpGained,
          last_practiced_at: new Date().toISOString(),
        }, { onConflict: 'profile_id,skill_slug' });

      totalXpAwarded += totalXpPerPlayer;
      console.log(`Participant ${participantId}: +${totalXpPerPlayer} XP, +${skillXpGained} skill XP to ${instrumentSkillSlug}`);
    }

    // === JAM SESSION → BAND MORALE, REPUTATION & SENTIMENT (v1.0.991) ===
    // Good jam sessions boost band morale, reputation, and fan sentiment based on synergy
    try {
      const firstParticipantId = participantIds[0];
      if (firstParticipantId) {
        const { data: bandMember } = await supabase
          .from('band_members')
          .select('band_id')
          .eq('user_id', firstParticipantId)
          .eq('is_touring_member', false)
          .limit(1)
          .maybeSingle();

        if (bandMember?.band_id) {
          const { data: band } = await supabase
            .from('bands')
            .select('morale, reputation_score, fan_sentiment_score')
            .eq('id', bandMember.band_id)
            .single();

          if (band) {
            // Synergy 80+ = great jam, 60+ = good, below = okay
            const moraleBoost = synergyScore >= 80 ? 4 : synergyScore >= 60 ? 2 : 1;
            const repBoost = synergyScore >= 80 ? 2 : synergyScore >= 60 ? 1 : 0;
            const sentBoost = synergyScore >= 80 ? 3 : synergyScore >= 60 ? 1 : 0;

            const curMorale = (band as any).morale ?? 50;
            const curRep = (band as any).reputation_score ?? 0;
            const curSent = (band as any).fan_sentiment_score ?? 0;

            await supabase.from('bands').update({
              morale: Math.min(100, curMorale + moraleBoost),
              reputation_score: Math.min(100, curRep + repBoost),
              fan_sentiment_score: Math.min(100, curSent + sentBoost),
            } as any).eq('id', bandMember.band_id);

            console.log(`Jam session health boost: synergy ${synergyScore} → morale +${moraleBoost}, rep +${repBoost}, sentiment +${sentBoost}`);
          }
        }
      }
    } catch (moraleErr) {
      console.error('Error updating jam session health stats:', moraleErr);
    }

    // Update session status
    await supabase
      .from('jam_sessions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        total_xp_awarded: totalXpAwarded,
        mood_score: moodScore,
        synergy_score: synergyScore,
        gifted_song_id: giftedSongId,
        npc_mentor_id: npcMentor?.id || null,
        npc_mentor_name: npcMentor?.name || null,
        npc_buff_type: npcMentor?.buff_type || null,
        npc_buff_value: npcMentor ? Number(npcMentor.buff_value) : 0,
      })
      .eq('id', session_id);

    console.log(`Session ${session_id} completed. Total XP awarded: ${totalXpAwarded}`);

    return new Response(JSON.stringify({
      success: true,
      session_id,
      total_xp_awarded: totalXpAwarded,
      duration_minutes: durationMinutes,
      synergy_score: synergyScore,
      mood_score: moodScore,
      gifted_song_id: giftedSongId,
      npc_cameo: npcMentor ? {
        name: npcMentor.name,
        description: npcMentor.description,
        genre_affinity: npcMentor.genre_affinity,
        buff_type: npcMentor.buff_type,
        buff_value: Number(npcMentor.buff_value),
        rarity: npcMentor.rarity,
        avatar_emoji: npcMentor.avatar_emoji,
      } : null,
      outcomes: outcomes.map(o => ({
        participant_id: o.participant_id,
        xp_earned: o.xp_earned,
        skill_slug: o.skill_slug,
        skill_xp_gained: o.skill_xp_gained,
        chemistry_gained: o.chemistry_gained,
        performance_rating: o.performance_rating,
        received_song: o.gifted_song_id ? true : false,
      })),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error completing jam session:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});