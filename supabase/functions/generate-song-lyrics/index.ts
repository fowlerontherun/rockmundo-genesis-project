import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Massively expanded variation options for unique lyrics
const perspectives = [
  'first person singular (I) - intimate confession',
  'first person plural (we) - collective experience', 
  'second person intimate (you) - direct address to lover',
  'second person accusatory (you) - confrontational',
  'third person observer - watching from outside',
  'third person omniscient - knowing all thoughts',
  'collective voice - speaking for a generation',
  'inner dialogue - arguing with self',
  'letter format - writing to someone',
  'stream of consciousness - unfiltered thoughts',
  'narrator watching younger self - reflection',
  'conversation between two people'
];

const tones = [
  'introspective', 'energetic', 'melancholic', 'rebellious', 
  'romantic', 'nostalgic', 'hopeful', 'dark', 'playful',
  'sarcastic', 'bitter', 'euphoric', 'anxious', 'defiant',
  'wistful', 'manic', 'contemplative', 'aggressive', 'tender',
  'desperate', 'triumphant', 'haunted', 'absurdist', 'raw',
  'detached', 'passionate', 'ironic', 'sincere', 'vengeful',
  'peaceful', 'chaotic', 'dreamlike', 'gritty', 'surreal'
];

const narrativeStyles = [
  'story-driven with clear beginning/middle/end',
  'emotion-focused impressionistic fragments',
  'heavy metaphor and symbolism throughout',
  'direct and confrontational statements',
  'abstract imagery and surreal connections',
  'cinematic scene descriptions',
  'conversational and casual',
  'poetic and literary',
  'confessional diary entry style',
  'reportage/documentary observation',
  'mythological/allegory',
  'slice of life vignettes'
];

const lyricalTechniques = [
  'heavy visual imagery - paint pictures',
  'simple and direct - no metaphors',
  'extended metaphor - one central image throughout',
  'dialogue-based - voices speaking',
  'stream of consciousness - flowing thoughts',
  'repetition and mantra - hypnotic phrases',
  'wordplay and double meanings',
  'contrast and juxtaposition',
  'questions and answers',
  'list-style enumeration',
  'sensory overload - all five senses',
  'minimalist - few words, big impact'
];

const timePeriods = [
  'present moment - happening now',
  'looking back on past - memory',
  'imagining future - dreams/fears',
  'timeless/universal - any era',
  'specific decade vibe (70s freedom, 80s excess, 90s angst, 2000s digital)',
  'childhood memories',
  'old age reflection',
  'coming of age moment'
];

const settings = [
  'urban night - city lights and streets',
  'rural countryside - fields and sky',
  'beach and ocean - waves and sand',
  'mountains and wilderness',
  'small town americana',
  'highway and open road',
  'bedroom at 3am',
  'bar or club atmosphere',
  'festival or concert crowd',
  'abstract/nowhere - pure emotion',
  'rooftop overlooking city',
  'train or bus journey',
  'airport/leaving',
  'abandoned building',
  'childhood home'
];

const narrativeArcs = [
  'fall from grace - losing everything',
  'redemption - finding way back',
  'unrequited love - wanting what you cannot have',
  'coming of age - growing up moment',
  'revenge and justice',
  'escape and freedom',
  'discovery and revelation',
  'acceptance and peace',
  'confrontation and conflict',
  'celebration and joy',
  'grief and loss',
  'addiction and struggle',
  'forbidden love',
  'self-destruction',
  'rebirth and renewal'
];

const hookTypes = [
  'rhetorical question hook - make them think',
  'bold statement hook - declarative power',
  'vivid imagery hook - unforgettable picture',
  'emotional confession hook - raw vulnerability',
  'story teaser hook - what happens next',
  'rhythmic/phonetic hook - sounds great to sing',
  'contradiction hook - unexpected pairing',
  'call to action hook - lets do this'
];

// Song structures mapped by style
const songStructures: Record<string, { name: string; structure: string; description: string }> = {
  'standard': {
    name: 'Standard Pop',
    structure: '[Verse 1] (8 lines) → [Pre-Chorus] (2-4 lines) → [Chorus] (6 lines) → [Verse 2] (8 lines) → [Chorus] → [Bridge] (4 lines) → [Final Chorus]',
    description: 'Classic radio-friendly structure with clear hooks'
  },
  'verse-heavy': {
    name: 'Verse-Heavy Ballad',
    structure: '[Verse 1] (8 lines) → [Verse 2] (8 lines) → [Chorus] (4 lines) → [Verse 3] (8 lines) → [Chorus] → [Outro] (2 lines)',
    description: 'Story-focused with emphasis on verses, smaller chorus'
  },
  'chorus-first': {
    name: 'Chorus-First Pop',
    structure: '[Chorus] (6 lines) → [Verse 1] (6 lines) → [Chorus] → [Verse 2] (6 lines) → [Chorus] → [Bridge] (4 lines) → [Final Chorus]',
    description: 'Hook-heavy, chorus leads the song'
  },
  'minimal': {
    name: 'Minimal/Stripped',
    structure: '[Verse 1] (6 lines) → [Chorus] (4 lines) → [Verse 2] (6 lines) → [Chorus]',
    description: 'Short and focused, no fat'
  },
  'epic': {
    name: 'Epic/Arena',
    structure: '[Intro] (2 lines spoken/sung) → [Verse 1] (8 lines) → [Pre-Chorus] (4 lines) → [Chorus] (8 lines) → [Verse 2] (8 lines) → [Pre-Chorus] → [Chorus] → [Bridge] (6 lines) → [Instrumental Break] (describe mood) → [Final Chorus with variations] → [Outro] (4 lines)',
    description: 'Big, anthemic, meant for stadiums'
  },
  'story-arc': {
    name: 'Narrative Story',
    structure: '[Intro/Setting] (4 lines) → [Verse 1: Setup] (8 lines) → [Verse 2: Conflict] (8 lines) → [Chorus: Theme] (6 lines) → [Verse 3: Climax] (8 lines) → [Resolution] (6 lines)',
    description: 'Clear narrative with beginning, middle, end'
  },
  'hip-hop': {
    name: 'Hip-Hop/Rap',
    structure: '[Hook] (4 lines) → [Verse 1] (16 lines) → [Hook] → [Verse 2] (16 lines) → [Hook] → [Bridge/Breakdown] (8 lines) → [Hook]',
    description: 'Hook-based with long dense verses'
  },
  'folk-ballad': {
    name: 'Folk Ballad',
    structure: '[Verse 1] (8 lines) → [Verse 2] (8 lines) → [Chorus] (4 lines) → [Verse 3] (8 lines) → [Verse 4] (8 lines) → [Final Chorus]',
    description: 'Traditional storytelling, many verses'
  },
  'punk': {
    name: 'Punk/Hardcore',
    structure: '[Verse] (6 lines, fast) → [Chorus] (4 lines, shouted) → [Verse] (6 lines) → [Chorus] → [Breakdown] (4 lines) → [Final Chorus]',
    description: 'Short, fast, aggressive, to the point'
  },
  'electronic': {
    name: 'Electronic/Dance',
    structure: '[Build] (4 lines) → [Drop/Chorus] (4 lines, repetitive) → [Verse] (6 lines) → [Build] → [Drop/Chorus] → [Breakdown] (4 lines) → [Final Drop]',
    description: 'Build-drop dynamics, repetitive hooks'
  },
  'rnb': {
    name: 'R&B/Soul',
    structure: '[Verse 1] (8 lines, smooth) → [Pre-Chorus] (4 lines) → [Chorus] (8 lines) → [Verse 2] (8 lines) → [Chorus] → [Bridge] (6 lines, ad-libs) → [Chorus with runs/ad-libs]',
    description: 'Smooth verses, emotional chorus, room for vocal runs'
  },
  'metal': {
    name: 'Metal/Heavy',
    structure: '[Intro Riff] (describe mood) → [Verse 1] (8 lines, growled or sung) → [Pre-Chorus] (4 lines) → [Chorus] (6 lines) → [Verse 2] (8 lines) → [Chorus] → [Breakdown] (heavy, 4 lines) → [Solo Section] → [Final Chorus]',
    description: 'Heavy, with breakdown and solo sections'
  },
  'jazz': {
    name: 'Jazz/Lounge',
    structure: '[Verse 1] (8 lines, conversational) → [Chorus] (6 lines) → [Verse 2] (8 lines) → [Instrumental] → [Verse 3] (6 lines) → [Outro] (2 lines)',
    description: 'Sophisticated, conversational, room for improv'
  },
  'country': {
    name: 'Country Storyteller',
    structure: '[Verse 1] (8 lines, scene setting) → [Chorus] (6 lines) → [Verse 2] (8 lines, story develops) → [Chorus] → [Bridge] (4 lines, reflection) → [Final Verse] (4 lines) → [Chorus]',
    description: 'Story-driven with relatable themes'
  },
  'blues': {
    name: 'Blues AAB',
    structure: '[Verse 1 AAB] (3 lines, repeat first line) → [Verse 2 AAB] → [Verse 3 AAB] → [Turnaround] (2 lines) → [Verse 4 AAB] → [Outro]',
    description: 'Traditional blues structure with repeated lines'
  }
};

// Genre to structure mapping
const genreStructureMap: Record<string, string[]> = {
  'Rock': ['standard', 'epic', 'punk', 'verse-heavy'],
  'Pop': ['standard', 'chorus-first', 'minimal', 'rnb'],
  'Hip Hop': ['hip-hop', 'minimal'],
  'Hip-Hop': ['hip-hop', 'minimal'],
  'Jazz': ['jazz', 'verse-heavy', 'minimal'],
  'Blues': ['blues', 'verse-heavy', 'folk-ballad'],
  'Country': ['country', 'folk-ballad', 'verse-heavy'],
  'Reggae': ['verse-heavy', 'standard', 'minimal'],
  'Heavy Metal': ['metal', 'epic', 'punk'],
  'Classical': ['epic', 'story-arc', 'verse-heavy'],
  'Electronica': ['electronic', 'minimal', 'chorus-first'],
  'EDM': ['electronic', 'minimal', 'chorus-first'],
  'Latin': ['standard', 'chorus-first', 'rnb'],
  'World Music': ['folk-ballad', 'verse-heavy', 'story-arc'],
  'R&B': ['rnb', 'standard', 'chorus-first'],
  'Punk Rock': ['punk', 'minimal'],
  'Flamenco': ['story-arc', 'verse-heavy', 'folk-ballad'],
  'African Music': ['verse-heavy', 'standard', 'story-arc'],
  'Modern Rock': ['standard', 'epic', 'verse-heavy'],
  'Trap': ['hip-hop', 'minimal', 'electronic'],
  'Drill': ['hip-hop', 'minimal'],
  'Lo-Fi Hip Hop': ['minimal', 'verse-heavy', 'hip-hop'],
  'K-Pop/J-Pop': ['chorus-first', 'standard', 'electronic'],
  'Afrobeats/Amapiano': ['electronic', 'standard', 'minimal'],
  'Synthwave': ['electronic', 'epic', 'standard'],
  'Indie/Bedroom Pop': ['minimal', 'verse-heavy', 'standard'],
  'Hyperpop': ['electronic', 'chorus-first', 'minimal'],
  'Metalcore/Djent': ['metal', 'epic', 'punk'],
  'Alt R&B/Neo-Soul': ['rnb', 'minimal', 'jazz'],
  'Folk': ['folk-ballad', 'verse-heavy', 'story-arc'],
  'Soul': ['rnb', 'verse-heavy', 'standard'],
  'Indie': ['minimal', 'verse-heavy', 'standard'],
  'Metal': ['metal', 'epic', 'punk']
};

// Genre-specific style guidance
const genreStyles: Record<string, string> = {
  'Rock': 'powerful vocals, guitar-driven energy, anthemic choruses, raw emotion',
  'Pop': 'catchy hooks, melodic verses, radio-friendly chorus, modern production feel',
  'Hip Hop': 'rhythmic flow, wordplay, internal rhymes, swagger and confidence',
  'Hip-Hop': 'rhythmic flow, wordplay, internal rhymes, swagger and confidence',
  'Country': 'narrative storytelling, down-to-earth imagery, relatable struggles, twang',
  'Jazz': 'sophisticated wordplay, smooth phrasing, improvisational feel, clever turns',
  'Blues': 'emotional depth, call and response, life struggles, repetition for emphasis',
  'Electronic': 'repetitive hooks, atmospheric phrases, modern themes, build and release',
  'Electronica': 'repetitive hooks, atmospheric phrases, modern themes, build and release',
  'EDM': 'simple powerful phrases, build-up energy, drop impact, festival singalong',
  'Folk': 'acoustic storytelling, traditional themes, poetic simplicity, wisdom',
  'Metal': 'intense imagery, aggressive themes, complex vocabulary, epic scope',
  'Heavy Metal': 'intense imagery, aggressive themes, darkness, power and defiance',
  'R&B': 'smooth vocals, emotional vulnerability, intimate themes, sensuality',
  'Indie': 'unconventional structures, artistic expression, personal narratives, quirky',
  'Indie/Bedroom Pop': 'lo-fi aesthetic, vulnerable confessions, bedroom intimacy',
  'Reggae': 'laid-back flow, social commentary, positive vibes, consciousness',
  'Punk Rock': 'raw energy, rebellious themes, direct messages, anti-establishment',
  'Classical': 'poetic language, classical themes, operatic style, timeless',
  'Soul': 'emotional authenticity, gospel influence, powerful delivery, heart',
  'Trap': 'hard-hitting flow, street themes, ad-libs, dark bass energy',
  'Drill': 'aggressive flow, street reality, dark themes, sliding hi-hats energy',
  'Lo-Fi Hip Hop': 'chill vibes, nostalgic themes, relaxed flow, rainy day mood',
  'K-Pop/J-Pop': 'catchy hooks, emotional intensity, fan connection, choreography feel',
  'Afrobeats/Amapiano': 'infectious rhythm, celebration, dance energy, African roots',
  'Synthwave': 'retro-futuristic imagery, 80s nostalgia, neon dreams, night drives',
  'Hyperpop': 'chaotic energy, distorted vocals, internet culture, genre-breaking',
  'Metalcore/Djent': 'heavy breakdowns, emotional screams, technical precision',
  'Alt R&B/Neo-Soul': 'experimental production, vulnerable lyrics, genre fusion'
};

// Banned clichés to avoid
const bannedPhrases = [
  'heart on my sleeve', 'time will tell', 'love is blind', 'break my heart',
  'light of my life', 'meant to be', 'forever and ever', 'stand by your side',
  'take my breath away', 'lost without you', 'piece of my heart', 'world on fire',
  'never let go', 'burning bridges', 'tears fall like rain', 'dark before dawn',
  'rise and fall', 'walls came down', 'fight for love', 'follow your heart',
  'dancing in the rain', 'stars in your eyes', 'fly so high', 'touch the sky'
];

// Surprise requirements to add uniqueness
const surpriseRequirements = [
  'mention a specific color in an unusual way',
  'include a reference to a time of day',
  'use a food or drink as a metaphor',
  'include a specific number',
  'reference a mode of transportation',
  'mention a piece of clothing',
  'include an animal metaphor',
  'reference a specific place or city name',
  'use a weather element symbolically',
  'include a body part in an unexpected metaphor',
  'reference technology or a device',
  'mention a childhood memory or toy',
  'include an architectural element',
  'reference a musical instrument',
  'use a sports metaphor'
];

function getRandomItems<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    
    // ============ INPUT VALIDATION ============
    const title = typeof body.title === 'string' ? body.title.slice(0, 200).trim() : '';
    const genre = typeof body.genre === 'string' ? body.genre.slice(0, 100).trim() : '';
    
    if (!title || !genre) {
      return new Response(
        JSON.stringify({ error: 'Title and genre are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sanitize theme
    let theme = body.theme;
    if (typeof theme === 'string') {
      theme = theme.slice(0, 500).trim();
    } else if (typeof theme === 'object' && theme !== null) {
      theme = {
        name: typeof theme.name === 'string' ? theme.name.slice(0, 200).trim() : undefined,
        mood: typeof theme.mood === 'string' ? theme.mood.slice(0, 100).trim() : undefined,
        description: typeof theme.description === 'string' ? theme.description.slice(0, 500).trim() : undefined,
      };
    } else {
      theme = null;
    }

    // Sanitize chord progression
    let chordProgression = body.chordProgression;
    if (typeof chordProgression === 'string') {
      chordProgression = chordProgression.slice(0, 200).trim();
    } else if (typeof chordProgression === 'object' && chordProgression !== null) {
      chordProgression = {
        name: typeof chordProgression.name === 'string' ? chordProgression.name.slice(0, 200).trim() : undefined,
        progression: typeof chordProgression.progression === 'string' ? chordProgression.progression.slice(0, 200).trim() : undefined,
      };
    } else {
      chordProgression = null;
    }

    // Sanitize existing lyrics
    const existingLyrics = typeof body.existingLyrics === 'string' ? body.existingLyrics.slice(0, 5000).trim() : '';

    // Sanitize creative brief
    let creativeBrief = null;
    if (typeof body.creativeBrief === 'object' && body.creativeBrief !== null) {
      const cb = body.creativeBrief;
      creativeBrief = {
        inspirationModifiers: Array.isArray(cb.inspirationModifiers) 
          ? cb.inspirationModifiers.filter((m: unknown) => typeof m === 'string').slice(0, 10).map((m: string) => m.slice(0, 50)) 
          : [],
        moodModifiers: Array.isArray(cb.moodModifiers) 
          ? cb.moodModifiers.filter((m: unknown) => typeof m === 'string').slice(0, 10).map((m: string) => m.slice(0, 50)) 
          : [],
        writingMode: typeof cb.writingMode === 'string' ? cb.writingMode.slice(0, 50) : '',
        coWriters: Array.isArray(cb.coWriters) 
          ? cb.coWriters.filter((m: unknown) => typeof m === 'string').slice(0, 10).map((m: string) => m.slice(0, 100)) 
          : [],
        sessionMusicians: Array.isArray(cb.sessionMusicians)
          ? cb.sessionMusicians.filter((m: unknown) => typeof m === 'string').slice(0, 10).map((m: string) => m.slice(0, 100))
          : [],
      };
    }
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Parse theme object if provided
    const themeName = typeof theme === 'object' ? theme?.name : theme;
    const themeMood = typeof theme === 'object' ? theme?.mood : null;
    const themeDescription = typeof theme === 'object' ? theme?.description : null;

    // Parse chord progression
    const chordName = typeof chordProgression === 'object' ? chordProgression?.name : null;
    const chordPattern = typeof chordProgression === 'object' ? chordProgression?.progression : chordProgression;

    // Generate unique creative direction
    const randomPerspective = getRandomItem(perspectives);
    const randomTone = getRandomItem(tones);
    const randomNarrativeStyle = getRandomItem(narrativeStyles);
    const randomTechnique = getRandomItem(lyricalTechniques);
    const randomTimePeriod = getRandomItem(timePeriods);
    const randomSetting = getRandomItem(settings);
    const randomArc = getRandomItem(narrativeArcs);
    const randomHookType = getRandomItem(hookTypes);
    
    // Get genre-appropriate structure
    const genreStructures = genreStructureMap[genre] || ['standard', 'verse-heavy', 'minimal'];
    const selectedStructureKey = getRandomItem(genreStructures);
    const selectedStructure = songStructures[selectedStructureKey];
    
    // Get genre style
    const genreStyle = genreStyles[genre] || 'authentic expression with genre-appropriate phrasing';

    // Get random surprise requirements
    const surprises = getRandomItems(surpriseRequirements, 2);

    // Generate unique seed for this song
    const uniqueSeed = `${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Process creative brief modifiers if available
    let modifierGuidance = '';
    let songNotesContext = '';
    
    if (creativeBrief) {
      const inspirationMods = creativeBrief.inspirationModifiers || [];
      const moodMods = creativeBrief.moodModifiers || [];
      const coWriters = creativeBrief.coWriters || [];
      const sessionMusicians = creativeBrief.sessionMusicians || [];
      const writingMode = creativeBrief.writingMode || '';
      
      // Build modifier guidance
      if (inspirationMods.includes('anthemic')) {
        modifierGuidance += '\n- Make the chorus HUGE and singable, meant for crowds';
      }
      if (inspirationMods.includes('story')) {
        modifierGuidance += '\n- Focus on storytelling with a clear narrative arc';
      }
      if (inspirationMods.includes('intimate')) {
        modifierGuidance += '\n- Keep it close and personal, like a whispered secret';
      }
      if (inspirationMods.includes('experimental')) {
        modifierGuidance += '\n- Break conventional structures, try something weird';
      }
      if (inspirationMods.includes('retro')) {
        modifierGuidance += '\n- Include nostalgic references and vintage vibes';
      }
      if (inspirationMods.includes('future')) {
        modifierGuidance += '\n- Use forward-thinking, modern imagery and themes';
      }
      if (inspirationMods.includes('city-nights')) {
        modifierGuidance += '\n- Urban nightlife imagery, city lights, streets, clubs';
      }
      
      if (moodMods.includes('moody') || moodMods.includes('dark')) {
        modifierGuidance += '\n- Use darker imagery, shadows, night, cold';
      }
      if (moodMods.includes('uplifting') || moodMods.includes('bright')) {
        modifierGuidance += '\n- Use bright imagery, warmth, light, hope';
      }
      if (moodMods.includes('urgent')) {
        modifierGuidance += '\n- Create a sense of urgency, racing pulse, time pressure';
      }
      if (moodMods.includes('intimate')) {
        modifierGuidance += '\n- Soft, personal, vulnerable emotional tone';
      }
      if (moodMods.includes('playful')) {
        modifierGuidance += '\n- Light-hearted, fun, maybe even cheeky';
      }
      
      if (writingMode === 'camp') {
        modifierGuidance += '\n- Feel collaborative, like multiple voices contributed';
      }
      if (writingMode === 'topline') {
        modifierGuidance += '\n- Focus on melody-friendly phrasing and singable hooks';
      }
      if (writingMode === 'track-led') {
        modifierGuidance += '\n- Lyrics should complement a strong production bed';
      }
      
      // Build song notes context for AI
      const noteParts: string[] = [];
      if (moodMods.length > 0) noteParts.push(`Mood palette: ${moodMods.join(', ')}`);
      if (inspirationMods.length > 0) noteParts.push(`Inspiration anchors: ${inspirationMods.join(', ')}`);
      if (coWriters.length > 0) noteParts.push(`Collaborating with: ${coWriters.join(', ')}`);
      if (sessionMusicians.length > 0) noteParts.push(`Session musicians: ${sessionMusicians.join(', ')}`);
      if (writingMode) {
        const modeLabels: Record<string, string> = {
          'solo': 'Solo writing session',
          'topline': 'Top-line focused (melody-first)',
          'track-led': 'Track-led production approach',
          'camp': 'Writing camp collaboration'
        };
        noteParts.push(`Writing mode: ${modeLabels[writingMode] || writingMode}`);
      }
      
      if (noteParts.length > 0) {
        songNotesContext = `
═══════════════════════════════════════════════════════════════
SONGWRITER'S NOTES (Use this context)
═══════════════════════════════════════════════════════════════
${noteParts.join('\n')}`;
      }
    }
    
    // Include additional notes from the user if provided
    if (existingLyrics && !existingLyrics.includes('[') && existingLyrics.length < 500) {
      // This looks like additional notes rather than lyrics
      songNotesContext += `\n\nAdditional songwriter notes:\n${existingLyrics}`;
    }

    const prompt = `You are an elite professional songwriter creating COMPLETELY UNIQUE, ORIGINAL lyrics. This song must be DISTINCTLY DIFFERENT from anything you've written before.

UNIQUE GENERATION SEED: ${uniqueSeed}
(Use this seed to ensure this song is unique - let it influence your creative choices)

═══════════════════════════════════════════════════════════════
SONG IDENTITY
═══════════════════════════════════════════════════════════════
Title: "${title}"
Genre: ${genre}
Theme: ${themeName || "Universal human experience"}
${themeMood ? `Theme Mood: ${themeMood}` : ''}
${themeDescription ? `Theme Description: ${themeDescription}` : ''}
${chordName ? `Chord Progression: ${chordName} (${chordPattern})` : chordPattern ? `Chord Feel: ${chordPattern}` : ''}

═══════════════════════════════════════════════════════════════
CREATIVE DIRECTION (Make this song UNIQUE)
═══════════════════════════════════════════════════════════════
📍 PERSPECTIVE: ${randomPerspective}
🎭 EMOTIONAL TONE: ${randomTone}
📖 NARRATIVE STYLE: ${randomNarrativeStyle}
✍️ LYRICAL TECHNIQUE: ${randomTechnique}
⏰ TIME SETTING: ${randomTimePeriod}
🏠 PHYSICAL SETTING: ${randomSetting}
📈 STORY ARC: ${randomArc}
🎣 HOOK TYPE: ${randomHookType}

═══════════════════════════════════════════════════════════════
GENRE AUTHENTICITY: ${genre}
═══════════════════════════════════════════════════════════════
Style markers: ${genreStyle}

═══════════════════════════════════════════════════════════════
SONG STRUCTURE: ${selectedStructure.name}
═══════════════════════════════════════════════════════════════
${selectedStructure.description}

Follow this structure:
${selectedStructure.structure}
${modifierGuidance}
${songNotesContext}

═══════════════════════════════════════════════════════════════
UNIQUENESS REQUIREMENTS
═══════════════════════════════════════════════════════════════
1. Create a CENTRAL METAPHOR or IMAGE unique to this song that runs throughout
2. Write from the exact ${randomPerspective} perspective consistently
3. Maintain the ${randomTone} emotional tone throughout
4. Use SPECIFIC, CONCRETE DETAILS (names, places, objects, times)
5. Include sensory details (sights, sounds, textures, smells, tastes)
6. Create an UNFORGETTABLE HOOK using the ${randomHookType} approach
7. Vary line lengths and rhythmic patterns within verses
8. Include at least 2 SURPRISING word choices or unexpected phrases

SURPRISE REQUIREMENTS (include these naturally):
- ${surprises[0]}
- ${surprises[1]}

BANNED CLICHÉS (DO NOT USE):
${bannedPhrases.slice(0, 12).join(', ')}

═══════════════════════════════════════════════════════════════
FORMAT
═══════════════════════════════════════════════════════════════
Use clear section labels: [Verse 1], [Pre-Chorus], [Chorus], [Verse 2], [Bridge], [Outro], etc.
Match line counts to the structure specified above.

${existingLyrics ? `\n═══════════════════════════════════════════════════════════════\nEXISTING LYRICS TO BUILD ON/COMPLEMENT:\n═══════════════════════════════════════════════════════════════\n${existingLyrics}\n\nBuild on these themes and style while completing the song.` : ''}

NOW CREATE COMPLETELY UNIQUE, MEMORABLE LYRICS THAT COULD ONLY BE THIS SONG:`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { 
            role: 'system', 
            content: `You are an award-winning songwriter known for creating DISTINCTIVE, ORIGINAL lyrics that never repeat the same ideas or phrases across songs.

Your lyrics are famous for:
- Unique central metaphors that carry through the entire song
- Specific concrete details instead of vague generalities
- Unexpected word combinations that surprise listeners
- Emotional authenticity that feels lived-in
- Genre-appropriate language and rhythm
- Hooks that get stuck in people's heads

You NEVER use clichéd phrases. Every song you write is completely different from the last.
You follow the requested structure precisely and format with clear section labels in brackets.
You match the specified perspective, tone, and narrative style exactly.` 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.95,
        top_p: 0.98
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const lyrics = data.choices?.[0]?.message?.content;

    if (!lyrics) {
      throw new Error('No lyrics generated');
    }

    return new Response(
      JSON.stringify({ 
        lyrics,
        metadata: {
          structure: selectedStructure.name,
          perspective: randomPerspective,
          tone: randomTone,
          setting: randomSetting,
          arc: randomArc
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-song-lyrics:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
