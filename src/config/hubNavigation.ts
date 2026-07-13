import { Award, Backpack, BarChart3, BookOpen, Briefcase, Globe2, Building2, Calendar, Compass, Disc3, DollarSign, GraduationCap, Guitar, Heart, History, Inbox, Landmark, ListMusic, MapPin, Megaphone, MessageSquare, Mic2, Music, Newspaper, Package, Palette, Plane, Radio, ReceiptText, Search, Settings, Sparkles, Star, Trophy, Users, Zap } from "lucide-react";
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

export const worldHubNavigation: HubNavigationItem[] = [
  { id: "overview", label: "Overview", path: "/world", icon: Globe2, matchPaths: ["/world/overview", "/hub/world", "/hub/world-social"] },
  { id: "current-city", label: "Current City", path: "/world/current-city", icon: MapPin },
  { id: "travel", label: "Travel", path: "/world/travel", icon: Plane, matchPaths: ["/travel"] },
  { id: "cities", label: "Cities", path: "/world/cities", icon: MapPin, matchPaths: ["/cities", "/cities/:cityId", "/cities/treasury"] },
  { id: "venues", label: "Venues", path: "/world/venues", icon: Building2, matchPaths: ["/venues", "/venue-business/:venueId"] },
  { id: "studios", label: "Studios", path: "/world/studios", icon: Disc3, matchPaths: ["/recording-studio", "/recording-studio-business/:studioId", "/rehearsal-studio-business/:studioId"] },
  { id: "companies", label: "Companies", path: "/world/companies", icon: Briefcase, matchPaths: ["/world-companies", "/companies/directory", "/company/:companyId"] },
  { id: "events", label: "Events", path: "/world/events", icon: Calendar, matchPaths: ["/major-events", "/events/eurovision"] },
  { id: "festivals", label: "Festivals", path: "/world/festivals", icon: Star, matchPaths: ["/festivals", "/festivals/:festivalId"] },
  { id: "pulse", label: "World Pulse", path: "/world/pulse", icon: Radio, matchPaths: ["/world-pulse"] },
  { id: "leaderboards", label: "Leaderboards", path: "/world/leaderboards", icon: Trophy, matchPaths: ["/band-rankings", "/band-fame-map", "/song-rankings"] },
  { id: "treasuries", label: "Treasuries", path: "/world/treasuries", icon: Landmark, matchPaths: ["/cities/treasury"], mobileVisible: false },
];

export const socialHubNavigation: HubNavigationItem[] = [
  { id: "overview", label: "Overview", path: "/social", icon: Users, matchPaths: ["/social/overview", "/hub/social"] },
  { id: "friends", label: "Friends", path: "/social/friends", icon: Heart, matchPaths: ["/relationships", "/social?tab=friends"] },
  { id: "players", label: "Players", path: "/social/players", icon: Search, matchPaths: ["/players/search", "/player/:playerId", "/social?tab=discover"] },
  { id: "messages", label: "Messages", path: "/social/messages", icon: MessageSquare, matchPaths: ["/twaater/messages", "/social?tab=messages"] },
  { id: "twaater", label: "Twaater", path: "/social/twaater", icon: Newspaper, matchPaths: ["/twaater", "/twaater/:handle", "/twaater/tag/:hashtag", "/twaater/twaat/:twaatId", "/twaater/notifications", "/twaater/analytics"] },
  { id: "recruitment", label: "Recruitment", path: "/social/recruitment", icon: Compass, matchPaths: ["/bands/finder", "/bands/browse", "/bands/search", "/band/:bandId"] },
  { id: "invitations", label: "Invitations", path: "/social/invitations", icon: Inbox, matchPaths: ["/social?tab=invites"] },
];

export const businessHubNavigation: HubNavigationItem[] = [
  { id: "overview", label: "Overview", path: "/business", icon: Building2, matchPaths: ["/business/overview", "/hub/commerce"] },
  { id: "companies", label: "Companies", path: "/business/companies", icon: Building2, matchPaths: ["/my-companies"] },
  { id: "staff", label: "Staff", path: "/business/staff", icon: Users, matchPaths: ["/company/:companyId", "/security-firm/:companyId", "/merch-factory/:companyId", "/venue-business/:venueId", "/rehearsal-studio-business/:studioId", "/recording-studio-business/:studioId"] },
  { id: "recruitment", label: "Recruitment", path: "/business/recruitment", icon: Briefcase, matchPaths: ["/business/job-adverts"] },
  { id: "finances", label: "Finances", path: "/business/finances", icon: DollarSign },
  { id: "advertising", label: "Advertising", path: "/business/advertising", icon: Megaphone, matchPaths: ["/pr", "/public-relations"] },
  { id: "labels", label: "Labels", path: "/business/labels", icon: Disc3, matchPaths: ["/labels", "/record-label", "/labels/:labelId/manage"] },
  { id: "reports", label: "Reports", path: "/business/reports", icon: BarChart3 },
];

export const careerHubNavigation: HubNavigationItem[] = [
  { id: "overview", label: "Overview", path: "/career", icon: Trophy, matchPaths: ["/career/overview", "/hub/career", "/hub/career-business"] },
  { id: "employment", label: "Employment", path: "/career/employment", icon: Briefcase, matchPaths: ["/employment", "/jobs"] },
  { id: "finances", label: "Personal Finances", path: "/career/finances", icon: DollarSign, matchPaths: ["/finances", "/sponsorships", "/offers-dashboard"] },
  { id: "fame", label: "Fame & Fans", path: "/career/fame", icon: Star, matchPaths: ["/fan-management"] },
  { id: "charts", label: "Charts", path: "/career/charts", icon: BarChart3, matchPaths: ["/competitive-charts", "/country-charts", "/music/charts"] },
  { id: "awards", label: "Awards", path: "/career/awards", icon: Award, matchPaths: ["/awards"] },
  { id: "achievements", label: "Achievements", path: "/career/achievements", icon: Trophy, matchPaths: ["/hall-of-immortals"] },
  { id: "discography", label: "Discography", path: "/career/discography", icon: Disc3, matchPaths: ["/release-manager", "/release/:id"] },
  { id: "history", label: "History", path: "/career/history", icon: ReceiptText, matchPaths: ["/legacy", "/statistics", "/journal"] },
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
