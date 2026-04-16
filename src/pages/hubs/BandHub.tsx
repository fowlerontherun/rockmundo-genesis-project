import { CategoryHub } from "@/components/CategoryHub";
import { Users, Sparkles, Globe, Trophy, UserPlus, Bus, Target, Map } from "lucide-react";

export default function BandHub() {
  return (
    <CategoryHub
      titleKey="nav.band"
      description="Manage your band, chemistry, crew, and rankings."
      tiles={[
        { icon: Users, labelKey: "nav.bandManager", path: "/band", imagePrompt: "A rock band group photo in a rehearsal room with instruments and band logo on the wall" },
        { icon: Sparkles, labelKey: "nav.bandChemistry", path: "/chemistry", imagePrompt: "Band members high-fiving with sparkles and energy flowing between them, chemistry vibes" },
        { icon: Globe, labelKey: "nav.bandFinder", path: "/bands/finder", imagePrompt: "A globe with musician silhouettes connected by lines, searching for band members worldwide" },
        { icon: Trophy, labelKey: "nav.bandRankings", path: "/band-rankings", imagePrompt: "A leaderboard with band names and rankings, trophies and spotlights on top bands" },
        { icon: UserPlus, labelKey: "nav.bandCrew", path: "/band-crew", imagePrompt: "Stage crew members setting up equipment, roadies carrying gear backstage" },
        { icon: Bus, labelKey: "nav.bandVehicles", path: "/band-vehicles", imagePrompt: "A colorful tour bus with rock band artwork driving on a highway at sunset" },
        { icon: Target, labelKey: "nav.bandRiders", path: "/band-riders", imagePrompt: "A backstage rider checklist with food, drinks, and equipment demands on a clipboard" },
        { icon: Map, labelKey: "nav.bandFameMap", path: "/band-fame-map", imagePrompt: "A glowing world map with neon heat spots showing band popularity across countries and cities" },
      ]}
    />
  );
}
