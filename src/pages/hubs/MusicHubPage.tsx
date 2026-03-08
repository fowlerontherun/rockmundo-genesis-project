import { CategoryHub } from "@/components/CategoryHub";
import { Music, GraduationCap, Disc, Music4, Radio, Video, TrendingUp, Store, Trophy, Gamepad2 } from "lucide-react";

export default function MusicHubPage() {
  return (
    <CategoryHub
      titleKey="nav.music"
      description="Write, record, release, and chart your music."
      tiles={[
        { icon: Music, labelKey: "nav.songwriting", path: "/songwriting", imagePrompt: "A songwriter at a desk writing lyrics with a guitar nearby, warm studio lighting, music notes floating" },
        { icon: GraduationCap, labelKey: "nav.education", path: "/education", imagePrompt: "A music school classroom with instruments, a chalkboard with music theory, students practicing" },
        { icon: Disc, labelKey: "nav.recording", path: "/recording-studio", imagePrompt: "A professional recording studio with mixing console, microphones, and soundproof booth" },
        { icon: Music4, labelKey: "nav.releaseManager", path: "/release-manager", imagePrompt: "Vinyl records, CD cases, and digital music icons being prepared for release, production line style" },
        { icon: Radio, labelKey: "nav.streaming", path: "/streaming-platforms", imagePrompt: "A smartphone showing music streaming app with headphones and audio waveforms" },
        { icon: Video, labelKey: "nav.musicVideos", path: "/music-videos", imagePrompt: "A film set for a music video with cameras, lights, and a band performing on a colorful stage" },
        { icon: TrendingUp, labelKey: "nav.countryCharts", path: "/country-charts", imagePrompt: "A rising chart graph with music notes and country flags, showing top hits worldwide" },
        { icon: Store, labelKey: "nav.songMarket", path: "/song-market", imagePrompt: "A marketplace stall selling music sheets, vinyl records, and digital songs with price tags" },
        { icon: Trophy, labelKey: "nav.songRankings", path: "/song-rankings", imagePrompt: "A golden trophy on a podium with music notes and a leaderboard showing ranked songs" },
        { icon: Gamepad2, labelKey: "nav.stagePractice", path: "/stage-practice", imagePrompt: "A rhythm game screen with colorful notes falling, a guitarist playing on stage with crowd cheering" },
      ]}
    />
  );
}
