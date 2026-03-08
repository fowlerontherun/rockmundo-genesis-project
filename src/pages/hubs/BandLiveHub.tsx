import { CategoryHub } from "@/components/CategoryHub";
import { Users, Sparkles, Globe, Trophy, UserPlus, Bus, Target, Calendar, Mic, Music, ListMusic, Wrench, Award, Star } from "lucide-react";

export default function BandLiveHub() {
  return (
    <CategoryHub
      titleKey="nav.bandLive"
      description="Manage your band, perform live, and compete in events."
      tiles={[
        { icon: Users, labelKey: "nav.bandManager", path: "/band" },
        { icon: Sparkles, labelKey: "nav.bandChemistry", path: "/chemistry" },
        { icon: Globe, labelKey: "nav.bandFinder", path: "/bands/finder" },
        { icon: Trophy, labelKey: "nav.bandRankings", path: "/band-rankings" },
        { icon: UserPlus, labelKey: "nav.bandCrew", path: "/band-crew" },
        { icon: Bus, labelKey: "nav.bandVehicles", path: "/band-vehicles" },
        { icon: Target, labelKey: "nav.bandRiders", path: "/band-riders" },
        { icon: Calendar, labelKey: "nav.gigs", path: "/gigs" },
        { icon: Mic, labelKey: "nav.openMic", path: "/open-mic" },
        { icon: Music, labelKey: "nav.jamSessions", path: "/jam-sessions" },
        { icon: Music, labelKey: "nav.busking", path: "/busking" },
        { icon: Music, labelKey: "nav.rehearsals", path: "/rehearsals" },
        { icon: ListMusic, labelKey: "nav.setlists", path: "/setlists" },
        { icon: Wrench, labelKey: "nav.stageEquipment", path: "/stage-equipment" },
        { icon: Calendar, labelKey: "nav.festivals", path: "/festivals" },
        { icon: Award, labelKey: "nav.awards", path: "/awards" },
        { icon: Star, labelKey: "nav.eurovision", path: "/events/eurovision" },
        { icon: Trophy, labelKey: "Major Events", path: "/major-events" },
      ]}
    />
  );
}
