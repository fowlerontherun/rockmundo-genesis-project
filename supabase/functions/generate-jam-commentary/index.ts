import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Commentary templates by event type
const COMMENTARY_TEMPLATES: Record<string, string[]> = {
  jam_start: [
    "The musicians take their positions as the jam session begins...",
    "Instruments are tuned and ready - let the music flow!",
    "The room buzzes with anticipation as the session kicks off.",
    "A gentle nod between players signals the start of something special.",
  ],
  groove_found: [
    "They've locked into a solid groove! The rhythm section is tight.",
    "There it is! The band has found their pocket.",
    "The groove clicks into place - this is what it's all about.",
    "Heads are nodding in unison as they settle into a killer groove.",
  ],
  solo_moment: [
    "{player} steps up for an impressive solo!",
    "All eyes on {player} as they take center stage.",
    "{player} tears into a blistering solo run!",
    "The spotlight is on {player} - what a moment!",
  ],
  energy_peak: [
    "The energy in the room is electric! Everyone's feeling it.",
    "This is the peak - pure musical magic happening right now!",
    "The intensity reaches a fever pitch!",
    "Goosebumps all around - this is a special moment.",
  ],
  tempo_shift: [
    "The tempo picks up as the jam intensifies...",
    "A sudden tempo change keeps everyone on their toes.",
    "The rhythm shifts - they're taking it in a new direction.",
    "Double-time! The pace quickens dramatically.",
  ],
  mood_change: [
    "A mellow interlude brings a moment of calm.",
    "The mood shifts to something more introspective...",
    "From high energy to smooth and sultry - nice transition.",
    "A beautiful change in dynamics as the music breathes.",
  ],
  chemistry_moment: [
    "Perfect synchronization between the players!",
    "That locked-in moment where everyone just KNOWS what to play next.",
    "Musical telepathy on display - they're reading each other perfectly.",
    "The chemistry is undeniable - these musicians are connected.",
  ],
  near_end: [
    "The session is winding down, but the magic lingers...",
    "Final moments of this incredible jam session.",
    "As the session nears its end, the energy remains high.",
    "One last push before the finale!",
  ],
  session_end: [
    "And that's a wrap! What an incredible jam session!",
    "The final notes fade... what a journey that was!",
    "Instruments are set down - another successful jam in the books.",
    "High fives all around as the session concludes!",
  ],
  random_positive: [
    "The vibes in the room are immaculate right now.",
    "This is exactly why musicians live for jam sessions.",
    "Pure creative expression flowing through every note.",
    "Listeners would pay good money to witness this.",
  ],
};

const EVENT_TYPES = [
  'groove_found', 'solo_moment', 'energy_peak', 
  'tempo_shift', 'mood_change', 'chemistry_moment', 'random_positive'
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateCommentary(eventType: string, playerName?: string): string {
  const templates = COMMENTARY_TEMPLATES[eventType] || COMMENTARY_TEMPLATES.random_positive;
  let commentary = pickRandom(templates);
  
  if (playerName && commentary.includes("{player}")) {
    commentary = commentary.replace(/{player}/g, playerName);
  } else if (commentary.includes("{player}")) {
    commentary = commentary.replace(/{player}/g, "A musician");
  }
  
  return commentary;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { session_id, event_type, force_event } = await req.json();

    if (!session_id) {
      return new Response(JSON.stringify({ error: 'session_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Generating commentary for session ${session_id}, event: ${event_type || 'random'}`);

    // Get session details
    const { data: session, error: sessionError } = await supabase
      .from('jam_sessions')
      .select('*, participants:jam_session_participants(profile_id, profiles:profiles(display_name, username))')
      .eq('id', session_id)
      .single();

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify session is active
    if (session.status !== 'active' && !force_event) {
      return new Response(JSON.stringify({ error: 'Session is not active' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Pick event type
    const selectedEventType = event_type || pickRandom(EVENT_TYPES);
    
    // Get participant names for solo moments
    const participantNames = session.participants?.map((p: any) => 
      p.profiles?.display_name || p.profiles?.username || 'A musician'
    ) || [];
    
    const randomPlayer = participantNames.length > 0 ? pickRandom(participantNames) : undefined;
    
    // Generate commentary
    const commentary = generateCommentary(selectedEventType, randomPlayer);
    const isImportant = ['energy_peak', 'solo_moment', 'chemistry_moment'].includes(selectedEventType);

    // Insert commentary event
    const { data: commentaryEvent, error: insertError } = await supabase
      .from('jam_session_commentary')
      .insert({
        session_id,
        event_type: selectedEventType,
        commentary,
        participant_id: selectedEventType === 'solo_moment' && session.participants?.length > 0
          ? pickRandom(session.participants).profile_id
          : null,
        is_important: isImportant,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting commentary:', insertError);
      return new Response(JSON.stringify({ error: 'Failed to insert commentary' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Generated ${selectedEventType} commentary: "${commentary}"`);

    return new Response(JSON.stringify({
      success: true,
      commentary: commentaryEvent,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error generating commentary:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
