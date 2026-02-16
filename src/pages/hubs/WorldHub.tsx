import { CategoryHub } from "@/components/CategoryHub";
import { Globe, Plane, Bus, Building2, Home } from "lucide-react";
import { useGameData } from "@/hooks/useGameData";

export default function WorldHub() {
  const { currentCity } = useGameData();
  const cityPath = currentCity?.id ? `/cities/${currentCity.id}` : "/cities";

  return (
    <CategoryHub
      titleKey="nav.world"
      description="Explore cities, travel, tour, and find housing."
      tiles={[
        { icon: Globe, labelKey: "nav.cities", path: "/cities" },
        { icon: Plane, labelKey: "nav.travel", path: "/travel" },
        { icon: Bus, labelKey: "nav.tours", path: "/tour-manager" },
        { icon: Building2, labelKey: "nav.currentCity", path: cityPath },
        { icon: Globe, labelKey: "nav.worldPulse", path: "/world-pulse" },
        { icon: Home, labelKey: "Housing", path: "/housing" },
      ]}
    />
  );
}
