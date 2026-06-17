import { CategoryHub } from "@/components/CategoryHub";
import { Music, Disc, Music4, Radio, Video, TrendingUp, Store, Trophy, Gamepad2, ListMusic, BarChart3 } from "lucide-react";

export default function MusicHubPage() {
  return (
    <CategoryHub
      titleKey="nav.music"
      description="Write, record, release, and chart your music."
      groups={[
        {
          label: "Create",
          tiles: [
            { icon: Music, labelKey: "nav.songwriting", path: "/songwriting", imagePrompt: "A songwriter at a desk writing lyrics with a guitar nearby, warm studio lighting" },
            { icon: Gamepad2, labelKey: "nav.stagePractice", path: "/stage-practice", imagePrompt: "A rhythm game screen with colorful notes falling, a guitarist on stage" },
            { icon: Disc, labelKey: "nav.recording", path: "/recording-studio", imagePrompt: "A professional recording studio with mixing console, microphones, and booth" },
            { icon: ListMusic, labelKey: "Song Manager", path: "/song-manager", imagePrompt: "A library view of song files, drafts, and finished tracks organized neatly" },
          ],
        },
        {
          label: "Release & Distribute",
          tiles: [
            { icon: Music4, labelKey: "nav.releaseManager", path: "/release-manager", imagePrompt: "Vinyl records, CD cases, and digital music icons being prepared for release" },
            { icon: Video, labelKey: "nav.musicVideos", path: "/music-videos", imagePrompt: "A film set for a music video with cameras, lights, and a band on a stage" },
            { icon: Radio, labelKey: "nav.streaming", path: "/streaming-platforms", imagePrompt: "A smartphone showing music streaming app with headphones and waveforms" },
          ],
        },
        {
          label: "Charts & Market",
          tiles: [
            { icon: BarChart3, labelKey: "Global Charts", path: "/music/charts", imagePrompt: "A glowing global music chart leaderboard with album covers and ranks" },
            { icon: TrendingUp, labelKey: "nav.countryCharts", path: "/country-charts", imagePrompt: "A rising chart graph with music notes and country flags worldwide" },
            { icon: Trophy, labelKey: "Competitive Charts", path: "/competitive-charts", imagePrompt: "A trophy podium with competing artists and chart rankings" },
            { icon: Store, labelKey: "nav.songMarket", path: "/song-market", imagePrompt: "A marketplace stall selling music sheets, vinyl, and digital songs" },
            { icon: Trophy, labelKey: "nav.songRankings", path: "/song-rankings", imagePrompt: "A golden trophy on a podium with a leaderboard showing ranked songs" },
          ],
        },
      ]}
    />
  );
}
