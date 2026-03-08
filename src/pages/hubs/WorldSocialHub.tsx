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
            { icon: Globe, labelKey: "nav.cities", path: "/cities", imagePrompt: "A world map with glowing city pins showing major music capitals like London, NYC, Tokyo" },
            { icon: Plane, labelKey: "nav.travel", path: "/travel", imagePrompt: "An airplane flying over iconic landmarks with a passport and boarding pass" },
            { icon: Bus, labelKey: "nav.tours", path: "/tour-manager", imagePrompt: "A tour bus route map with concert dates pinned across different cities" },
            { icon: Building2, labelKey: "nav.currentCity", path: cityPath, imagePrompt: "A vibrant city skyline with neon signs, music venues, and nightlife" },
            { icon: Globe, labelKey: "nav.worldPulse", path: "/world-pulse", imagePrompt: "A pulse/heartbeat line overlaid on a globe showing trending music events worldwide" },
            { icon: Home, labelKey: "Housing", path: "/housing", imagePrompt: "A cozy musician apartment with posters, instruments, and city view from the window" },
          ],
        },
        {
          label: "Social",
          tiles: [
            { icon: Twitter, labelKey: "nav.twaater", path: "/twaater", imagePrompt: "A social media feed showing tweets, likes, and trending music topics on a phone screen" },
            { icon: Video, labelKey: "nav.dikcok", path: "/dikcok", imagePrompt: "A vertical video app showing viral music clips with hearts and comment bubbles" },
            { icon: Heart, labelKey: "nav.relationships", path: "/relationships", imagePrompt: "Two people connecting over music at a cafe, hearts and music notes floating between them" },
            { icon: HandHeart, labelKey: "nav.gettit", path: "/gettit", imagePrompt: "A Reddit-style forum with music discussion threads, upvotes, and community posts" },
            { icon: UserPlus, labelKey: "nav.playerSearch", path: "/players/search", imagePrompt: "A search interface showing musician profiles with instruments and genre tags" },
            { icon: Sparkles, labelKey: "nav.underworld", path: "/underworld", imagePrompt: "A dark underground club scene with mysterious lighting and shadowy figures dealing" },
            { icon: Ticket, labelKey: "Lottery", path: "/lottery", imagePrompt: "A golden lottery ticket with sparkles and a spinning prize wheel" },
          ],
        },
        {
          label: "Media",
          tiles: [
            { icon: Radio, labelKey: "nav.radio", path: "/media/radio", imagePrompt: "A retro radio station studio with turntables, vinyl records, and an ON AIR sign" },
            { icon: Tv, labelKey: "nav.tvShows", path: "/media/tv-shows", imagePrompt: "A TV studio set with cameras, bright lights, and a talk show host desk" },
            { icon: Newspaper, labelKey: "nav.newspapers", path: "/media/newspapers", imagePrompt: "A stack of newspapers with music headlines and band photos on the front page" },
            { icon: BookOpen, labelKey: "nav.magazines", path: "/media/magazines", imagePrompt: "Glossy music magazines spread out showing artist covers and feature stories" },
            { icon: Mic, labelKey: "nav.podcasts", path: "/media/podcasts", imagePrompt: "A podcast recording setup with professional microphone, headphones, and soundwaves" },
            { icon: Film, labelKey: "nav.films", path: "/media/films", imagePrompt: "A movie theater marquee showing music documentary and concert film titles" },
            { icon: Globe, labelKey: "nav.websites", path: "/media/websites", imagePrompt: "A computer screen showing music blog websites with reviews and artist interviews" },
          ],
        },
      ]}
    />
  );
}
