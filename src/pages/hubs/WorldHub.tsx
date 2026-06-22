import { CategoryHub } from "@/components/CategoryHub";
import { Globe, Plane, Building2, MapPin, Calendar, Hammer, Flag, BarChart3, Vote, Radio, Star, Landmark } from "lucide-react";
import { useGameData } from "@/hooks/useGameData";

export default function WorldHub() {
  const { currentCity } = useGameData();
  const cityPath = currentCity?.id ? `/cities/${currentCity.id}` : "/cities";

  return (
    <CategoryHub
      titleKey="nav.world"
      description="Explore places, travel between them, and shape politics."
      groups={[
        {
          label: "Explore",
          tiles: [
            { icon: Globe, labelKey: "nav.cities", path: "/cities", imagePrompt: "A world map with glowing city pins showing major music capitals" },
            { icon: Building2, labelKey: "nav.currentCity", path: cityPath, tileImageKey: "current-city", imagePrompt: "A vibrant city skyline with neon signs and music venues" },
            { icon: Plane, labelKey: "nav.travel", path: "/travel", imagePrompt: "An airplane flying over iconic landmarks with a passport and boarding pass" },
            { icon: Radio, labelKey: "nav.worldPulse", path: "/world-pulse", imagePrompt: "A pulse line overlaid on a globe showing trending music events" },
            { icon: Star, labelKey: "City Landmarks", path: "/landmarks", imagePrompt: "Famous city landmarks lit up at night with crowds and music posters" },
            { icon: Calendar, labelKey: "Seasonal Events", path: "/seasonal-events", imagePrompt: "A calendar showing seasonal music festivals and holiday events" },
          ],
        },
        {
          label: "Politics",
          tiles: [
            { icon: Hammer, labelKey: "World Parliament", path: "/world-parliament", imagePrompt: "A grand parliament chamber with delegates debating policy" },
            { icon: Flag, labelKey: "Political Parties", path: "/political-party", tileImageKey: "political-party", imagePrompt: "A political party headquarters with flags and a podium" },
            { icon: BarChart3, labelKey: "Party Standings", path: "/political-party/standings", tileImageKey: "party-standings", imagePrompt: "A leaderboard showing political party rankings and vote counts" },
            { icon: Vote, labelKey: "Politics Career", path: "/politics-career", tileImageKey: "politics-career", imagePrompt: "A politician at a podium giving a campaign speech with cameras and a crowd" },
          ],
        },
      ]}
    />
  );
}
