import {
  LayoutDashboard, Music, Users, Mic2, Briefcase, Globe, MessageSquare,
  Building2, Shield, BookOpen, DollarSign, Calendar, Trophy, Radio,
  Disc3, ListMusic, BarChart3, Guitar, MapPin, Plane, Heart, Sparkles,
  Newspaper, Tv, Hammer, Factory, ShieldCheck, GraduationCap, Award,
  Star, ShoppingBag, type LucideIcon,
} from "lucide-react";

export type FMSubLink = { label: string; path: string; icon?: LucideIcon };
export type FMModule = {
  id: string;
  label: string;
  icon: LucideIcon;
  rootPath: string;
  /** Routes that count as "in this module" for highlighting */
  matchPaths: string[];
  /** Secondary horizontal sub-tabs */
  subTabs: FMSubLink[];
  /** Sidebar groups (collapsible) */
  sidebar: { label: string; items: FMSubLink[] }[];
};

export const FM_MODULES: FMModule[] = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    rootPath: "/dashboard",
    matchPaths: ["/dashboard", "/my-character", "/hub/character"],
    subTabs: [
      { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
      { label: "Character", path: "/hub/character", icon: Users },
      { label: "Wellness", path: "/wellness", icon: Heart },
      { label: "Inbox", path: "/inbox", icon: MessageSquare },
      { label: "Schedule", path: "/schedule", icon: Calendar },
    ],
    sidebar: [
      {
        label: "You",
        items: [
          { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
          { label: "Character", path: "/hub/character", icon: Users },
          { label: "Avatar Designer", path: "/avatar-designer", icon: Sparkles },
          { label: "Wellness", path: "/wellness", icon: Heart },
          { label: "Wardrobe", path: "/clothing-shop", icon: ShoppingBag },
          { label: "Tattoo Parlour", path: "/tattoo-parlour", icon: Star },
        ],
      },
      {
        label: "Inbox & Schedule",
        items: [
          { label: "Inbox", path: "/inbox", icon: MessageSquare },
          { label: "Schedule", path: "/schedule", icon: Calendar },
          { label: "Notifications", path: "/notifications", icon: MessageSquare },
        ],
      },
    ],
  },
  {
    id: "music",
    label: "Music",
    icon: Music,
    rootPath: "/hub/music",
    matchPaths: ["/hub/music", "/songwriting", "/recording-studio", "/music-studio", "/release-manager", "/song-market", "/song-rankings", "/music/charts"],
    subTabs: [
      { label: "Hub", path: "/hub/music", icon: Music },
      { label: "Songwriting", path: "/songwriting", icon: ListMusic },
      { label: "Studio", path: "/music-studio", icon: Disc3 },
      { label: "Releases", path: "/release-manager", icon: Disc3 },
      { label: "Charts", path: "/music/charts", icon: BarChart3 },
      { label: "Market", path: "/song-market", icon: ShoppingBag },
    ],
    sidebar: [
      {
        label: "Create",
        items: [
          { label: "Songwriting", path: "/songwriting", icon: ListMusic },
          { label: "Music Studio", path: "/music-studio", icon: Disc3 },
          { label: "Stage Practice", path: "/stage-practice", icon: Guitar },
        ],
      },
      {
        label: "Release & Distribute",
        items: [
          { label: "Release Manager", path: "/release-manager", icon: Disc3 },
          { label: "Streaming", path: "/streaming-platforms", icon: Radio },
          { label: "Charts", path: "/music/charts", icon: BarChart3 },
          { label: "Song Rankings", path: "/song-rankings", icon: Trophy },
          { label: "Song Market", path: "/song-market", icon: ShoppingBag },
        ],
      },
    ],
  },
  {
    id: "band",
    label: "Band",
    icon: Users,
    rootPath: "/band",
    matchPaths: ["/band", "/hub/band", "/hub/band-live", "/band-chemistry", "/band-browser", "/setlist-manager"],
    subTabs: [
      { label: "Manage", path: "/band", icon: Users },
      { label: "Chemistry", path: "/band-chemistry", icon: Sparkles },
      { label: "Setlists", path: "/setlist-manager", icon: ListMusic },
      { label: "Browse", path: "/band-browser", icon: Users },
    ],
    sidebar: [
      {
        label: "Your Band",
        items: [
          { label: "Band Manager", path: "/band", icon: Users },
          { label: "Chemistry", path: "/band-chemistry", icon: Sparkles },
          { label: "Setlists", path: "/setlist-manager", icon: ListMusic },
          { label: "Rehearsal", path: "/rehearsal", icon: Guitar },
        ],
      },
      {
        label: "Recruit & Browse",
        items: [
          { label: "Band Browser", path: "/band-browser", icon: Users },
        ],
      },
    ],
  },
  {
    id: "live",
    label: "Live",
    icon: Mic2,
    rootPath: "/hub/live",
    matchPaths: ["/hub/live", "/perform-gig", "/gig-booking", "/advanced-gig", "/festivals", "/festival-browser", "/tour-manager"],
    subTabs: [
      { label: "Perform", path: "/perform-gig", icon: Mic2 },
      { label: "Book Gigs", path: "/gig-booking", icon: Calendar },
      { label: "Festivals", path: "/festivals", icon: Trophy },
      { label: "Tours", path: "/tour-manager", icon: Plane },
      { label: "Awards", path: "/awards", icon: Award },
    ],
    sidebar: [
      {
        label: "Gigs",
        items: [
          { label: "Perform", path: "/perform-gig", icon: Mic2 },
          { label: "Book Gigs", path: "/gig-booking", icon: Calendar },
          { label: "Advanced Gigs", path: "/advanced-gig", icon: Mic2 },
        ],
      },
      {
        label: "Tours & Festivals",
        items: [
          { label: "Tour Manager", path: "/tour-manager", icon: Plane },
          { label: "Festivals", path: "/festivals", icon: Trophy },
          { label: "Festival Browser", path: "/festival-browser", icon: Trophy },
        ],
      },
      {
        label: "Recognition",
        items: [
          { label: "Awards", path: "/awards", icon: Award },
          { label: "Hall of Immortals", path: "/hall-of-immortals", icon: Star },
        ],
      },
    ],
  },
  {
    id: "career",
    label: "Career",
    icon: Briefcase,
    rootPath: "/hub/career-business",
    matchPaths: ["/hub/career-business", "/finances", "/employment", "/education", "/teaching", "/sponsorships", "/record-label"],
    subTabs: [
      { label: "Hub", path: "/hub/career-business", icon: Briefcase },
      { label: "Finances", path: "/finances", icon: DollarSign },
      { label: "Education", path: "/education", icon: GraduationCap },
      { label: "Employment", path: "/employment", icon: Briefcase },
      { label: "Sponsorships", path: "/sponsorships", icon: Award },
      { label: "Label", path: "/record-label", icon: Disc3 },
    ],
    sidebar: [
      {
        label: "Money",
        items: [
          { label: "Finances", path: "/finances", icon: DollarSign },
          { label: "Portfolio", path: "/finance/portfolio", icon: BarChart3 },
          { label: "Sponsorships", path: "/sponsorships", icon: Award },
        ],
      },
      {
        label: "Growth",
        items: [
          { label: "Education", path: "/education", icon: GraduationCap },
          { label: "Teaching", path: "/teaching", icon: BookOpen },
          { label: "Employment", path: "/employment", icon: Briefcase },
        ],
      },
      {
        label: "Business",
        items: [
          { label: "Record Label", path: "/record-label", icon: Disc3 },
          { label: "Venues", path: "/venue-management", icon: Building2 },
          { label: "Merch Factory", path: "/merch-factory", icon: Factory },
          { label: "Logistics", path: "/logistics-company", icon: Plane },
          { label: "Security Firm", path: "/security-firm", icon: ShieldCheck },
        ],
      },
    ],
  },
  {
    id: "world",
    label: "World",
    icon: Globe,
    rootPath: "/hub/world-social",
    matchPaths: ["/hub/world-social", "/world-map", "/city", "/world-pulse", "/world-parliament"],
    subTabs: [
      { label: "Map", path: "/world-map", icon: MapPin },
      { label: "City", path: "/city", icon: Building2 },
      { label: "Pulse", path: "/world-pulse", icon: Radio },
      { label: "Parliament", path: "/world-parliament", icon: Hammer },
    ],
    sidebar: [
      {
        label: "Explore",
        items: [
          { label: "World Map", path: "/world-map", icon: MapPin },
          { label: "Current City", path: "/city", icon: Building2 },
          { label: "World Pulse", path: "/world-pulse", icon: Radio },
        ],
      },
      {
        label: "Politics",
        items: [
          { label: "World Parliament", path: "/world-parliament", icon: Hammer },
          { label: "Political Party", path: "/political-party", icon: Users },
          { label: "Politics Career", path: "/politics-career", icon: Briefcase },
        ],
      },
    ],
  },
  {
    id: "social",
    label: "Social",
    icon: MessageSquare,
    rootPath: "/social",
    matchPaths: ["/social", "/relationships", "/twaater", "/dikcok", "/gettit", "/social-media", "/public-relations"],
    subTabs: [
      { label: "Hub", path: "/social", icon: MessageSquare },
      { label: "Relationships", path: "/relationships", icon: Heart },
      { label: "Twaater", path: "/twaater", icon: Newspaper },
      { label: "DikCok", path: "/dikcok", icon: Tv },
      { label: "PR", path: "/public-relations", icon: Newspaper },
    ],
    sidebar: [
      {
        label: "People",
        items: [
          { label: "Social Hub", path: "/social", icon: MessageSquare },
          { label: "Relationships", path: "/relationships", icon: Heart },
          { label: "Fans", path: "/fan-management", icon: Users },
        ],
      },
      {
        label: "Media",
        items: [
          { label: "Twaater", path: "/twaater", icon: Newspaper },
          { label: "DikCok", path: "/dikcok", icon: Tv },
          { label: "Gettit", path: "/gettit", icon: MessageSquare },
          { label: "Public Relations", path: "/public-relations", icon: Newspaper },
          { label: "Social Media", path: "/social-media", icon: MessageSquare },
        ],
      },
    ],
  },
  {
    id: "commerce",
    label: "Store",
    icon: ShoppingBag,
    rootPath: "/equipment-store",
    matchPaths: ["/equipment-store", "/clothing-shop", "/tattoo-parlour", "/inventory"],
    subTabs: [
      { label: "Gear", path: "/equipment-store", icon: Guitar },
      { label: "Clothing", path: "/clothing-shop", icon: ShoppingBag },
      { label: "Tattoos", path: "/tattoo-parlour", icon: Star },
      { label: "Inventory", path: "/inventory", icon: ShoppingBag },
    ],
    sidebar: [
      {
        label: "Shops",
        items: [
          { label: "Equipment", path: "/equipment-store", icon: Guitar },
          { label: "Clothing", path: "/clothing-shop", icon: ShoppingBag },
          { label: "Tattoo Parlour", path: "/tattoo-parlour", icon: Star },
        ],
      },
      {
        label: "Owned",
        items: [{ label: "Inventory", path: "/inventory", icon: ShoppingBag }],
      },
    ],
  },
  {
    id: "admin",
    label: "Admin",
    icon: Shield,
    rootPath: "/admin",
    matchPaths: ["/admin"],
    subTabs: [
      { label: "Panel", path: "/admin", icon: Shield },
    ],
    sidebar: [
      {
        label: "Admin",
        items: [{ label: "Admin Panel", path: "/admin", icon: Shield }],
      },
    ],
  },
];

export function findModuleForPath(pathname: string): FMModule {
  // Longest matching path wins
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
