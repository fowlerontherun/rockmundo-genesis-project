import { Backpack, BookOpen, Calendar, GraduationCap, Heart, Package, Palette, Sparkles, Trophy, Users, Zap } from "lucide-react";
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
