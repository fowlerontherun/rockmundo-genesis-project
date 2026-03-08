import { CategoryHub } from "@/components/CategoryHub";
import { Radio, Tv, Newspaper, BookOpen, Mic, Film, Globe } from "lucide-react";

export default function MediaHub() {
  return (
    <CategoryHub
      titleKey="nav.media"
      description="Radio, TV, newspapers, magazines, podcasts, films, and websites."
      tiles={[
        { icon: Radio, labelKey: "nav.radio", path: "/media/radio", imagePrompt: "A retro radio station studio with turntables, vinyl records, and an ON AIR sign" },
        { icon: Tv, labelKey: "nav.tvShows", path: "/media/tv-shows", imagePrompt: "A TV studio set with cameras, bright lights, and a talk show host desk" },
        { icon: Newspaper, labelKey: "nav.newspapers", path: "/media/newspapers", imagePrompt: "A stack of newspapers with music headlines and band photos on the front page" },
        { icon: BookOpen, labelKey: "nav.magazines", path: "/media/magazines", imagePrompt: "Glossy music magazines spread out showing artist covers and feature stories" },
        { icon: Mic, labelKey: "nav.podcasts", path: "/media/podcasts", imagePrompt: "A podcast recording setup with professional microphone, headphones, and soundwaves" },
        { icon: Film, labelKey: "nav.films", path: "/media/films", imagePrompt: "A movie theater marquee showing music documentary and concert film titles" },
        { icon: Globe, labelKey: "nav.websites", path: "/media/websites", imagePrompt: "A computer screen showing music blog websites with reviews and artist interviews" },
      ]}
    />
  );
}
