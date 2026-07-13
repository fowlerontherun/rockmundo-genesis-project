import { Backpack, BookOpen, Calendar, Disc3, GraduationCap, Guitar, Heart, ListMusic, Mic2, Music, Package, Palette, Radio, Sparkles, Trophy, Users, Zap } from "lucide-react";
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
