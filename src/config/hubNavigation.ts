import { Backpack, BookOpen, Calendar, Disc3, DollarSign, GraduationCap, Guitar, Heart, History, ListMusic, Mic2, Music, Package, Palette, Radio, Settings, Sparkles, Trophy, Users, Zap } from "lucide-react";
import type { HubNavigationItem } from "@/components/hub/HubLayout";

export const characterHubNavigation: HubNavigationItem[] = [
  { id: "overview", label: "Overview", path: "/character", icon: Users, matchPaths: ["/character/overview", "/hub/character"] },
  { id: "skills", label: "Skills", path: "/skills", icon: Sparkles },
  { id: "wellness", label: "Wellness", path: "/wellness", icon: Heart },
  { id: "inventory", label: "Inventory", path: "/inventory", icon: Backpack },
  { id: "wardrobe", label: "Wardrobe", path: "/clothing-shop", icon: Palette, matchPaths: ["/skin-store", "/tattoo-parlour", "/avatar-designer", "/my-character"] },
  { id: "lifestyle", label: "Lifestyle", path: "/housing", icon: Package, matchPaths: ["/personal-vehicles", "/gear", "/gear-shop"] },
  { id: "achievements", label: "Achievements", path: "/hall-of-immortals", icon: Trophy },
  { id: "history", label: "History", path: "/legacy", icon: BookOpen, matchPaths: ["/family/timeline", "/family/child/:childId"] },
];

export const scheduleHubNavigation: HubNavigationItem[] = [
  { id: "overview", label: "Overview", path: "/schedule", icon: Calendar },
  { id: "education", label: "Education", path: "/booking/education", icon: GraduationCap },
  { id: "performance", label: "Performance", path: "/booking/performance", icon: Zap },
  { id: "work", label: "Work", path: "/booking/work", icon: Package },
  { id: "songwriting", label: "Songwriting", path: "/booking/songwriting", icon: Sparkles },
];

export const musicHubNavigation: HubNavigationItem[] = [
  { id: "overview", label: "Overview", path: "/music", icon: Music, matchPaths: ["/music/overview", "/hub/music", "/music-hub"] },
  { id: "songs", label: "Songs", path: "/music/songs", icon: ListMusic, matchPaths: ["/song-manager", "/song/:songId"] },
  { id: "songwriting", label: "Songwriting", path: "/music/songwriting", icon: Sparkles, matchPaths: ["/songwriting", "/booking/songwriting"] },
  { id: "practice", label: "Practice", path: "/music/practice", icon: Guitar, matchPaths: ["/stage-practice"] },
  { id: "rehearsals", label: "Rehearsals", path: "/music/rehearsals", icon: Users, matchPaths: ["/rehearsals"] },
  { id: "jam-sessions", label: "Jam Sessions", path: "/music/jam-sessions", icon: Mic2, matchPaths: ["/jam-sessions", "/jams"] },
  { id: "recording", label: "Recording", path: "/music/recording", icon: Disc3, matchPaths: ["/recording-studio"] },
  { id: "releases", label: "Releases", path: "/music/releases", icon: Radio, matchPaths: ["/release-manager", "/release/:id"] },
  { id: "setlists", label: "Setlists", path: "/music/setlists", icon: ListMusic, matchPaths: ["/setlists"] },
];


export const bandHubNavigation: HubNavigationItem[] = [
  { id: "overview", label: "Overview", path: "/band", icon: Music, matchPaths: ["/band/overview", "/hub/band", "/hub/live", "/hub/band-live"] },
  { id: "members", label: "Members & Roles", path: "/band/members", icon: Users },
  { id: "fame", label: "Fame & Fans", path: "/band/fame", icon: Trophy, matchPaths: ["/band-rankings", "/band-fame-map"] },
  { id: "repertoire", label: "Repertoire", path: "/band/repertoire", icon: ListMusic, matchPaths: ["/setlists"] },
  { id: "rehearsals", label: "Rehearsals", path: "/band/rehearsals", icon: Mic2, matchPaths: ["/rehearsals", "/jam-sessions", "/jams"] },
  { id: "gigs", label: "Gigs", path: "/band/gigs", icon: Zap, matchPaths: ["/gigs", "/gig-booking", "/gigs/perform/:gigId", "/performance/gig/:gigId"] },
  { id: "tours", label: "Tours", path: "/band/tours", icon: Calendar, matchPaths: ["/tour-manager", "/band-vehicles", "/band-riders"] },
  { id: "equipment", label: "Equipment & Crew", path: "/band/equipment", icon: Package, matchPaths: ["/stage-setup", "/stage-equipment", "/band-crew"] },
  { id: "finances", label: "Finances", path: "/band/finances", icon: DollarSign, matchPaths: ["/finances"] },
  { id: "chemistry", label: "Chemistry", path: "/band/chemistry", icon: Sparkles, matchPaths: ["/chemistry"] },
  { id: "history", label: "History", path: "/band/history", icon: History },
  { id: "settings", label: "Settings", path: "/band/settings", icon: Settings },
];
