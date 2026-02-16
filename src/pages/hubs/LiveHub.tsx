import { CategoryHub } from "@/components/CategoryHub";
import { Calendar, Mic, Music, ListMusic, Wrench } from "lucide-react";

export default function LiveHub() {
  return (
    <CategoryHub
      titleKey="nav.live"
      description="Perform live — gigs, open mics, jams, busking, and rehearsals."
      tiles={[
        { icon: Calendar, labelKey: "nav.gigs", path: "/gigs" },
        { icon: Mic, labelKey: "nav.openMic", path: "/open-mic" },
        { icon: Music, labelKey: "nav.jamSessions", path: "/jam-sessions" },
        { icon: Music, labelKey: "nav.busking", path: "/busking" },
        { icon: Music, labelKey: "nav.rehearsals", path: "/rehearsals" },
        { icon: ListMusic, labelKey: "nav.setlists", path: "/setlists" },
        { icon: Wrench, labelKey: "nav.stageEquipment", path: "/stage-equipment" },
      ]}
    />
  );
}
