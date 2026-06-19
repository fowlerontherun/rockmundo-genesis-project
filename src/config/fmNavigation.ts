import {
  LayoutDashboard, Music, Users, Mic2, Briefcase, Globe, MessageSquare,
  Building2, Shield, BookOpen, DollarSign, Calendar, Trophy, Radio,
  Disc3, ListMusic, BarChart3, Guitar, MapPin, Plane, Heart, Sparkles,
  Newspaper, Tv, Hammer, GraduationCap, Award, Mic, Video, Film,
  Star, ShoppingBag, Package, Home, Car, Palette, Scissors, Dices,
  Ticket, Skull, Vote, Flag, Handshake, Megaphone, Headphones, HandHeart,
  Crown, Store, Inbox as InboxIcon, type LucideIcon,
} from "lucide-react";

export type FMSubLink = { label: string; path: string; icon?: LucideIcon };
export type FMQuickAction = { label: string; path: string; icon?: LucideIcon; description?: string };
export type FMModule = {
  id: string;
  label: string;
  icon: LucideIcon;
  rootPath: string;
  matchPaths: string[];
  subTabs: FMSubLink[];
  sidebar: { label: string; items: FMSubLink[] }[];
  /** Common "create / start something new" shortcuts surfaced in the FM-style
   *  quick actions bar on every page in this module. */
  quickActions?: FMQuickAction[];
};

export const FM_MODULES: FMModule[] = [
  // 1. OVERVIEW — the "look back & plan" surface
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    rootPath: "/dashboard",
    matchPaths: ["/dashboard", "/home", "/inbox", "/schedule", "/journal", "/todays-news", "/statistics", "/advisor"],
    subTabs: [
      { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
      { label: "Inbox", path: "/inbox", icon: InboxIcon },
      { label: "Schedule", path: "/schedule", icon: Calendar },
      { label: "News", path: "/todays-news", icon: Newspaper },
      { label: "Statistics", path: "/statistics", icon: BarChart3 },
    ],
    sidebar: [
      {
        label: "Today",
        items: [
          { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
          { label: "Inbox", path: "/inbox", icon: InboxIcon },
          { label: "Schedule", path: "/schedule", icon: Calendar },
          { label: "Today's News", path: "/todays-news", icon: Newspaper },
          { label: "Advisor", path: "/advisor", icon: Sparkles },
        ],
      },
      {
        label: "Look Back",
        items: [
          { label: "Statistics", path: "/statistics", icon: BarChart3 },
          { label: "Journal", path: "/journal", icon: BookOpen },
        ],
      },
    ],
  },

  // 2. CHARACTER — identity, body, property
  {
    id: "character",
    label: "Character",
    icon: Users,
    rootPath: "/hub/character",
    matchPaths: [
      "/hub/character", "/characters", "/my-character", "/avatar-designer",
      "/wellness", "/skin-store", "/tattoo-parlour", "/gear", "/gear-shop",
      "/inventory", "/clothing-shop", "/housing", "/personal-vehicles",
      "/family", "/legacy", "/hall-of-immortals",
    ],
    subTabs: [
      { label: "Hub", path: "/hub/character", icon: Users },
      { label: "Wellness", path: "/wellness", icon: Heart },
      { label: "Gear", path: "/gear", icon: Guitar },
      { label: "Housing", path: "/housing", icon: Home },
      { label: "Legacy", path: "/legacy", icon: BookOpen },
    ],
    sidebar: [
      {
        label: "Identity",
        items: [
          { label: "Characters", path: "/characters", icon: Users },
          { label: "Edit Character", path: "/my-character", icon: Users },
          { label: "Avatar Designer", path: "/avatar-designer", icon: Sparkles },
          { label: "Skin Store", path: "/skin-store", icon: ShoppingBag },
          { label: "Tattoo Parlour", path: "/tattoo-parlour", icon: Palette },
          { label: "Clothing Shop", path: "/clothing-shop", icon: Scissors },
          { label: "Wellness", path: "/wellness", icon: Heart },
        ],
      },
      {
        label: "Property",
        items: [
          { label: "Gear / Equipment", path: "/gear", icon: Guitar },
          { label: "Inventory", path: "/inventory", icon: Package },
          { label: "Housing", path: "/housing", icon: Home },
          { label: "Personal Vehicles", path: "/personal-vehicles", icon: Car },
        ],
      },
      {
        label: "Legacy",
        items: [
          { label: "Family", path: "/family/timeline", icon: Heart },
          { label: "Career Legacy", path: "/legacy", icon: BookOpen },
          { label: "Hall of Immortals", path: "/hall-of-immortals", icon: Skull },
        ],
      },
    ],
  },

  // 3. MUSIC — create, release, chart
  {
    id: "music",
    label: "Music",
    icon: Music,
    rootPath: "/hub/music",
    matchPaths: [
      "/hub/music", "/music", "/music-hub",
      "/songwriting", "/stage-practice", "/recording-studio",
      "/release-manager", "/release", "/music-videos",
      "/streaming-platforms", "/streaming",
      "/music/charts", "/country-charts", "/christmas-charts",
      "/competitive-charts", "/song-rankings", "/song-market", "/song-manager",
    ],
    subTabs: [
      { label: "Hub", path: "/hub/music", icon: Music },
      { label: "Songwriting", path: "/songwriting", icon: ListMusic },
      { label: "Studio", path: "/recording-studio", icon: Disc3 },
      { label: "Releases", path: "/release-manager", icon: Disc3 },
      { label: "Videos", path: "/music-videos", icon: Video },
      { label: "Charts", path: "/music/charts", icon: BarChart3 },
    ],
    sidebar: [
      {
        label: "Create",
        items: [
          { label: "Songwriting", path: "/songwriting", icon: ListMusic },
          { label: "Stage Practice", path: "/stage-practice", icon: Guitar },
          { label: "Recording Studio", path: "/recording-studio", icon: Disc3 },
          { label: "Song Manager", path: "/song-manager", icon: ListMusic },
        ],
      },
      {
        label: "Release & Distribute",
        items: [
          { label: "Release Manager", path: "/release-manager", icon: Disc3 },
          { label: "Music Videos", path: "/music-videos", icon: Video },
          { label: "Streaming Platforms", path: "/streaming-platforms", icon: Radio },
        ],
      },
      {
        label: "Charts & Market",
        items: [
          { label: "Global Charts", path: "/music/charts", icon: BarChart3 },
          { label: "Country Charts", path: "/country-charts", icon: BarChart3 },
          { label: "Christmas Charts", path: "/christmas-charts", icon: BarChart3 },
          { label: "Competitive Charts", path: "/competitive-charts", icon: Trophy },
          { label: "Song Rankings", path: "/song-rankings", icon: Trophy },
          { label: "Song Market", path: "/song-market", icon: ShoppingBag },
        ],
      },
    ],
  },

  // 4. BAND & LIVE — merged
  {
    id: "band-live",
    label: "Band & Live",
    icon: Mic2,
    rootPath: "/hub/band-live",
    matchPaths: [
      "/hub/band-live", "/hub/band", "/hub/live", "/hub/events",
      "/band", "/chemistry", "/bands", "/setlists", "/rehearsals",
      "/band-crew", "/band-riders", "/band-vehicles", "/band-rankings",
      "/band-fame-map", "/gigs", "/gig-booking", "/open-mic",
      "/jam-sessions", "/jams", "/busking", "/tour-manager",
      "/festivals", "/major-events", "/events/eurovision",
      "/awards", "/stage-setup", "/stage-equipment",
    ],
    subTabs: [
      { label: "Hub", path: "/hub/band-live", icon: Mic2 },
      { label: "Band", path: "/band", icon: Users },
      { label: "Book Gigs", path: "/gig-booking", icon: Calendar },
      { label: "Tours", path: "/tour-manager", icon: Plane },
      { label: "Festivals", path: "/festivals", icon: Trophy },
      { label: "Awards", path: "/awards", icon: Award },
    ],
    sidebar: [
      {
        label: "Your Band",
        items: [
          { label: "Band Manager", path: "/band", icon: Users },
          { label: "Repertoire", path: "/band/repertoire", icon: ListMusic },
          { label: "Chemistry", path: "/chemistry", icon: Sparkles },
          { label: "Setlists", path: "/setlists", icon: ListMusic },
          { label: "Rehearsals", path: "/rehearsals", icon: Guitar },
          { label: "Crew", path: "/band-crew", icon: Users },
          { label: "Riders", path: "/band-riders", icon: ListMusic },
          { label: "Vehicles", path: "/band-vehicles", icon: Plane },
        ],
      },
      {
        label: "Discover Bands",
        items: [
          { label: "Browse", path: "/bands/browse", icon: Users },
          { label: "Band Finder", path: "/bands/finder", icon: Users },
          { label: "Rankings", path: "/band-rankings", icon: Trophy },
          { label: "Fame Map", path: "/band-fame-map", icon: MapPin },
        ],
      },
      {
        label: "Perform",
        items: [
          { label: "Book Gigs", path: "/gig-booking", icon: Calendar },
          { label: "My Gigs", path: "/gigs", icon: Mic2 },
          { label: "Open Mic", path: "/open-mic", icon: Mic },
          { label: "Jam Sessions", path: "/jam-sessions", icon: Music },
          { label: "Busking", path: "/busking", icon: Music },
          { label: "Stage Setup", path: "/stage-setup", icon: Guitar },
          { label: "Stage Equipment", path: "/stage-equipment", icon: Hammer },
        ],
      },
      {
        label: "Tours & Events",
        items: [
          { label: "Tour Manager", path: "/tour-manager", icon: Plane },
          { label: "Festivals", path: "/festivals", icon: Trophy },
          { label: "Major Events", path: "/major-events", icon: Star },
          { label: "Eurovision", path: "/events/eurovision", icon: Star },
          { label: "Awards", path: "/awards", icon: Award },
        ],
      },
    ],
  },

  // 5. CAREER — money, work, companies, creative side-careers
  {
    id: "career",
    label: "Career",
    icon: Briefcase,
    rootPath: "/hub/career-business",
    matchPaths: [
      "/hub/career-business", "/hub/career", "/hub/commerce",
      "/finances", "/sponsorships", "/employment", "/teaching",
      "/education", "/booking", "/offers-dashboard",
      "/public-relations", "/pr",
      "/producer-career", "/modeling", "/acting", "/clothing-designer",
      "/labels", "/record-label", "/my-companies", "/company",
      "/venues", "/venue-business", "/recording-studio-business",
      "/rehearsal-studio-business", "/merch-factory", "/logistics-company",
      "/security-firm", "/merchandise",
    ],
    subTabs: [
      { label: "Hub", path: "/hub/career-business", icon: Briefcase },
      { label: "Finances", path: "/finances", icon: DollarSign },
      { label: "Employment", path: "/employment", icon: Briefcase },
      { label: "Companies", path: "/my-companies", icon: Building2 },
      { label: "PR", path: "/pr", icon: Megaphone },
      { label: "Offers", path: "/offers-dashboard", icon: Handshake },
    ],
    sidebar: [
      {
        label: "Money",
        items: [
          { label: "Finances", path: "/finances", icon: DollarSign },
          { label: "Sponsorships", path: "/sponsorships", icon: Handshake },
          { label: "Offers", path: "/offers-dashboard", icon: Handshake },
        ],
      },
      {
        label: "Work & Learn",
        items: [
          { label: "Employment", path: "/employment", icon: Briefcase },
          { label: "Education", path: "/education", icon: GraduationCap },
          { label: "Teaching", path: "/teaching", icon: BookOpen },
          { label: "Book Education", path: "/booking/education", icon: GraduationCap },
          { label: "Book Work", path: "/booking/work", icon: Briefcase },
        ],
      },
      {
        label: "Creative Industries",
        items: [
          { label: "Public Relations", path: "/pr", icon: Megaphone },
          { label: "Producer Career", path: "/producer-career", icon: Headphones },
          { label: "Modeling", path: "/modeling", icon: Sparkles },
          { label: "Acting", path: "/acting", icon: Film },
          { label: "Clothing Designer", path: "/clothing-designer", icon: Scissors },
        ],
      },
      {
        label: "Companies",
        items: [
          { label: "My Companies", path: "/my-companies", icon: Building2 },
          { label: "Record Labels", path: "/labels", icon: Disc3 },
          { label: "Venues", path: "/venues", icon: Building2 },
          { label: "Merchandise", path: "/merchandise", icon: ShoppingBag },
        ],
      },
    ],
  },

  // 6. MEDIA — consumer media browsing
  {
    id: "media",
    label: "Media",
    icon: Newspaper,
    rootPath: "/hub/media",
    matchPaths: [
      "/hub/media",
      "/media/radio", "/radio",
      "/media/tv-shows",
      "/media/newspapers",
      "/media/magazines",
      "/media/podcasts",
      "/media/films",
      "/media/websites",
      "/media/self-promotion",
      "/media/pr-history",
      "/media/acting",
    ],
    subTabs: [
      { label: "Hub", path: "/hub/media", icon: Newspaper },
      { label: "Radio", path: "/media/radio", icon: Radio },
      { label: "TV", path: "/media/tv-shows", icon: Tv },
      { label: "Press", path: "/media/newspapers", icon: Newspaper },
      { label: "Film", path: "/media/films", icon: Film },
    ],
    sidebar: [
      {
        label: "Broadcast",
        items: [
          { label: "Radio Stations", path: "/media/radio", icon: Radio },
          { label: "TV Shows", path: "/media/tv-shows", icon: Tv },
          { label: "Podcasts", path: "/media/podcasts", icon: Mic },
        ],
      },
      {
        label: "Press",
        items: [
          { label: "Newspapers", path: "/media/newspapers", icon: Newspaper },
          { label: "Magazines", path: "/media/magazines", icon: BookOpen },
          { label: "Websites", path: "/media/websites", icon: Globe },
        ],
      },
      {
        label: "Screen",
        items: [
          { label: "Films", path: "/media/films", icon: Film },
        ],
      },
      {
        label: "Outbound",
        items: [
          { label: "Self-Promotion", path: "/media/self-promotion", icon: Megaphone },
          { label: "PR History", path: "/media/pr-history", icon: BookOpen },
        ],
      },
    ],
  },

  // 7. WORLD — places, travel, politics
  {
    id: "world",
    label: "World",
    icon: Globe,
    rootPath: "/hub/world",
    matchPaths: [
      "/hub/world", "/hub/world-social",
      "/world-map", "/world-pulse", "/world-environment",
      "/cities", "/travel", "/landmarks", "/seasonal-events",
      "/world-parliament", "/political-party", "/politics-career",
    ],
    subTabs: [
      { label: "Hub", path: "/hub/world", icon: Globe },
      { label: "Cities", path: "/cities", icon: MapPin },
      { label: "Travel", path: "/travel", icon: Plane },
      { label: "Pulse", path: "/world-pulse", icon: Radio },
      { label: "Politics", path: "/political-party", icon: Vote },
    ],
    sidebar: [
      {
        label: "Explore",
        items: [
          { label: "Cities", path: "/cities", icon: MapPin },
          { label: "Travel", path: "/travel", icon: Plane },
          { label: "World Pulse", path: "/world-pulse", icon: Radio },
          { label: "Landmarks", path: "/landmarks", icon: Star },
          { label: "Seasonal Events", path: "/seasonal-events", icon: Calendar },
        ],
      },
      {
        label: "Politics",
        items: [
          { label: "World Parliament", path: "/world-parliament", icon: Hammer },
          { label: "Political Party", path: "/political-party", icon: Flag },
          { label: "Party Standings", path: "/political-party/standings", icon: BarChart3 },
          { label: "Politics Career", path: "/politics-career", icon: Vote },
        ],
      },
    ],
  },

  // 8. SOCIAL — people, peer platforms, nightlife
  {
    id: "social",
    label: "Social",
    icon: MessageSquare,
    rootPath: "/hub/social",
    matchPaths: [
      "/hub/social", "/social",
      "/twaater", "/dikcok", "/gettit",
      "/nightclubs", "/nightclub", "/nightclub-management",
      "/casino", "/lottery", "/underworld",
      "/premium-store", "/blind-boxes", "/vip-subscribe",
    ],
    subTabs: [
      { label: "Hub", path: "/hub/social", icon: MessageSquare },
      { label: "Twaater", path: "/twaater", icon: Newspaper },
      { label: "DikCok", path: "/dikcok", icon: Tv },
      { label: "Nightlife", path: "/nightclubs", icon: Sparkles },
      { label: "Store", path: "/premium-store", icon: Crown },
    ],
    sidebar: [
      {
        label: "People",
        items: [
          { label: "Social Hub", path: "/social", icon: MessageSquare },
          { label: "Friends", path: "/social?tab=friends", icon: Heart },
        ],
      },
      {
        label: "Platforms",
        items: [
          { label: "Twaater", path: "/twaater", icon: Newspaper },
          { label: "Twaater Messages", path: "/twaater/messages", icon: MessageSquare },
          { label: "DikCok", path: "/dikcok", icon: Tv },
          { label: "Gettit", path: "/gettit", icon: HandHeart },
        ],
      },
      {
        label: "Nightlife & Vice",
        items: [
          { label: "Nightclubs", path: "/nightclubs", icon: Sparkles },
          { label: "Casino", path: "/casino", icon: Dices },
          { label: "Lottery", path: "/lottery", icon: Ticket },
          { label: "Underworld", path: "/underworld", icon: Skull },
        ],
      },
      {
        label: "Premium",
        items: [
          { label: "Premium Store", path: "/premium-store", icon: Crown },
          { label: "Blind Boxes", path: "/blind-boxes", icon: Package },
          { label: "VIP", path: "/vip-subscribe", icon: Star },
        ],
      },
    ],
  },

  // 9. ADMIN — gated
  {
    id: "admin",
    label: "Admin",
    icon: Shield,
    rootPath: "/admin",
    matchPaths: ["/admin"],
    subTabs: [
      { label: "Dashboard", path: "/admin/dashboard", icon: LayoutDashboard },
      { label: "Players", path: "/admin/user-roles", icon: Users },
      { label: "Analytics", path: "/admin/analytics", icon: BarChart3 },
      { label: "Debug", path: "/admin/debug-panel", icon: Hammer },
    ],
    sidebar: [
      {
        label: "Admin",
        items: [
          { label: "Admin Panel", path: "/admin", icon: Shield },
          { label: "Dashboard", path: "/admin/dashboard", icon: LayoutDashboard },
          { label: "World Reset", path: "/admin/world-reset", icon: Hammer },
          { label: "Debug Panel", path: "/admin/debug-panel", icon: Hammer },
        ],
      },
    ],
  },
];

export function findModuleForPath(pathname: string): FMModule {
  let best: { mod: FMModule; len: number } | null = null;
  for (const mod of FM_MODULES) {
    for (const p of mod.matchPaths) {
      if (pathname === p || pathname.startsWith(p + "/")) {
        if (!best || p.length > best.len) best = { mod, len: p.length };
      }
    }
  }
  return best?.mod ?? FM_MODULES[0];
}
