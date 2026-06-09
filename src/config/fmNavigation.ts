import {
  LayoutDashboard, Music, Users, Mic2, Briefcase, Globe, MessageSquare,
  Building2, Shield, BookOpen, DollarSign, Calendar, Trophy, Radio,
  Disc3, ListMusic, BarChart3, Guitar, MapPin, Plane, Heart, Sparkles,
  Newspaper, Tv, Hammer, GraduationCap, Award,
  Star, ShoppingBag, Package, type LucideIcon,
} from "lucide-react";

export type FMSubLink = { label: string; path: string; icon?: LucideIcon };
export type FMModule = {
  id: string;
  label: string;
  icon: LucideIcon;
  rootPath: string;
  matchPaths: string[];
  subTabs: FMSubLink[];
  sidebar: { label: string; items: FMSubLink[] }[];
};

export const FM_MODULES: FMModule[] = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    rootPath: "/dashboard",
    matchPaths: ["/dashboard", "/my-character", "/hub/character", "/inbox", "/schedule", "/wellness", "/avatar-designer"],
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
          { label: "Character Hub", path: "/hub/character", icon: Users },
          { label: "Edit Character", path: "/my-character", icon: Users },
          { label: "Avatar Designer", path: "/avatar-designer", icon: Sparkles },
          { label: "Wellness", path: "/wellness", icon: Heart },
        ],
      },
      {
        label: "Inbox & Schedule",
        items: [
          { label: "Inbox", path: "/inbox", icon: MessageSquare },
          { label: "Schedule", path: "/schedule", icon: Calendar },
          { label: "Statistics", path: "/statistics", icon: BarChart3 },
        ],
      },
    ],
  },
  {
    id: "music",
    label: "Music",
    icon: Music,
    rootPath: "/hub/music",
    matchPaths: ["/hub/music", "/songwriting", "/recording-studio", "/release-manager", "/song-market", "/song-rankings", "/music/charts", "/streaming-platforms", "/streaming", "/stage-practice"],
    subTabs: [
      { label: "Hub", path: "/hub/music", icon: Music },
      { label: "Songwriting", path: "/songwriting", icon: ListMusic },
      { label: "Studio", path: "/recording-studio", icon: Disc3 },
      { label: "Releases", path: "/release-manager", icon: Disc3 },
      { label: "Charts", path: "/music/charts", icon: BarChart3 },
      { label: "Market", path: "/song-market", icon: ShoppingBag },
    ],
    sidebar: [
      {
        label: "Create",
        items: [
          { label: "Songwriting", path: "/songwriting", icon: ListMusic },
          { label: "Recording Studio", path: "/recording-studio", icon: Disc3 },
          { label: "Stage Practice", path: "/stage-practice", icon: Guitar },
        ],
      },
      {
        label: "Release & Distribute",
        items: [
          { label: "Release Manager", path: "/release-manager", icon: Disc3 },
          { label: "Streaming Platforms", path: "/streaming-platforms", icon: Radio },
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
    matchPaths: ["/band", "/hub/band", "/hub/band-live", "/chemistry", "/bands", "/setlists", "/rehearsals", "/band-crew", "/band-riders", "/band-vehicles", "/band-rankings", "/band-fame-map"],
    subTabs: [
      { label: "Manage", path: "/band", icon: Users },
      { label: "Chemistry", path: "/chemistry", icon: Sparkles },
      { label: "Setlists", path: "/setlists", icon: ListMusic },
      { label: "Rehearsals", path: "/rehearsals", icon: Guitar },
      { label: "Crew", path: "/band-crew", icon: Users },
      { label: "Browse", path: "/bands/browse", icon: Users },
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
          { label: "Riders", path: "/band-riders", icon: ListMusic },
          { label: "Vehicles", path: "/band-vehicles", icon: Plane },
          { label: "Crew", path: "/band-crew", icon: Users },
        ],
      },
      {
        label: "Discover",
        items: [
          { label: "Browse Bands", path: "/bands/browse", icon: Users },
          { label: "Band Finder", path: "/bands/finder", icon: Users },
          { label: "Rankings", path: "/band-rankings", icon: Trophy },
          { label: "Fame Map", path: "/band-fame-map", icon: MapPin },
        ],
      },
    ],
  },
  {
    id: "live",
    label: "Live",
    icon: Mic2,
    rootPath: "/gigs",
    matchPaths: ["/hub/live", "/hub/band-live", "/gigs", "/gig-booking", "/festivals", "/tour-manager", "/awards", "/hall-of-immortals", "/stage-setup", "/stage-equipment"],
    subTabs: [
      { label: "Book Gigs", path: "/gig-booking", icon: Calendar },
      { label: "My Gigs", path: "/gigs", icon: Mic2 },
      { label: "Festivals", path: "/festivals", icon: Trophy },
      { label: "Tours", path: "/tour-manager", icon: Plane },
      { label: "Awards", path: "/awards", icon: Award },
    ],
    sidebar: [
      {
        label: "Gigs",
        items: [
          { label: "Book Gigs", path: "/gig-booking", icon: Calendar },
          { label: "My Gigs", path: "/gigs", icon: Mic2 },
          { label: "Stage Setup", path: "/stage-setup", icon: Guitar },
          { label: "Stage Equipment", path: "/stage-equipment", icon: Guitar },
        ],
      },
      {
        label: "Tours & Festivals",
        items: [
          { label: "Tour Manager", path: "/tour-manager", icon: Plane },
          { label: "Festivals", path: "/festivals", icon: Trophy },
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
    matchPaths: ["/hub/career-business", "/finances", "/employment", "/education", "/teaching", "/sponsorships", "/record-label", "/booking", "/venues", "/merchandise", "/venue-business", "/merch-factory", "/logistics-company", "/security-firm"],
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
          { label: "Sponsorships", path: "/sponsorships", icon: Award },
        ],
      },
      {
        label: "Growth",
        items: [
          { label: "Education", path: "/education", icon: GraduationCap },
          { label: "Teaching", path: "/teaching", icon: BookOpen },
          { label: "Employment", path: "/employment", icon: Briefcase },
          { label: "Book Education", path: "/booking/education", icon: GraduationCap },
          { label: "Book Work", path: "/booking/work", icon: Briefcase },
        ],
      },
      {
        label: "Business",
        items: [
          { label: "Record Label", path: "/record-label", icon: Disc3 },
          { label: "Venues", path: "/venues", icon: Building2 },
          { label: "Merchandise", path: "/merchandise", icon: ShoppingBag },
        ],
      },
    ],
  },
  {
    id: "world",
    label: "World",
    icon: Globe,
    rootPath: "/world-map",
    matchPaths: ["/hub/world-social", "/world-map", "/world-pulse", "/world-parliament", "/political-party", "/politics-career"],
    subTabs: [
      { label: "Map", path: "/world-map", icon: MapPin },
      { label: "Pulse", path: "/world-pulse", icon: Radio },
      { label: "Parliament", path: "/world-parliament", icon: Hammer },
      { label: "Party", path: "/political-party", icon: Users },
    ],
    sidebar: [
      {
        label: "Explore",
        items: [
          { label: "World Map", path: "/world-map", icon: MapPin },
          { label: "World Pulse", path: "/world-pulse", icon: Radio },
        ],
      },
      {
        label: "Politics",
        items: [
          { label: "World Parliament", path: "/world-parliament", icon: Hammer },
          { label: "Political Party", path: "/political-party", icon: Users },
          { label: "Party Standings", path: "/political-party/standings", icon: BarChart3 },
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
    matchPaths: ["/social", "/twaater", "/dikcok", "/gettit", "/public-relations"],
    subTabs: [
      { label: "Hub", path: "/social", icon: MessageSquare },
      { label: "Twaater", path: "/twaater", icon: Newspaper },
      { label: "DikCok", path: "/dikcok", icon: Tv },
      { label: "Gettit", path: "/gettit", icon: MessageSquare },
      { label: "PR", path: "/public-relations", icon: Newspaper },
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
        label: "Media",
        items: [
          { label: "Twaater", path: "/twaater", icon: Newspaper },
          { label: "Twaater Messages", path: "/twaater/messages", icon: MessageSquare },
          { label: "DikCok", path: "/dikcok", icon: Tv },
          { label: "Gettit", path: "/gettit", icon: MessageSquare },
          { label: "Public Relations", path: "/public-relations", icon: Newspaper },
        ],
      },
    ],
  },
  {
    id: "commerce",
    label: "Store",
    icon: ShoppingBag,
    rootPath: "/gear",
    matchPaths: ["/gear", "/gear-shop", "/clothing-shop", "/clothing-designer", "/tattoo-parlour", "/inventory", "/merchandise"],
    subTabs: [
      { label: "Gear", path: "/gear", icon: Guitar },
      { label: "Clothing", path: "/clothing-shop", icon: ShoppingBag },
      { label: "Tattoos", path: "/tattoo-parlour", icon: Star },
      { label: "Inventory", path: "/inventory", icon: Package },
    ],
    sidebar: [
      {
        label: "Shops",
        items: [
          { label: "Equipment / Gear", path: "/gear", icon: Guitar },
          { label: "Clothing Shop", path: "/clothing-shop", icon: ShoppingBag },
          { label: "Clothing Designer", path: "/clothing-designer", icon: Sparkles },
          { label: "Tattoo Parlour", path: "/tattoo-parlour", icon: Star },
        ],
      },
      {
        label: "Owned",
        items: [
          { label: "Inventory", path: "/inventory", icon: Package },
          { label: "Merchandise", path: "/merchandise", icon: ShoppingBag },
        ],
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
