import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Users, Music, Building2, Trophy, DollarSign, Map, GraduationCap, 
  Radio, Settings, FileText, Warehouse, TrendingUp, Shield, Briefcase,
  Guitar, Sparkles, Calendar, Cog
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface AdminCategory {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  items: AdminMenuItem[];
}

interface AdminMenuItem {
  path: string;
  label: string;
  description?: string;
}

export const adminCategories: AdminCategory[] = [
  {
    id: "players",
    title: "Players & Community",
    description: "Manage players, achievements, and community features",
    icon: Users,
    items: [
      { path: "/admin/players", label: "Player Management", description: "Manage user accounts" },
      { path: "/admin/vip", label: "VIP Management", description: "Grant and manage VIP subscriptions" },
      { path: "/admin/achievements", label: "Achievements", description: "Configure achievement system" },
      { path: "/admin/analytics", label: "Analytics", description: "View player statistics" },
      { path: "/admin/mentors", label: "Mentors", description: "Manage mentorship program" },
    ],
  },
  {
    id: "music",
    title: "Music & Content",
    description: "Manage songs, production, and music systems",
    icon: Music,
    items: [
      { path: "/admin/ai-song-generation", label: "AI Song Generation", description: "Test AI audio generation" },
      { path: "/admin/songwriting", label: "Songwriting", description: "Songwriting configuration" },
      { path: "/admin/production-notes", label: "Production Notes", description: "Setlist elements" },
      { path: "/admin/song-gifts", label: "Song Gifts", description: "Gift songs to bands" },
      { path: "/admin/skill-definitions", label: "Skill Definitions", description: "Configure skills" },
      { path: "/admin/charts", label: "Charts", description: "Music chart management" },
      { path: "/admin/stream-multiplier", label: "Stream Multiplier", description: "Boost streams based on active bands" },
      { path: "/admin/streaming-platforms", label: "Streaming Platforms", description: "Manage platforms" },
      { path: "/admin/radio-stations", label: "Radio Stations", description: "Radio network" },
      { path: "/admin/radio-content", label: "Radio Content", description: "Jingles & fake adverts" },
    ],
  },
  {
    id: "bands",
    title: "Bands & Performance",
    description: "Band systems, venues, and stage equipment",
    icon: Guitar,
    items: [
      { path: "/admin/bands", label: "Band Administration", description: "Band mechanics" },
      { path: "/admin/fame-fans-gifting", label: "Fame & Fans Gifting", description: "Gift fame and fans" },
      { path: "/admin/gigs", label: "Gigs", description: "Gig system configuration" },
      { path: "/admin/venues", label: "Venues", description: "Venue management" },
      { path: "/admin/rehearsal-rooms", label: "Rehearsal Rooms", description: "Practice spaces" },
      { path: "/admin/stage-equipment", label: "Stage Equipment", description: "Equipment catalog" },
      { path: "/admin/crew", label: "Crew Catalog", description: "Band crew members" },
      { path: "/admin/stage-templates", label: "Stage Templates", description: "3D stage designs" },
      { path: "/admin/band-avatars", label: "Band Avatars", description: "Avatar presets" },
      { path: "/admin/crowd-behavior", label: "Crowd Behavior", description: "Audience animations" },
      { path: "/admin/crowd-sounds", label: "Crowd Sounds", description: "Gig audio effects" },
      { path: "/admin/parallax-gig-demo", label: "Stage View Demo", description: "Preview & test parallax stage" },
    ],
  },
  {
    id: "events",
    title: "Events & Competitions",
    description: "Festivals, Eurovision, and award shows",
    icon: Trophy,
    items: [
      { path: "/admin/festivals", label: "Festivals", description: "Festival system" },
      { path: "/admin/eurovision", label: "Eurovision", description: "Eurovision management" },
      { path: "/admin/awards", label: "Awards", description: "Award shows" },
    ],
  },
  {
    id: "economy",
    title: "Economy & Resources",
    description: "Marketplace, gear, and economy systems",
    icon: DollarSign,
    items: [
      { path: "/admin/marketplace", label: "Marketplace", description: "Item marketplace" },
      { path: "/admin/gear-items", label: "Gear Items", description: "Gear catalog" },
      { path: "/admin/brands", label: "Brands", description: "Brand management" },
      { path: "/admin/jobs", label: "Jobs", description: "Employment system" },
      { path: "/admin/experience-rewards", label: "Experience Rewards", description: "XP rewards" },
      { path: "/admin/underworld", label: "Underworld", description: "Shadow Store & Crypto" },
    ],
  },
  {
    id: "world",
    title: "World & Locations",
    description: "Cities, venues, and travel systems",
    icon: Map,
    items: [
      { path: "/admin/cities", label: "Cities", description: "City management" },
      { path: "/admin/city-governance", label: "City Governance", description: "Mayors & elections" },
      { path: "/admin/districts", label: "Districts", description: "City districts" },
      { path: "/admin/city-studios", label: "City Studios", description: "Recording studios" },
      { path: "/admin/night-clubs", label: "Night Clubs", description: "Club venues" },
      { path: "/admin/travel", label: "Travel Routes", description: "Transportation" },
    ],
  },
  {
    id: "education",
    title: "Education & Learning",
    description: "Universities, courses, and learning resources",
    icon: GraduationCap,
    items: [
      { path: "/admin/universities", label: "Universities", description: "University system" },
      { path: "/admin/courses", label: "Courses", description: "Course catalog" },
      { path: "/admin/skill-books", label: "Skill Books", description: "Learning materials" },
      { path: "/admin/youtube-videos", label: "YouTube Videos", description: "Video content" },
    ],
  },
  {
    id: "media",
    title: "Media & Social",
    description: "Social media, PR, and communications",
    icon: Radio,
    items: [
      { path: "/admin/twaater", label: "Twaater Admin", description: "Platform management" },
      { path: "/admin/twaater-moderation", label: "Twaater Moderation", description: "Content moderation" },
      { path: "/admin/pr", label: "Public Relations", description: "PR system" },
      { path: "/admin/advisor", label: "Advisor", description: "Advisor system" },
    ],
  },
  {
    id: "labels",
    title: "Labels & Distribution",
    description: "Record labels and music distribution",
    icon: Briefcase,
    items: [
      { path: "/admin/labels", label: "Labels", description: "Record labels" },
      { path: "/admin/producers", label: "Producers", description: "Music producers" },
      { path: "/admin/release-config", label: "Release Config", description: "Release settings" },
    ],
  },
  {
    id: "system",
    title: "System & Configuration",
    description: "System settings and automation",
    icon: Settings,
    items: [
      { path: "/admin/dashboard", label: "Admin Dashboard", description: "Overview & quick actions" },
      { path: "/admin/debug-panel", label: "Debug Panel", description: "Troubleshoot player issues" },
      { path: "/admin/companies", label: "Company Admin", description: "VIP company management" },
      { path: "/admin/security-firms", label: "Security Firms", description: "Global firm management" },
      { path: "/admin/merch-factories", label: "Merch Factories", description: "Factory administration" },
      { path: "/admin/logistics-companies", label: "Logistics", description: "Fleet & delivery management" },
      { path: "/admin/game-balance", label: "Game Balance", description: "Tune XP, economy, fame" },
      { path: "/admin/tutorials", label: "Tutorials", description: "Onboarding steps" },
      { path: "/admin/game-calendar", label: "Game Calendar", description: "Time system" },
      { path: "/admin/cron-monitor", label: "Cron Monitor", description: "Scheduled jobs" },
      { path: "/admin/offer-automation", label: "Offer Automation", description: "Automated offers" },
      { path: "/admin/page-graphics", label: "Page Graphics", description: "UI images" },
      { path: "/admin/releases", label: "Releases Admin", description: "Fix stuck releases" },
    ],
  },
];

interface AdminNavProps {
  onNavigate?: (path: string) => void;
}

export const AdminNav = ({ onNavigate }: AdminNavProps) => {
  const navigate = useNavigate();

  const handleItemClick = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    } else {
      navigate(path);
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {adminCategories.map((category) => {
        const Icon = category.icon;
        return (
          <Card key={category.id} className="hover:border-primary/50 transition-colors">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">{category.title}</CardTitle>
                </div>
              </div>
              <CardDescription className="text-xs">{category.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              {category.items.map((item) => (
                <button
                  key={item.path}
                  onClick={() => handleItemClick(item.path)}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-accent transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium group-hover:text-primary transition-colors">
                      {item.label}
                    </span>
                  </div>
                  {item.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                  )}
                </button>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
