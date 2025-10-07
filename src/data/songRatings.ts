export interface SongRating {
  min: number;
  max: number;
  label: string;
  emoji: string;
  description: string;
}

export const SONG_RATINGS: SongRating[] = [
  // 0-100: Beginner Range
  { min: 0, max: 20, label: "Rough Demo", emoji: "🎵", description: "Needs significant work" },
  { min: 21, max: 40, label: "Basic Sketch", emoji: "✏️", description: "Foundation is there" },
  { min: 41, max: 60, label: "Home Recording", emoji: "🏠", description: "Amateur but earnest" },
  { min: 61, max: 80, label: "Bedroom Demo", emoji: "🛏️", description: "Showing potential" },
  { min: 81, max: 100, label: "Practice Track", emoji: "🎹", description: "Learning the craft" },
  
  // 101-200: Developing Range
  { min: 101, max: 120, label: "Student Work", emoji: "📚", description: "Technically improving" },
  { min: 121, max: 140, label: "Garage Band Quality", emoji: "🚪", description: "Raw energy" },
  { min: 141, max: 160, label: "Coffee Shop Worthy", emoji: "☕", description: "Intimate charm" },
  { min: 161, max: 180, label: "Open Mic Ready", emoji: "🎤", description: "Crowd-friendly" },
  { min: 181, max: 200, label: "Local Favorite", emoji: "🏘️", description: "Community appeal" },
  
  // 201-300: Competent Range
  { min: 201, max: 220, label: "Decent Demo", emoji: "👍", description: "Solid foundation" },
  { min: 221, max: 240, label: "Street Performer Level", emoji: "🎸", description: "Engaging live" },
  { min: 241, max: 260, label: "Bar Gig Standard", emoji: "🍺", description: "Crowd-tested" },
  { min: 261, max: 280, label: "Festival Submission", emoji: "🎪", description: "Entry-level pro" },
  { min: 281, max: 300, label: "YouTube Cover Quality", emoji: "📹", description: "Shareable online" },
  
  // 301-400: Professional Entry
  { min: 301, max: 320, label: "SoundCloud Ready", emoji: "☁️", description: "Platform worthy" },
  { min: 321, max: 340, label: "Spotify Playlist Material", emoji: "🎧", description: "Streaming potential" },
  { min: 341, max: 360, label: "College Radio Quality", emoji: "📻", description: "Indie credibility" },
  { min: 361, max: 380, label: "Regional Radio Candidate", emoji: "📡", description: "Airplay possible" },
  { min: 381, max: 400, label: "Album Filler", emoji: "💿", description: "Deep cut quality" },
  
  // 401-500: Professional Standard
  { min: 401, max: 420, label: "Solid Album Track", emoji: "🎵", description: "Album-ready" },
  { min: 421, max: 440, label: "EP Standout", emoji: "⭐", description: "Rising quality" },
  { min: 441, max: 460, label: "B-Side Quality", emoji: "🎶", description: "Fan favorite potential" },
  { min: 461, max: 480, label: "Tour Worthy", emoji: "🚌", description: "Live setlist material" },
  { min: 481, max: 500, label: "Professional Grade", emoji: "💼", description: "Industry standard" },
  
  // 501-600: High Quality
  { min: 501, max: 520, label: "Label Interest", emoji: "🏢", description: "A&R attention" },
  { min: 521, max: 540, label: "Single Potential", emoji: "🎯", description: "Lead track candidate" },
  { min: 541, max: 560, label: "Radio-Friendly", emoji: "📻", description: "Commercial appeal" },
  { min: 561, max: 580, label: "Chart Contender", emoji: "📊", description: "Top 100 potential" },
  { min: 581, max: 600, label: "Streaming Success", emoji: "🔥", description: "Playlist magnet" },
  
  // 601-700: Hit Potential
  { min: 601, max: 620, label: "Regional Hit", emoji: "🗺️", description: "Local chart topper" },
  { min: 621, max: 640, label: "National Breakthrough", emoji: "🌟", description: "Nationwide appeal" },
  { min: 641, max: 660, label: "Top 40 Material", emoji: "🎼", description: "Radio smash" },
  { min: 661, max: 680, label: "Viral Candidate", emoji: "💥", description: "Social media hit" },
  { min: 681, max: 700, label: "Certified Banger", emoji: "🔊", description: "Undeniable hook" },
  
  // 701-800: Award Territory
  { min: 701, max: 720, label: "Award Nominee", emoji: "🏆", description: "Critical acclaim" },
  { min: 721, max: 740, label: "Festival Headliner", emoji: "🎭", description: "Main stage worthy" },
  { min: 741, max: 760, label: "Platinum Potential", emoji: "💎", description: "Sales powerhouse" },
  { min: 761, max: 780, label: "Grammy Consideration", emoji: "🎖️", description: "Elite craftsmanship" },
  { min: 781, max: 800, label: "Award Winner", emoji: "🥇", description: "Industry recognized" },
  
  // 801-900: Legendary
  { min: 801, max: 820, label: "Genre-Defining", emoji: "🎨", description: "Innovates the sound" },
  { min: 821, max: 840, label: "Cultural Impact", emoji: "🌍", description: "Transcends music" },
  { min: 841, max: 860, label: "Generational Anthem", emoji: "👥", description: "Era-defining" },
  { min: 861, max: 880, label: "Hall of Fame", emoji: "🏛️", description: "Timeless classic" },
  { min: 881, max: 900, label: "Masterwork", emoji: "🎭", description: "Artistic triumph" },
  
  // 901-1000: Immortal
  { min: 901, max: 920, label: "Instant Classic", emoji: "⚡", description: "Immediate legend status" },
  { min: 921, max: 940, label: "Once in a Decade", emoji: "⏰", description: "Rare excellence" },
  { min: 941, max: 960, label: "Revolutionary", emoji: "🚀", description: "Changes everything" },
  { min: 961, max: 980, label: "Magnum Opus", emoji: "👑", description: "Career pinnacle" },
  { min: 981, max: 1000, label: "Immortal", emoji: "♾️", description: "Perfect. Eternal." }
];

export function getSongRating(score: number): SongRating {
  const clamped = Math.max(0, Math.min(1000, score));
  return SONG_RATINGS.find(r => clamped >= r.min && clamped <= r.max) || SONG_RATINGS[0];
}
