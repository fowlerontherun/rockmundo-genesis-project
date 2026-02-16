import { CategoryHub } from "@/components/CategoryHub";
import { Radio, Tv, Newspaper, BookOpen, Mic, Film, Globe } from "lucide-react";

export default function MediaHub() {
  return (
    <CategoryHub
      titleKey="nav.media"
      description="Radio, TV, newspapers, magazines, podcasts, films, and websites."
      tiles={[
        { icon: Radio, labelKey: "nav.radio", path: "/media/radio" },
        { icon: Tv, labelKey: "nav.tvShows", path: "/media/tv-shows" },
        { icon: Newspaper, labelKey: "nav.newspapers", path: "/media/newspapers" },
        { icon: BookOpen, labelKey: "nav.magazines", path: "/media/magazines" },
        { icon: Mic, labelKey: "nav.podcasts", path: "/media/podcasts" },
        { icon: Film, labelKey: "nav.films", path: "/media/films" },
        { icon: Globe, labelKey: "nav.websites", path: "/media/websites" },
      ]}
    />
  );
}
