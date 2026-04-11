import { CategoryHub } from "@/components/CategoryHub";
import { Globe, Plane, Bus, Building2, Home, Car, Disc3 } from "lucide-react";
import { useGameData } from "@/hooks/useGameData";

export default function WorldHub() {
  const { currentCity } = useGameData();
  const cityPath = currentCity?.id ? `/cities/${currentCity.id}` : "/cities";

  return (
    <CategoryHub
      titleKey="nav.world"
      description="Explore cities, travel, tour, and find housing."
      tiles={[
        { icon: Globe, labelKey: "nav.cities", path: "/cities", imagePrompt: "A world map with glowing city pins showing major music capitals like London, NYC, Tokyo" },
        { icon: Plane, labelKey: "nav.travel", path: "/travel", imagePrompt: "An airplane flying over iconic landmarks with a passport and boarding pass" },
        { icon: Bus, labelKey: "nav.tours", path: "/tour-manager", imagePrompt: "A tour bus route map with concert dates pinned across different cities" },
        { icon: Building2, labelKey: "nav.currentCity", path: cityPath, imagePrompt: "A vibrant city skyline with neon signs, music venues, and nightlife" },
        { icon: Disc3, labelKey: "Nightclubs", path: "/nightclubs", imagePrompt: "A dark neon-lit nightclub interior with DJ booth, turntables, laser lights and dancing crowd" },
        { icon: Globe, labelKey: "nav.worldPulse", path: "/world-pulse", imagePrompt: "A pulse/heartbeat line overlaid on a globe showing trending music events worldwide" },
        { icon: Home, labelKey: "Housing", path: "/housing", imagePrompt: "A cozy musician apartment with posters, instruments, and city view from the window" },
        { icon: Car, labelKey: "Cars & Motorbikes", path: "/personal-vehicles", imagePrompt: "A stylish garage with a luxury car and a custom motorbike under neon lights" },
      ]}
    />
  );
}
