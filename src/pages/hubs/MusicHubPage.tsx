import { CategoryHub } from "@/components/CategoryHub";
import { Music, GraduationCap, Disc, Music4, Radio, Video, TrendingUp, Store, Trophy } from "lucide-react";

export default function MusicHubPage() {
  return (
    <CategoryHub
      titleKey="nav.music"
      description="Write, record, release, and chart your music."
      tiles={[
        { icon: Music, labelKey: "nav.songwriting", path: "/songwriting" },
        { icon: GraduationCap, labelKey: "nav.education", path: "/education" },
        { icon: Disc, labelKey: "nav.recording", path: "/recording-studio" },
        { icon: Music4, labelKey: "nav.releaseManager", path: "/release-manager" },
        { icon: Radio, labelKey: "nav.streaming", path: "/streaming-platforms" },
        { icon: Video, labelKey: "nav.musicVideos", path: "/music-videos" },
        { icon: TrendingUp, labelKey: "nav.countryCharts", path: "/country-charts" },
        { icon: Store, labelKey: "nav.songMarket", path: "/song-market" },
        { icon: Trophy, labelKey: "nav.songRankings", path: "/song-rankings" },
      ]}
    />
  );
}
