export type NominationFocus = "song" | "album" | "live_show" | "visuals" | "innovation";

export interface AwardCategory {
  name: string;
  focus: NominationFocus;
  nominationSource: string;
  description: string;
}

export interface VotingBreakdown {
  playerWeight: number;
  npcWeight: number;
  industryJuryWeight: number;
  notes: string;
}

export interface PerformanceSlot {
  slotLabel: string;
  stage: string;
  performer: string;
  songs: [string, string];
  notes: string;
}

export interface AwardSchedule {
  nominationsOpen: string;
  shortlistAnnounced: string;
  votingWindow: string;
  rehearsalDay: string;
  ceremony: string;
}

export interface AwardRewards {
  attendanceFameBoost: string;
  winnerFameBoost: string;
  additionalPerks: string[];
}

export interface AwardShow {
  id: string;
  show_name: string;
  year: number;
  venue: string;
  district: string;
  overview: string;
  schedule: AwardSchedule;
  categories: AwardCategory[];
  voting: VotingBreakdown;
  rewards: AwardRewards;
  performanceSlots: PerformanceSlot[];
  broadcastPartners: string[];
}

export const awardShows: AwardShow[] = [
  {
    id: "2025-riverlight",
    show_name: "Riverlight Music Laurels",
    year: 2025,
    venue: "Royal Festival Hall",
    district: "Southbank, London",
    overview:
      "A spring ceremony centered around narrative-driven performances that mix orchestral pop with immersive visual design. The Riverlight Laurels are where emerging storytellers from London's south bank earn international recognition.",
    schedule: {
      nominationsOpen: "Jan 6-24, 2025",
      shortlistAnnounced: "Feb 10, 2025",
      votingWindow: "Feb 12-Mar 3, 2025",
      rehearsalDay: "Mar 18, 2025",
      ceremony: "Mar 19, 2025 • 19:30 GMT",
    },
    categories: [
      {
        name: "Story-Driven Single of the Year",
        focus: "song",
        nominationSource: "Top streamed originals debuted in London venues Q2-Q4 2024",
        description:
          "Highlights singles that paired lyrical storytelling with visual identity, curated from south bank live residencies and underground premieres.",
      },
      {
        name: "Immersive Album Narrative",
        focus: "album",
        nominationSource: "Albums released via UK indies with narrative liner activations",
        description:
          "Celebrates cohesive album arcs that integrated zines, podcasts, or VR walkthroughs sourced from Rockmundo partner labels.",
      },
      {
        name: "Live Show Cinematics",
        focus: "live_show",
        nominationSource: "Fan attendance heatmaps and AR capture ratings from London clubs",
        description:
          "Rewards the most cinematic touring moment produced in London, tracked through Rockmundo's live show telemetry feeds.",
      },
      {
        name: "Stagecraft Innovation",
        focus: "innovation",
        nominationSource: "Production design submissions from Southbank theatres",
        description:
          "Honors teams that experimented with lighting, projection, or stage movement to unlock new audience emotions.",
      },
    ],
    voting: {
      playerWeight: 0.45,
      npcWeight: 0.35,
      industryJuryWeight: 0.2,
      notes:
        "Player ballots lean on your Rockmundo influence score. NPC votes aggregate promoter sentiment, while a 9-person jury resolves ties with focus on long-term artistry.",
    },
    rewards: {
      attendanceFameBoost: "+350 fame for verified attendees",
      winnerFameBoost: "+1,200 fame plus London residency invitations",
      additionalPerks: [
        "Exclusive Southbank studio writing camp unlock",
        "Custom AR stage pack usable in future gigs",
        "Press amplification across Rockmundo social stories",
      ],
    },
    performanceSlots: [
      {
        slotLabel: "Opening Immersion",
        stage: "Main Hall",
        performer: "Neon Tidemarks",
        songs: ["Glass Rivers", "Signal Lanterns"],
        notes: "Choreographed drone curtain reveals the Thames skyline in real time.",
      },
      {
        slotLabel: "Narrative Spotlight",
        stage: "Acoustic Atrium",
        performer: "Aurora Grey",
        songs: ["Letters to the Tide", "City of Echoes"],
        notes: "Stripped arrangement with holographic journal entries projected behind the duo.",
      },
      {
        slotLabel: "Player Feature",
        stage: "Interactive Annex",
        performer: "Player Spotlight",
        songs: ["Custom Set Piece", "Second Act Reveal"],
        notes: "Reserved for the top-ranked player nominee to premiere a new storytelling moment.",
      },
      {
        slotLabel: "Riverlight Finale",
        stage: "Main Hall",
        performer: "Saffron City",
        songs: ["Solar Drift", "Afterglow Lines"],
        notes: "Finale synced with the Thames lightboats to close the ceremony.",
      },
    ],
    broadcastPartners: ["BBC Music", "Rockmundo Live", "Southbank Streams"],
  },
  {
    id: "2025-northbank",
    show_name: "Northbank Vanguard Awards",
    year: 2025,
    venue: "Alexandra Palace",
    district: "North London",
    overview:
      "Designed as a high-energy summer broadcast celebrating independent artists who turned crowd-funded experiments into arena-ready spectacles.",
    schedule: {
      nominationsOpen: "May 5-26, 2025",
      shortlistAnnounced: "Jun 9, 2025",
      votingWindow: "Jun 10-Jul 1, 2025",
      rehearsalDay: "Jul 21, 2025",
      ceremony: "Jul 22, 2025 • 20:00 GMT",
    },
    categories: [
      {
        name: "Breakthrough Anthem",
        focus: "song",
        nominationSource: "Crowd-funded singles that crossed 500k Rockmundo streams",
        description:
          "Spotlights breakthrough tracks where backers voted on arrangement choices through the Rockmundo studio network.",
      },
      {
        name: "Independent Album Surge",
        focus: "album",
        nominationSource: "Albums distributed via player-managed labels with sold-out London release shows",
        description:
          "Recognizes DIY albums that translated grassroots momentum into tangible ticket demand across the UK.",
      },
      {
        name: "Arena-Ready Live Moment",
        focus: "live_show",
        nominationSource: "Rockmundo show ratings from arenas across the Northbank corridor",
        description:
          "Honors the single live moment that received the highest real-time crowd engagement scores during the spring tour block.",
      },
      {
        name: "Immersive Visual Suite",
        focus: "visuals",
        nominationSource: "3D stage visual submissions vetted by Rockmundo production guilds",
        description:
          "Elevates the visual teams who integrated volumetric capture and AI lighting cues into arena shows.",
      },
    ],
    voting: {
      playerWeight: 0.4,
      npcWeight: 0.4,
      industryJuryWeight: 0.2,
      notes:
        "Player and NPC weights are balanced to showcase both scene influence and the promoter guild's read on touring potential.",
    },
    rewards: {
      attendanceFameBoost: "+420 fame for full-ceremony attendance",
      winnerFameBoost: "+1,500 fame plus a global press day",
      additionalPerks: [
        "Arena-ready lighting rig loan for one tour stop",
        "Professional crew matchmaking with Rockmundo partners",
        "Placement on the Rockmundo Vanguard editorial playlist",
      ],
    },
    performanceSlots: [
      {
        slotLabel: "Skyline Lift-Off",
        stage: "Great Hall Mainstage",
        performer: "Pulse Array",
        songs: ["Northbound", "Signal Fire"],
        notes: "Opens with a suspended lighting rig that descends over the crowd.",
      },
      {
        slotLabel: "Backer Tribute",
        stage: "360 Atrium",
        performer: "The Ember Lights",
        songs: ["City in Motion", "Anchorlines"],
        notes: "Fan backers appear via volumetric projections singing the choruses.",
      },
      {
        slotLabel: "Player Vanguard",
        stage: "Immersion Dome",
        performer: "Player Showcase",
        songs: ["Signature Anthem", "New Release"],
        notes: "Dedicated slot for the player project most upvoted by backers in 2025.",
      },
      {
        slotLabel: "Nightfall Encore",
        stage: "Great Hall Mainstage",
        performer: "Novae",
        songs: ["Light Arcs", "Echo Engines"],
        notes: "Pyro and drone camera hand-off closes the summer broadcast.",
      },
    ],
    broadcastPartners: ["Channel 4 Music", "Rockmundo Live", "IndieWire Sessions"],
  },
  {
    id: "2026-thames-rising",
    show_name: "Thames Rising Honors",
    year: 2026,
    venue: "The O2 Arena",
    district: "Greenwich Peninsula, London",
    overview:
      "A winter gala aligning with the Rockmundo Rising talent accelerator, celebrating artists who turned mentorship cohorts into breakout campaigns.",
    schedule: {
      nominationsOpen: "Oct 6-24, 2025",
      shortlistAnnounced: "Nov 17, 2025",
      votingWindow: "Nov 18-Dec 12, 2025",
      rehearsalDay: "Jan 14, 2026",
      ceremony: "Jan 15, 2026 • 19:00 GMT",
    },
    categories: [
      {
        name: "Mentor Session Single",
        focus: "song",
        nominationSource: "Top tracked singles from Rockmundo mentor cohorts",
        description:
          "Highlights the songs that best translated mentorship feedback into streaming spikes and narrative growth.",
      },
      {
        name: "Ascendant Album Journey",
        focus: "album",
        nominationSource: "Albums released during the Rising accelerator showcase",
        description:
          "Awards the albums that delivered the strongest story arc and retained listener engagement end-to-end.",
      },
      {
        name: "Breakout Live Residency",
        focus: "live_show",
        nominationSource: "Residency attendance and encore request metrics from London partner venues",
        description:
          "Spotlights artists who converted intimate residencies into must-see rituals across the Thames corridor.",
      },
      {
        name: "Immersive Mentor Collab",
        focus: "innovation",
        nominationSource: "Cross-mentor performance experiments logged in Rockmundo",
        description:
          "Celebrates collaborative performances that fused mentor and mentee artistry in novel formats.",
      },
    ],
    voting: {
      playerWeight: 0.5,
      npcWeight: 0.3,
      industryJuryWeight: 0.2,
      notes:
        "Players command half the vote, empowering accelerator cohorts, while venue partners and mentors share the remaining influence.",
    },
    rewards: {
      attendanceFameBoost: "+380 fame for ceremony participation",
      winnerFameBoost: "+1,350 fame and a European showcase booking",
      additionalPerks: [
        "Mentor studio residencies extended for one quarter",
        "O2 Arena rehearsal capture for tour marketing",
        "Spotlight feature in Rockmundo Rising documentary",
      ],
    },
    performanceSlots: [
      {
        slotLabel: "Mentor Overture",
        stage: "Main Stage",
        performer: "Guided Lights Ensemble",
        songs: ["Arcade Bloom", "Signal Paths"],
        notes: "Mentors join mentees for a hybrid orchestral-electronic opener.",
      },
      {
        slotLabel: "Residency Replay",
        stage: "Satellite Stage",
        performer: "Riverheart",
        songs: ["Midnight Keepsake", "Golden Wake"],
        notes: "Recreates the most upvoted residency moment from the accelerator.",
      },
      {
        slotLabel: "Player Rising",
        stage: "Main Stage",
        performer: "Player Spotlight",
        songs: ["Cohort Anthem", "Unreleased Finale"],
        notes: "Showcases the accelerator participant with the highest mentor synergy score.",
      },
      {
        slotLabel: "O2 Closer",
        stage: "Main Stage",
        performer: "Vast Cartography",
        songs: ["Northern Lights", "Keep the Signal"],
        notes: "Arena-scale closing moment featuring interactive wristband lighting.",
      },
    ],
    broadcastPartners: ["ITV Music", "Rockmundo Live", "MentorWave"],
  },
  {
    id: "2026-skyline-laurels",
    show_name: "Skyline Laurels Showcase",
    year: 2026,
    venue: "Roundhouse",
    district: "Camden, London",
    overview:
      "A summer gathering that merges Camden's iconic venues with Rockmundo's AI-driven performance analytics to highlight artists pushing cultural conversations forward.",
    schedule: {
      nominationsOpen: "Mar 2-23, 2026",
      shortlistAnnounced: "Apr 13, 2026",
      votingWindow: "Apr 15-May 6, 2026",
      rehearsalDay: "Jun 1, 2026",
      ceremony: "Jun 2, 2026 • 19:30 GMT",
    },
    categories: [
      {
        name: "Cultural Pulse Single",
        focus: "song",
        nominationSource: "Songs with top cultural sentiment scores across Rockmundo socials",
        description:
          "Rewards singles that sparked meaningful conversations and positive sentiment within the community.",
      },
      {
        name: "Conceptual Album Experience",
        focus: "album",
        nominationSource: "Albums submitted with multimedia companion drops",
        description:
          "Highlights albums that used videos, pop-ups, or zines to extend the narrative and deepen fan immersion.",
      },
      {
        name: "Live Community Catalyst",
        focus: "live_show",
        nominationSource: "Camden venue attendance lifts and encore streaks",
        description:
          "Honors shows that grew local communities and sustained multi-night energy at the Roundhouse and surrounding clubs.",
      },
      {
        name: "Visual Story Installation",
        focus: "visuals",
        nominationSource: "Projection and stage design submissions from Camden collectives",
        description:
          "Showcases art teams that transformed venues into narrative installations paired with live performance.",
      },
    ],
    voting: {
      playerWeight: 0.42,
      npcWeight: 0.38,
      industryJuryWeight: 0.2,
      notes:
        "NPC votes capture venue owner and promoter sentiment, while the jury introduces cultural critics to balance the narrative.",
    },
    rewards: {
      attendanceFameBoost: "+400 fame for verified attendance",
      winnerFameBoost: "+1,480 fame and global editorial coverage",
      additionalPerks: [
        "Camden residency support package",
        "AI stage designer beta access",
        "Featured slot on Rockmundo's Skyline podcast series",
      ],
    },
    performanceSlots: [
      {
        slotLabel: "Roundhouse Arrival",
        stage: "Main Hall",
        performer: "Signal Fires",
        songs: ["Lumen", "Paper Planes"],
        notes: "Combines kinetic lighting with live illustration projection.",
      },
      {
        slotLabel: "Community Cipher",
        stage: "Circular Stage",
        performer: "Night Glyph",
        songs: ["Skyline Verse", "Pulse Theory"],
        notes: "Features rotating community vocalists chosen via Rockmundo fan polls.",
      },
      {
        slotLabel: "Player Laureate",
        stage: "Main Hall",
        performer: "Player Showcase",
        songs: ["Signature Piece", "Surprise Collaboration"],
        notes: "Dedicated slot for the player nominee driving the highest community impact metrics.",
      },
      {
        slotLabel: "Skyline Finale",
        stage: "Main Hall",
        performer: "Celeste Flux",
        songs: ["After Midnight", "Skyline Dream"],
        notes: "Immersive finale with crowd-synced starfield projections.",
      },
    ],
    broadcastPartners: ["Channel 4 Music", "Rockmundo Live", "Skyline Sessions"],
  },
];
