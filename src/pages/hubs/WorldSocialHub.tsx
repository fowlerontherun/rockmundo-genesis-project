import { CategoryHub } from "@/components/CategoryHub";
import { Globe, Plane, Bus, Building2, Home, Twitter, Video, Heart, HandHeart, UserPlus, Sparkles, Ticket, Radio, Tv, Newspaper, BookOpen, Mic, Film } from "lucide-react";
import { useGameData } from "@/hooks/useGameData";

export default function WorldSocialHub() {
  const { currentCity } = useGameData();
  const cityPath = currentCity?.id ? `/cities/${currentCity.id}` : "/cities";

  return (
    <CategoryHub
      titleKey="nav.worldSocial"
      description="Explore the world, connect with others, and engage with media."
      groups={[
        {
          label: "World & Travel",
          tiles: [
            { icon: Globe, labelKey: "nav.cities", path: "/cities" },
            { icon: Plane, labelKey: "nav.travel", path: "/travel" },
            { icon: Bus, labelKey: "nav.tours", path: "/tour-manager" },
            { icon: Building2, labelKey: "nav.currentCity", path: cityPath },
            { icon: Globe, labelKey: "nav.worldPulse", path: "/world-pulse" },
            { icon: Home, labelKey: "Housing", path: "/housing" },
          ],
        },
        {
          label: "Social",
          tiles: [
            { icon: Twitter, labelKey: "nav.twaater", path: "/twaater" },
            { icon: Video, labelKey: "nav.dikcok", path: "/dikcok" },
            { icon: Heart, labelKey: "nav.relationships", path: "/relationships" },
            { icon: HandHeart, labelKey: "nav.gettit", path: "/gettit" },
            { icon: UserPlus, labelKey: "nav.playerSearch", path: "/players/search" },
            { icon: Sparkles, labelKey: "nav.underworld", path: "/underworld" },
            { icon: Ticket, labelKey: "Lottery", path: "/lottery" },
          ],
        },
        {
          label: "Media",
          tiles: [
            { icon: Radio, labelKey: "nav.radio", path: "/media/radio" },
            { icon: Tv, labelKey: "nav.tvShows", path: "/media/tv-shows" },
            { icon: Newspaper, labelKey: "nav.newspapers", path: "/media/newspapers" },
            { icon: BookOpen, labelKey: "nav.magazines", path: "/media/magazines" },
            { icon: Mic, labelKey: "nav.podcasts", path: "/media/podcasts" },
            { icon: Film, labelKey: "nav.films", path: "/media/films" },
            { icon: Globe, labelKey: "nav.websites", path: "/media/websites" },
          ],
        },
      ]}
    />
  );
}
