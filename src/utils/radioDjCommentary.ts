// Radio DJ Commentary Generator
// Creates immersive radio station experience with dynamic DJ commentary

export interface DjCommentary {
  intro: string;
  songIntro: string;
  songOutro: string;
  stationBump: string;
  weatherUpdate?: string;
  newsFlash?: string;
}

export interface DjPersonality {
  name: string;
  style: 'energetic' | 'smooth' | 'alternative' | 'classic' | 'underground';
  catchphrases: string[];
  signOff: string;
}

const DJ_PERSONALITIES: Record<string, DjPersonality> = {
  energetic: {
    name: "DJ Blaze",
    style: 'energetic',
    catchphrases: [
      "Let's turn it UP!",
      "That's what I'm talking about!",
      "Keep those requests coming in!",
      "You're listening to the hottest station in town!",
    ],
    signOff: "Stay loud, stay proud!",
  },
  smooth: {
    name: "Marcus Vibe",
    style: 'smooth',
    catchphrases: [
      "Mmm, smooth like butter...",
      "Let that sink in for a moment...",
      "Now THAT'S what real music sounds like...",
      "Keeping it real, keeping it smooth...",
    ],
    signOff: "Keep vibing with us...",
  },
  alternative: {
    name: "Luna Eclipse",
    style: 'alternative',
    catchphrases: [
      "Breaking the mold, one track at a time...",
      "You heard it here first...",
      "Not your parents' radio station...",
      "Underground sounds rising up...",
    ],
    signOff: "Stay weird, stay wonderful...",
  },
  classic: {
    name: "Big Tony",
    style: 'classic',
    catchphrases: [
      "Taking you back...",
      "A classic never dies...",
      "They don't make 'em like this anymore...",
      "Pure musical gold...",
    ],
    signOff: "Keep rockin', keep rollin'...",
  },
  underground: {
    name: "Shadow",
    style: 'underground',
    catchphrases: [
      "From the depths...",
      "You won't hear this anywhere else...",
      "Raw and unfiltered...",
      "The sound of the streets...",
    ],
    signOff: "Stay underground...",
  },
};

const SONG_INTROS = {
  high_energy: [
    "Alright alright ALRIGHT! Here's a track that's been BLOWING UP the charts!",
    "Get ready to move because this next one is FIRE!",
    "Your new favorite song coming in hot!",
    "This one's been climbing the charts all week!",
  ],
  mid_energy: [
    "Here's a fresh track for you...",
    "Next up, something I think you're gonna love...",
    "Let's slow it down just a bit with this one...",
    "A solid new track hitting the airwaves...",
  ],
  chill: [
    "Ease into this one...",
    "Let this next track wash over you...",
    "Time to relax with this smooth number...",
    "Perfect for the late night vibes...",
  ],
};

const SONG_OUTROS = {
  positive: [
    "Beautiful, just beautiful. Let me know what you think!",
    "If you liked that one, make sure to check out more from this artist!",
    "That was incredible. The talent out there is just amazing.",
    "Goosebumps! Still getting goosebumps from that one!",
  ],
  neutral: [
    "There you have it folks.",
    "That was {artist} with '{title}'.",
    "Another one in the books.",
    "Let us know if you want to hear that again!",
  ],
  hype: [
    "WOW! Did you hear that?! INCREDIBLE!",
    "I need to play that again! What a track!",
    "That's gonna be stuck in my head all day!",
    "Future classic right there, mark my words!",
  ],
};

const STATION_BUMPS = [
  "You're locked in to {station}, playing the best music 24/7!",
  "This is {station}, your home for great music!",
  "Don't touch that dial, you're listening to {station}!",
  "{station} - where the music never stops!",
  "Coming to you live from {station}!",
];

const TIME_OF_DAY_GREETINGS = {
  morning: [
    "Good morning to all you early birds out there!",
    "Rise and shine! Time to start your day right!",
    "Morning crew, let's get this day started!",
  ],
  afternoon: [
    "Good afternoon! Hope your day's going well!",
    "Afternoon vibes coming your way!",
    "Midday music to get you through!",
  ],
  evening: [
    "Good evening, night owls!",
    "Evening has arrived, time to unwind!",
    "Winding down with the evening show!",
  ],
  night: [
    "Late night listeners, this one's for you!",
    "The night shift, keeping you company!",
    "When the city sleeps, the music plays on!",
  ],
};

export function getDjForStation(stationType: string): DjPersonality {
  const styleMap: Record<string, string> = {
    'pop': 'energetic',
    'rock': 'classic',
    'alternative': 'alternative',
    'electronic': 'underground',
    'jazz': 'smooth',
    'classical': 'smooth',
    'hip_hop': 'underground',
    'indie': 'alternative',
    'metal': 'classic',
    'country': 'classic',
  };
  
  const style = styleMap[stationType.toLowerCase()] || 'energetic';
  return DJ_PERSONALITIES[style];
}

export function generateSongIntro(
  songTitle: string,
  artistName: string,
  genre: string,
  qualityScore: number,
  isNewRelease: boolean = false
): string {
  const energyLevel = qualityScore > 75 ? 'high_energy' : qualityScore > 50 ? 'mid_energy' : 'chill';
  const intros = SONG_INTROS[energyLevel];
  const intro = intros[Math.floor(Math.random() * intros.length)];
  
  let prefix = '';
  if (isNewRelease) {
    prefix = "BRAND NEW MUSIC ALERT! ";
  }
  
  return `${prefix}${intro} This is "${songTitle}" by ${artistName}!`;
}

export function generateSongOutro(
  songTitle: string,
  artistName: string,
  listenerReaction: 'positive' | 'neutral' | 'hype'
): string {
  const outros = SONG_OUTROS[listenerReaction];
  let outro = outros[Math.floor(Math.random() * outros.length)];
  
  // Replace placeholders
  outro = outro.replace('{artist}', artistName).replace('{title}', songTitle);
  
  return outro;
}

export function generateStationBump(stationName: string): string {
  const bump = STATION_BUMPS[Math.floor(Math.random() * STATION_BUMPS.length)];
  return bump.replace('{station}', stationName);
}

export function generateTimeGreeting(): string {
  const hour = new Date().getHours();
  let timeOfDay: keyof typeof TIME_OF_DAY_GREETINGS;
  
  if (hour >= 5 && hour < 12) timeOfDay = 'morning';
  else if (hour >= 12 && hour < 17) timeOfDay = 'afternoon';
  else if (hour >= 17 && hour < 21) timeOfDay = 'evening';
  else timeOfDay = 'night';
  
  const greetings = TIME_OF_DAY_GREETINGS[timeOfDay];
  return greetings[Math.floor(Math.random() * greetings.length)];
}

export function generateDjCommentary(
  dj: DjPersonality,
  stationName: string,
  currentSong: { title: string; artist: string; genre: string; quality: number },
  previousSong?: { title: string; artist: string }
): DjCommentary {
  const catchphrase = dj.catchphrases[Math.floor(Math.random() * dj.catchphrases.length)];
  const timeGreeting = generateTimeGreeting();
  
  return {
    intro: `${timeGreeting} This is ${dj.name} on ${stationName}. ${catchphrase}`,
    songIntro: generateSongIntro(currentSong.title, currentSong.artist, currentSong.genre, currentSong.quality),
    songOutro: previousSong 
      ? generateSongOutro(previousSong.title, previousSong.artist, currentSong.quality > 70 ? 'hype' : 'neutral')
      : '',
    stationBump: generateStationBump(stationName),
  };
}

export function generateRequestShoutout(requesterName: string, songTitle: string, artistName: string): string {
  const shoutouts = [
    `Big shoutout to ${requesterName} for requesting "${songTitle}" by ${artistName}! Here it comes!`,
    `${requesterName}, your request is up next! "${songTitle}" by ${artistName}!`,
    `We got a request from ${requesterName} - they want to hear "${songTitle}"! Let's do it!`,
    `Thanks ${requesterName} for the great taste! "${songTitle}" by ${artistName} coming right up!`,
  ];
  
  return shoutouts[Math.floor(Math.random() * shoutouts.length)];
}

export function generateChartUpdate(songTitle: string, artistName: string, position: number, movement: 'up' | 'down' | 'new' | 'stable'): string {
  const updates: Record<string, string[]> = {
    up: [
      `"${songTitle}" by ${artistName} is climbing the charts! Now at number ${position}!`,
      `Moving on up! ${artistName}'s "${songTitle}" hits number ${position}!`,
      `The people have spoken! "${songTitle}" rises to ${position}!`,
    ],
    down: [
      `"${songTitle}" by ${artistName} slides to number ${position}...`,
      `${artistName} drops to ${position} this week with "${songTitle}"...`,
    ],
    new: [
      `CHART DEBUT! "${songTitle}" by ${artistName} enters at number ${position}!`,
      `Fresh on the charts! ${artistName} makes their debut at ${position} with "${songTitle}"!`,
      `A new challenger appears! "${songTitle}" crashes in at number ${position}!`,
    ],
    stable: [
      `Holding steady at ${position}, it's "${songTitle}" by ${artistName}!`,
      `Still going strong at number ${position} - ${artistName} with "${songTitle}"!`,
    ],
  };
  
  const options = updates[movement];
  return options[Math.floor(Math.random() * options.length)];
}
