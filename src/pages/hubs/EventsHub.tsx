import { CategoryHub } from "@/components/CategoryHub";
import { Calendar, Award, Star, Trophy } from "lucide-react";

export default function EventsHub() {
  return (
    <CategoryHub
      titleKey="nav.events"
      description="Festivals, awards, and major events."
      tiles={[
        { icon: Calendar, labelKey: "nav.festivals", path: "/festivals", imagePrompt: "A massive outdoor music festival with multiple stages, tents, and thousands of fans" },
        { icon: Award, labelKey: "nav.awards", path: "/awards", imagePrompt: "A glamorous awards ceremony with a golden gramophone trophy on a red carpet stage" },
        { icon: Star, labelKey: "nav.eurovision", path: "/events/eurovision", imagePrompt: "A dazzling Eurovision-style stage with LED screens, national flags, and performers" },
        { icon: Trophy, labelKey: "Major Events", path: "/major-events", imagePrompt: "A stadium hosting a major music event with pyrotechnics and a massive crowd" },
      ]}
    />
  );
}
