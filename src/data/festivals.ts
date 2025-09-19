
export interface FestivalDaySplit {
  day: string;
  highlightActs: string[];
}

export interface FestivalHistory {
  year: string;
  headliners: string[];
  notes: string;
}

export interface FestivalAttendance {
  typical: string;
  capacity: string;
}

export interface FestivalPricing {
  generalAdmission: string;
  vip: string;
  notes: string;
}

export interface FestivalEntry {
  id: string;
  name: string;
  dates: string;
  venue: string;
  genreTags: string[];
  description: string;
  currentLineup: {
    headliners: string[];
    daySplits: FestivalDaySplit[];
  };
  historicalLineups: FestivalHistory[];
  attendance: FestivalAttendance;
  pricing: FestivalPricing;
}

export interface CityFestivalGuide {
  cityName: string;
  description: string;
  festivals: FestivalEntry[];
}

export interface CityFestivalHighlight {
  name: string;
  location: string;
  dateRange: string;
  headliners: string[];
  attendance: string;
  ticketPrice: string;
  description: string;
}

export const upcomingCityFestivals: CityFestivalHighlight[] = [
  {
    name: "Desert Dawn Fest",
    location: "Sunset Flats Park • New Austin, TX",
    dateRange: "Apr 11-13, 2025",
    headliners: ["The Ember Lights", "Neon Dunes", "Aurora Grey"],
    attendance: "Capped at 50,000 per day",
    ticketPrice: "$189 GA • $429 VIP",
    description:
      "Sunrise-to-midnight desert immersion with art camps and sand-swept stages designed for wandering fan stories.",
  },
  {
    name: "Tidal Harmony Summit",
    location: "Harborfront Commons • Harbor City, WA",
    dateRange: "Jun 20-22, 2025",
    headliners: ["Harborline", "Paper Coast", "Celeste Flux"],
    attendance: "12,500 fans each day",
    ticketPrice: "$175 GA • $365 VIP",
    description:
      "Fog-soaked harbor cruises pair with floating night stages and chillwave textures carried across the waterfront.",
  },
  {
    name: "Lumen Sessions",
    location: "Aurora Soundscape Park • Aurora Bay, ON",
    dateRange: "Jul 4-6, 2025",
    headliners: ["Pale Meridian", "Signal Fires", "Vast Cartography"],
    attendance: "10,000 guests per day",
    ticketPrice: "$159 GA • $349 VIP",
    description:
      "Extended sunset sets and projection domes create a slow-bloom experience for instrumental and ambient storytellers.",
  },
  {
    name: "Mesa Muse Weekender",
    location: "Old Quarry Amphitheater • New Austin, TX",
    dateRange: "Oct 3-5, 2025",
    headliners: ["Pulse Array", "Saffron City", "Novae"],
    attendance: "8,000 capacity each night",
    ticketPrice: "$149 GA • $329 VIP",
    description:
      "Twilight performances framed by canyon walls with projection-mapped installations reacting to crowd movement.",
  },
  {
    name: "Skyline Echo Nights",
    location: "Union Skyline Rooftops • Harbor City, WA",
    dateRange: "Sep 12-14, 2025",
    headliners: ["Aerial Circuit", "Silver Causeway", "Night Glyph"],
    attendance: "6,500 attendees per night",
    ticketPrice: "$165 GA • $399 VIP",
    description:
      "Multiple rooftop pods sync across the skyline for a progressive listening journey tracked by mobile beacons.",
  },
  {
    name: "Aurora Rise Rally",
    location: "Harbor Ice Forum • Aurora Bay, ON",
    dateRange: "Feb 14-16, 2026",
    headliners: ["Glowcase", "Riverheart", "Signal Bloom"],
    attendance: "6,000 fans per session",
    ticketPrice: "$139 GA • $315 VIP",
    description:
      "A winter indoor/outdoor mashup with heated domes, projection ice paths, and collaborative dance troupes.",
  },
];

export const festivalCatalog: Record<string, CityFestivalGuide> = {
  "new-austin": {
    cityName: "New Austin, TX",
    description:
      "A desert-leaning hub where sunrise sets and neon nights collide. This guide will evolve to reflect partner cities as data begins streaming in.",
    festivals: [
      {
        id: "desert-dawn",
        name: "Desert Dawn Fest",
        dates: "April 11-13, 2025",
        venue: "Sunset Flats Park",
        genreTags: ["Indie", "Alt Rock", "Dream Pop"],
        description:
          "A sunrise-to-midnight experience with immersive art camps and sand-swept stages designed for wandering fan stories.",
        currentLineup: {
          headliners: ["The Ember Lights", "Neon Dunes", "Aurora Grey"],
          daySplits: [
            {
              day: "Friday",
              highlightActs: ["The Ember Lights", "Static Bloom", "Midnight Atlas"],
            },
            {
              day: "Saturday",
              highlightActs: ["Neon Dunes", "Echo Mirage", "Golden Hour Architects"],
            },
            {
              day: "Sunday",
              highlightActs: ["Aurora Grey", "Desert Choir", "Starling Parade"],
            },
          ],
        },
        historicalLineups: [
          {
            year: "2024",
            headliners: ["Sky Lanterns", "River & Rust", "Glow Theory"],
            notes: "Introduced the midnight acoustic oasis that will return with expanded seating.",
          },
          {
            year: "2023",
            headliners: ["Monsoon State", "Velvet Static", "Prism Arcade"],
            notes: "First year partnering with local collectives for sunrise wellness programming.",
          },
        ],
        attendance: {
          typical: "48,000 weekend passes",
          capacity: "Capped at 50,000 per day",
        },
        pricing: {
          generalAdmission: "$189 (3-day pass)",
          vip: "$429 (VIP lounge & shuttle)",
          notes: "Payment plans and local resident discounts will unlock once live ticketing is connected.",
        },
      },
      {
        id: "mesa-muse",
        name: "Mesa Muse Weekender",
        dates: "October 3-5, 2025",
        venue: "Old Quarry Amphitheater",
        genreTags: ["Electronic", "R&B", "Experimental"],
        description:
          "Twilight performances framed by canyon walls and projection-mapped installations that respond to crowd movement.",
        currentLineup: {
          headliners: ["Pulse Array", "Saffron City", "Novae"],
          daySplits: [
            {
              day: "Friday",
              highlightActs: ["Pulse Array", "Loops & Ladders", "Tidal Glow"],
            },
            {
              day: "Saturday",
              highlightActs: ["Saffron City", "Beryl", "Solar Echo"],
            },
            {
              day: "Sunday",
              highlightActs: ["Novae", "Mirage Choir", "Faderline"],
            },
          ],
        },
        historicalLineups: [
          {
            year: "2024",
            headliners: ["Signal Ghost", "Saffron City", "Lotus Drip"],
            notes: "Expanded to include a producers' marketplace that drew label scouts from three regions.",
          },
          {
            year: "2022",
            headliners: ["Night Caravan", "Pulse Array", "Velvet Home"],
            notes: "Debut edition sold out its limited-capacity preview in 11 minutes.",
          },
        ],
        attendance: {
          typical: "22,500 weekend passes",
          capacity: "8,000 per night",
        },
        pricing: {
          generalAdmission: "$149 (weekend credentials)",
          vip: "$329 (mesa overlook decks)",
          notes: "Tiered on-sale windows will appear here once regional partners feed live inventory.",
        },
      },
    ],
  },
  "harbor-city": {
    cityName: "Harbor City, WA",
    description:
      "Fog-soaked piers and skyline rooftops make this port town a natural host for waterfront and avant-pop gatherings.",
    festivals: [
      {
        id: "tidal-harmony",
        name: "Tidal Harmony Summit",
        dates: "June 20-22, 2025",
        venue: "Harborfront Commons",
        genreTags: ["Alt Pop", "Folk", "Electronic"],
        description:
          "Daytime harbor cruises pair with night stages floating along the docks, matching chillwave textures with sea air.",
        currentLineup: {
          headliners: ["Harborline", "Paper Coast", "Celeste Flux"],
          daySplits: [
            {
              day: "Friday",
              highlightActs: ["Harborline", "Isle Story", "Signal Kite"],
            },
            {
              day: "Saturday",
              highlightActs: ["Paper Coast", "Northcurrent", "Moonlit Museum"],
            },
            {
              day: "Sunday",
              highlightActs: ["Celeste Flux", "Beacon Row", "Wave Weather"],
            },
          ],
        },
        historicalLineups: [
          {
            year: "2024",
            headliners: ["Glass Lagoon", "Harborline", "Astral Quilt"],
            notes: "Launched a sustainability pavilion featuring renewable stage tech demos.",
          },
          {
            year: "2023",
            headliners: ["Mariner's Tale", "Paper Coast", "Wave Weather"],
            notes: "Introduced sunrise songwriter circles on the east pier.",
          },
        ],
        attendance: {
          typical: "31,000 weekend passes",
          capacity: "12,500 per day",
        },
        pricing: {
          generalAdmission: "$175 (3-day harbor pass)",
          vip: "$365 (captain's lounge)",
          notes: "Harbor cruise add-ons and merch bundles will populate automatically once APIs are wired.",
        },
      },
      {
        id: "skyline-echo",
        name: "Skyline Echo Nights",
        dates: "September 12-14, 2025",
        venue: "Union Skyline Rooftops",
        genreTags: ["Synthwave", "House", "Future Soul"],
        description:
          "Multiple rooftop pods sync across the skyline for a progressive listening experience tracked by mobile beacons.",
        currentLineup: {
          headliners: ["Aerial Circuit", "Silver Causeway", "Night Glyph"],
          daySplits: [
            {
              day: "Friday",
              highlightActs: ["Aerial Circuit", "Glass Elevator", "Metro Bloom"],
            },
            {
              day: "Saturday",
              highlightActs: ["Silver Causeway", "Blue Hour", "Satellite Arcade"],
            },
            {
              day: "Sunday",
              highlightActs: ["Night Glyph", "Rain Decoder", "Sky Lanterns"],
            },
          ],
        },
        historicalLineups: [
          {
            year: "2024",
            headliners: ["Night Glyph", "Horizon Theory", "Metro Bloom"],
            notes: "Added synchronized drone choreography between headline sets.",
          },
          {
            year: "2022",
            headliners: ["Silver Causeway", "Analog Avenue", "Star Corridor"],
            notes: "First year experimenting with rooftop-to-rooftop audio relays.",
          },
        ],
        attendance: {
          typical: "18,000 weekend passes",
          capacity: "6,500 per night",
        },
        pricing: {
          generalAdmission: "$165 (multi-rooftop access)",
          vip: "$399 (heliport arrival + lounge)",
          notes: "City transit integrations will eventually sync to show the best late-night options here.",
        },
      },
    ],
  },
  "aurora-bay": {
    cityName: "Aurora Bay, ON",
    description:
      "A northern waterfront where long summer days meet luminescent night skies, ready to spotlight genre-blending showcases.",
    festivals: [
      {
        id: "lumen-sessions",
        name: "Lumen Sessions",
        dates: "July 4-6, 2025",
        venue: "Aurora Soundscape Park",
        genreTags: ["Post-Rock", "Ambient", "Instrumental"],
        description:
          "Extended sunset sets and late-night projection domes create a slow-bloom experience for bands that thrive on dynamics.",
        currentLineup: {
          headliners: ["Pale Meridian", "Signal Fires", "Vast Cartography"],
          daySplits: [
            {
              day: "Friday",
              highlightActs: ["Pale Meridian", "Northern Echo", "Station Drift"],
            },
            {
              day: "Saturday",
              highlightActs: ["Signal Fires", "Icefield", "The Slow Atlas"],
            },
            {
              day: "Sunday",
              highlightActs: ["Vast Cartography", "Field Hymn", "Aurora Strings"],
            },
          ],
        },
        historicalLineups: [
          {
            year: "2024",
            headliners: ["Signal Fires", "Lowlight Chorus", "Glass Harbour"],
            notes: "Debut of the floating stage that will now be a recurring anchor element.",
          },
          {
            year: "2023",
            headliners: ["Pale Meridian", "Slow Current", "Midnight Mapping"],
            notes: "Collaborated with local observatory for aurora forecasts displayed on-site.",
          },
        ],
        attendance: {
          typical: "26,000 weekend passes",
          capacity: "10,000 per day",
        },
        pricing: {
          generalAdmission: "$159 (3-day hillside pass)",
          vip: "$349 (starlight terrace seating)",
          notes: "Group camping bundles and backstage walks will appear once experiential modules are activated.",
        },
      },
      {
        id: "aurora-rise",
        name: "Aurora Rise Rally",
        dates: "February 14-16, 2026",
        venue: "Harbor Ice Forum",
        genreTags: ["Alt R&B", "Pop", "Electronic"],
        description:
          "A winter-edition indoor/outdoor mashup showcasing heated domes, projection ice paths, and collaborative dance troupes.",
        currentLineup: {
          headliners: ["Glowcase", "Riverheart", "Signal Bloom"],
          daySplits: [
            {
              day: "Friday",
              highlightActs: ["Glowcase", "Juniper & Co.", "Lattice Lines"],
            },
            {
              day: "Saturday",
              highlightActs: ["Riverheart", "Polar Bloom", "Temperance Club"],
            },
            {
              day: "Sunday",
              highlightActs: ["Signal Bloom", "Neon Fable", "Glassline"],
            },
          ],
        },
        historicalLineups: [
          {
            year: "2025",
            headliners: ["Frost Arcade", "Glowcase", "Winterline"],
            notes: "Prototype year confirmed guests loved the heated walkway experiences—expect a bigger footprint.",
          },
          {
            year: "2024",
            headliners: ["Signal Bloom", "Arctic Choir", "Brass Lantern"],
            notes: "Community co-creation labs debuted, enabling emerging acts to collaborate on-site.",
          },
        ],
        attendance: {
          typical: "17,500 weekend passes",
          capacity: "6,000 per session",
        },
        pricing: {
          generalAdmission: "$139 (weekend bundle)",
          vip: "$315 (heated skybox + meet & greets)",
          notes: "Dynamic pricing and loyalty perks will sync here once connected to the fan identity layer.",
        },
      },
    ],
  },
};

export const festivalCityKeys = Object.keys(festivalCatalog);
