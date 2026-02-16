// Enhanced commentary generator for immersive gig experience

export interface VenueContext {
  name: string;
  capacity: number;
  type?: string; // club, arena, festival, bar, etc.
  city?: string;
}

export interface SongContext {
  title: string;
  genre?: string;
  position: number;
  totalSongs: number;
  isEncore?: boolean;
  performanceScore: number;
  crowdResponse: string;
  fame?: number;
  isFanFavourite?: boolean;
}

export interface BandContext {
  name: string;
  fame: number;
  genre?: string;
}

// Venue-specific arrival commentary
export const VENUE_ARRIVALS: Record<string, string[]> = {
  club: [
    "The intimate club fills with anticipation as {band} takes the stage!",
    "In this packed club, the air is thick with excitement as the band emerges!",
    "The close quarters of {venue} erupt as {band} walks out to deafening cheers!",
    "Every inch of this club is packed - {band} is HERE!",
  ],
  arena: [
    "The massive arena EXPLODES as {band} appears on stage!",
    "Thousands of fans rise to their feet as {band} commands the arena stage!",
    "The stadium lights sweep across the crowd before settling on {band}!",
    "This sold-out arena has been waiting for this moment - {band} has arrived!",
  ],
  festival: [
    "The festival crowd stretches as far as the eye can see - {band} takes the main stage!",
    "From the photo pit to the beer tents, everyone turns to watch {band}!",
    "The festival vibes hit different as {band} opens their set under the open sky!",
    "Sun-soaked festival-goers roar as {band} kicks off their set!",
  ],
  bar: [
    "The regulars at {venue} put down their drinks as {band} starts up!",
    "In this dive bar atmosphere, {band} is about to blow the roof off!",
    "The small crowd at {venue} doesn't know they're about to witness something special!",
    "From the bar stools to the sticky floor, all eyes on {band}!",
  ],
  outdoor: [
    "Under the stars at {venue}, {band} begins their performance!",
    "The night air carries the first notes as {band} takes the outdoor stage!",
    "The open-air venue comes alive as {band} emerges!",
    "Perfect weather for a perfect show - {band} is ready!",
  ],
  default: [
    "The lights dim as {band} takes the stage to thunderous applause!",
    "A roar erupts from the crowd as {band} walks out!",
    "The venue erupts as {band} emerges from backstage!",
    "Screams fill the air as spotlights illuminate {band}!",
  ],
};

// Crowd chant variations
export const CROWD_CHANTS: Record<string, string[]> = {
  band_name: [
    "'{band}! {band}! {band}!' The crowd chants in unison!",
    "The entire venue is chanting '{band}' at the top of their lungs!",
    "A deafening '{band}!' chant echoes through the venue!",
  ],
  song_request: [
    "Fans are SCREAMING for their favorite songs!",
    "'Play {song}!' someone yells from the crowd!",
    "The crowd starts chanting for the next song!",
  ],
  encore: [
    "'ONE MORE SONG! ONE MORE SONG!' The crowd won't let them leave!",
    "The foot-stomping is DEAFENING - they want an encore!",
    "'ENCORE! ENCORE!' The venue shakes with the chant!",
    "Nobody is leaving - the encore chant reaches fever pitch!",
  ],
  appreciation: [
    "'WE LOVE YOU!' echoes from every corner of the venue!",
    "The crowd breaks into spontaneous applause mid-song!",
    "Hands in the air, the crowd shows their appreciation!",
  ],
};

// Song-specific commentary based on genre
export const GENRE_COMMENTARY: Record<string, Record<string, string[]>> = {
  rock: {
    high: [
      "The guitars are SCREAMING! This is rock and roll at its finest!",
      "Pure unadulterated ROCK energy pours from the stage!",
      "The power chords hit like a truck - the crowd is moshing!",
    ],
    medium: [
      "Classic rock vibes fill the venue as the band finds their groove",
      "The rhythm section locks in tight - this is solid rock performance",
    ],
    low: [
      "The rock riffs aren't quite landing tonight...",
      "The energy seems a bit flat for a rock show...",
    ],
  },
  metal: {
    high: [
      "ABSOLUTE BRUTALITY! The pit has ERUPTED!",
      "Headbangers unite! The metal assault is RELENTLESS!",
      "The breakdown hits and the crowd goes FERAL!",
    ],
    medium: [
      "Heavy riffs rumble through the venue",
      "The metal faithful nod approvingly",
    ],
    low: [
      "The heaviness isn't hitting like it should...",
      "Even the most dedicated headbangers look unsure...",
    ],
  },
  pop: {
    high: [
      "The pop hooks are IRRESISTIBLE - everyone is dancing!",
      "This is a certified BOP! The whole venue is vibing!",
      "Infectious energy spreads like wildfire!",
    ],
    medium: [
      "Catchy melodies fill the air as the crowd sways along",
      "The pop sensibilities are working their magic",
    ],
    low: [
      "The chorus isn't sticking like it should...",
      "The pop formula isn't quite clicking tonight...",
    ],
  },
  electronic: {
    high: [
      "The DROP hits and the crowd LOSES IT! Hands in the air!",
      "The bass is shaking EVERYTHING! This is electronic euphoria!",
      "The synths build and build until - RELEASE!",
    ],
    medium: [
      "The electronic beats have the crowd bouncing",
      "Pulsing rhythms keep the energy steady",
    ],
    low: [
      "The beats aren't connecting with the crowd...",
      "The electronic elements feel a bit disconnected...",
    ],
  },
  default: {
    high: [
      "INCREDIBLE performance! The crowd is going wild!",
      "The band is ON FIRE! Every note is perfect!",
      "This is what live music is all about!",
    ],
    medium: [
      "Solid performance keeping the crowd engaged",
      "The band is finding their rhythm",
    ],
    low: [
      "The performance isn't quite hitting the mark...",
      "The crowd seems a bit restless...",
    ],
  },
};

// Between-song banter
export const BETWEEN_SONG_BANTER: string[] = [
  "The singer addresses the crowd: 'How we doing tonight, {city}?!'",
  "Quick sip of water and a guitar tune-up before the next one",
  "The crowd cheers as the band exchanges glances and smiles",
  "'{city}, you've been absolutely AMAZING!' the vocalist shouts",
  "The drummer clicks their sticks together - 1, 2, 3, 4!",
  "A brief moment of tuning as anticipation builds",
  "The band huddles briefly before the next song",
  "'This next one goes out to everyone who's been here from day one!'",
  "The bassist lays down a teasing groove as the crowd cheers",
  "'We've got something special for you...' the frontman teases",
];

// Equipment/Technical events
export const TECHNICAL_EVENTS = {
  minor: [
    "Brief feedback squeal from the monitors - quickly fixed!",
    "The guitarist swaps to a backup - seamless transition",
    "Quick mic check between songs - all systems go",
    "The crew adjusts the lighting for the next number",
  ],
  major: [
    "OH NO! Technical difficulties! The band plays through it like pros!",
    "Power flickers for a moment - the crowd holds their breath!",
    "Guitar string SNAPS! The tech rushes in!",
    "Brief audio dropout - but they recover beautifully!",
  ],
  positive: [
    "The sound engineer is crushing it tonight - perfect mix!",
    "The lighting rig is putting on a SHOW of its own!",
    "Pyrotechnics light up the stage! BOOM!",
    "Confetti cannons EXPLODE! The crowd goes crazy!",
  ],
};

// Weather effects (for outdoor venues)
export const WEATHER_EFFECTS: Record<string, string[]> = {
  perfect: [
    "Perfect weather for a perfect show!",
    "The night sky provides the perfect backdrop",
    "Clear skies and good vibes all around",
  ],
  rain: [
    "Light rain starts to fall but NOBODY is leaving!",
    "The crowd embraces the rain - this just got more EPIC!",
    "Rain-soaked but still rocking - this is dedication!",
  ],
  hot: [
    "The heat is intense but the crowd doesn't care!",
    "Water bottles fly through the air as the heat builds",
    "Security hands out water - but nothing can cool this crowd down!",
  ],
  wind: [
    "A gust of wind catches the banners - dramatic!",
    "The wind carries the music across the festival grounds",
  ],
};

// Fame & Fan Favourite commentary
export const FAME_COMMENTARY: string[] = [
  "The crowd goes WILD — they know every word to '{song}'!",
  "'{song}' is a CERTIFIED HIT! The audience sings along from start to finish!",
  "This is the one they've been waiting for — '{song}' brings the house DOWN!",
  "The entire venue erupts as the opening notes of '{song}' ring out!",
];

export const FAN_FAVOURITE_COMMENTARY: string[] = [
  "🌟 FAN FAVOURITE! The crowd SCREAMS as '{song}' starts — this is THEIR song!",
  "🌟 '{song}' — the fans' absolute FAVOURITE! The energy is UNREAL!",
  "🌟 The chant starts before the first note: '{song}! {song}!' The fans have spoken!",
  "🌟 Pure LOVE from the crowd for '{song}' — you can feel the connection!",
];

export const ENCORE_FAME_COMMENTARY: string[] = [
  "The PERFECT encore choice — '{song}' with fame {fame}! The crowd EXPLODES!",
  "A legendary encore! '{song}' proves why it's one of their biggest hits!",
  "'{song}' as the encore — MASTERFUL! This is what legends are made of!",
];

// Special milestone moments
export const MILESTONE_MOMENTS: Record<string, string[]> = {
  first_song: [
    "Here we GO! Opening strong!",
    "The first notes ring out - the show has BEGUN!",
  ],
  halfway: [
    "We're halfway through the set and the energy is INCREDIBLE!",
    "Midway point - no signs of slowing down!",
  ],
  final_song: [
    "This is it - the FINAL song of the main set!",
    "The band announces the last song - the crowd protests!",
  ],
  encore_return: [
    "THEY'RE BACK! The encore begins!",
    "The crowd's persistence pays off - ENCORE TIME!",
  ],
  show_end: [
    "The final notes ring out... WHAT A SHOW!",
    "It's over... but this crowd won't stop cheering!",
    "An UNFORGETTABLE performance comes to an end!",
  ],
};

// Helper functions
export function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function getVenueType(capacity: number, venueName?: string): string {
  const lowerName = (venueName || '').toLowerCase();
  if (lowerName.includes('festival') || lowerName.includes('fest')) return 'festival';
  if (lowerName.includes('bar') || lowerName.includes('pub') || lowerName.includes('tavern')) return 'bar';
  if (lowerName.includes('outdoor') || lowerName.includes('park') || lowerName.includes('beach')) return 'outdoor';
  if (capacity >= 5000) return 'arena';
  if (capacity >= 500) return 'club';
  return 'bar';
}

export function generateArrivalCommentary(venue: VenueContext, band: BandContext): string {
  const venueType = getVenueType(venue.capacity, venue.name);
  const templates = VENUE_ARRIVALS[venueType] || VENUE_ARRIVALS.default;
  let template = getRandomItem(templates);
  
  return template
    .replace(/{band}/g, band.name)
    .replace(/{venue}/g, venue.name);
}

export function generateSongCommentary(song: SongContext, band: BandContext): string {
  // Fan favourite commentary (high priority)
  if (song.isFanFavourite && Math.random() < 0.7) {
    return getRandomItem(FAN_FAVOURITE_COMMENTARY)
      .replace(/{song}/g, song.title);
  }

  // Famous encore commentary
  if (song.isEncore && (song.fame || 0) >= 300 && Math.random() < 0.6) {
    return getRandomItem(ENCORE_FAME_COMMENTARY)
      .replace(/{song}/g, song.title)
      .replace(/{fame}/g, String(song.fame || 0));
  }

  // High fame commentary
  if ((song.fame || 0) >= 500 && Math.random() < 0.4) {
    return getRandomItem(FAME_COMMENTARY)
      .replace(/{song}/g, song.title);
  }

  const energyLevel = song.performanceScore >= 20 ? 'high' : song.performanceScore >= 14 ? 'medium' : 'low';
  const genre = (song.genre || band.genre || 'default').toLowerCase();
  
  const genreComments = GENRE_COMMENTARY[genre] || GENRE_COMMENTARY.default;
  const comments = genreComments[energyLevel] || genreComments.medium;
  
  return getRandomItem(comments);
}

export function generateCrowdChant(type: keyof typeof CROWD_CHANTS, band: BandContext, song?: string): string {
  const templates = CROWD_CHANTS[type];
  let template = getRandomItem(templates);
  
  return template
    .replace(/{band}/g, band.name)
    .replace(/{song}/g, song || 'that one');
}

export function generateBetweenSongBanter(city?: string): string {
  let banter = getRandomItem(BETWEEN_SONG_BANTER);
  return banter.replace(/{city}/g, city || 'everyone');
}

export function generateTechnicalEvent(isPositive: boolean = false): string {
  if (isPositive) return getRandomItem(TECHNICAL_EVENTS.positive);
  return Math.random() < 0.7 
    ? getRandomItem(TECHNICAL_EVENTS.minor)
    : getRandomItem(TECHNICAL_EVENTS.major);
}

export function generateWeatherEffect(condition: keyof typeof WEATHER_EFFECTS = 'perfect'): string {
  return getRandomItem(WEATHER_EFFECTS[condition] || WEATHER_EFFECTS.perfect);
}

export function generateMilestoneCommentary(milestone: keyof typeof MILESTONE_MOMENTS): string {
  return getRandomItem(MILESTONE_MOMENTS[milestone]);
}

// Main enhanced commentary generator
export function generateEnhancedCommentary(
  type: 'arrival' | 'song_start' | 'song_mid' | 'song_end' | 'between' | 'crowd_chant' | 'technical' | 'milestone' | 'weather',
  context: {
    venue?: VenueContext;
    band?: BandContext;
    song?: SongContext;
    city?: string;
    milestone?: keyof typeof MILESTONE_MOMENTS;
    weatherCondition?: keyof typeof WEATHER_EFFECTS;
  }
): string {
  const { venue, band, song, city, milestone, weatherCondition } = context;

  switch (type) {
    case 'arrival':
      if (venue && band) return generateArrivalCommentary(venue, band);
      break;
    case 'song_start':
    case 'song_mid':
      if (song && band) return generateSongCommentary(song, band);
      break;
    case 'between':
      return generateBetweenSongBanter(city);
    case 'crowd_chant':
      if (band) {
        const chantType = Math.random() < 0.5 ? 'band_name' : 'appreciation';
        return generateCrowdChant(chantType, band);
      }
      break;
    case 'technical':
      return generateTechnicalEvent(Math.random() < 0.6);
    case 'milestone':
      if (milestone) return generateMilestoneCommentary(milestone);
      break;
    case 'weather':
      return generateWeatherEffect(weatherCondition);
  }

  return '';
}
