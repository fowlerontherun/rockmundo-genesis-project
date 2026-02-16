import { CategoryHub } from "@/components/CategoryHub";
import { Calendar, Award, Star, Trophy } from "lucide-react";

export default function EventsHub() {
  return (
    <CategoryHub
      titleKey="nav.events"
      description="Festivals, awards, and major events."
      tiles={[
        { icon: Calendar, labelKey: "nav.festivals", path: "/festivals" },
        { icon: Award, labelKey: "nav.awards", path: "/awards" },
        { icon: Star, labelKey: "nav.eurovision", path: "/events/eurovision" },
        { icon: Trophy, labelKey: "Major Events", path: "/major-events" },
      ]}
    />
  );
}
