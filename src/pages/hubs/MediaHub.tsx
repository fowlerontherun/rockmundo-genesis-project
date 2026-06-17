import { CategoryHub } from "@/components/CategoryHub";
import { Radio, Tv, Mic, Newspaper, BookOpen, Globe, Film, Megaphone } from "lucide-react";

export default function MediaHub() {
  return (
    <CategoryHub
      titleKey="nav.media"
      description="Broadcast, press, screen — and outbound promotion."
      groups={[
        {
          label: "Broadcast",
          tiles: [
            { icon: Radio, labelKey: "nav.radio", path: "/media/radio", imagePrompt: "A retro radio station studio with turntables, vinyl records, and an ON AIR sign" },
            { icon: Tv, labelKey: "nav.tvShows", path: "/media/tv-shows", imagePrompt: "A TV studio set with cameras, bright lights, and a talk show host desk" },
            { icon: Mic, labelKey: "nav.podcasts", path: "/media/podcasts", imagePrompt: "A podcast recording setup with professional microphone and headphones" },
          ],
        },
        {
          label: "Press",
          tiles: [
            { icon: Newspaper, labelKey: "nav.newspapers", path: "/media/newspapers", imagePrompt: "A stack of newspapers with music headlines and band photos on the front" },
            { icon: BookOpen, labelKey: "nav.magazines", path: "/media/magazines", imagePrompt: "Glossy music magazines spread out showing artist covers and feature stories" },
            { icon: Globe, labelKey: "nav.websites", path: "/media/websites", imagePrompt: "A computer screen showing music blog websites with reviews and interviews" },
          ],
        },
        {
          label: "Screen",
          tiles: [
            { icon: Film, labelKey: "nav.films", path: "/media/films", imagePrompt: "A movie theater marquee showing music documentary and concert film titles" },
          ],
        },
        {
          label: "Outbound",
          tiles: [
            { icon: Megaphone, labelKey: "Self-Promotion", path: "/media/self-promotion", imagePrompt: "A megaphone and posters on a brick wall promoting an upcoming gig" },
            { icon: BookOpen, labelKey: "PR History", path: "/media/pr-history", imagePrompt: "An archive of press clippings and PR submissions in a binder" },
          ],
        },
      ]}
    />
  );
}
