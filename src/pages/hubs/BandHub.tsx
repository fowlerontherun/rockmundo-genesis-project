import { CategoryHub } from "@/components/CategoryHub";
import { Users, Sparkles, Globe, Trophy, UserPlus, Bus, Target } from "lucide-react";

export default function BandHub() {
  return (
    <CategoryHub
      titleKey="nav.band"
      description="Manage your band, chemistry, crew, and rankings."
      tiles={[
        { icon: Users, labelKey: "nav.bandManager", path: "/band" },
        { icon: Sparkles, labelKey: "nav.bandChemistry", path: "/chemistry" },
        { icon: Globe, labelKey: "nav.bandFinder", path: "/bands/finder" },
        { icon: Trophy, labelKey: "nav.bandRankings", path: "/band-rankings" },
        { icon: UserPlus, labelKey: "nav.bandCrew", path: "/band-crew" },
        { icon: Bus, labelKey: "nav.bandVehicles", path: "/band-vehicles" },
        { icon: Target, labelKey: "nav.bandRiders", path: "/band-riders" },
      ]}
    />
  );
}
