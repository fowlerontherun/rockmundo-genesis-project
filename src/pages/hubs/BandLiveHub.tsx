import { CategoryHub } from "@/components/CategoryHub";
import { Users, Sparkles, Globe, Trophy, UserPlus, Bus, Target, Calendar, Mic, Music, ListMusic, Wrench, Award, Star } from "lucide-react";

export default function BandLiveHub() {
  return (
    <CategoryHub
      titleKey="nav.bandLive"
      description="Manage your band, perform live, and compete in events."
      groups={[
        {
          label: "Band Management",
          tiles: [
            { icon: Users, labelKey: "nav.bandManager", path: "/band", imagePrompt: "A rock band group photo in a rehearsal room with instruments and band logo on the wall" },
            { icon: Sparkles, labelKey: "nav.bandChemistry", path: "/chemistry", imagePrompt: "Band members high-fiving with sparkles and energy flowing between them, chemistry vibes" },
            { icon: Globe, labelKey: "nav.bandFinder", path: "/bands/finder", imagePrompt: "A globe with musician silhouettes connected by lines, searching for band members worldwide" },
            { icon: Trophy, labelKey: "nav.bandRankings", path: "/band-rankings", imagePrompt: "A leaderboard with band names and rankings, trophies and spotlights on top bands" },
            { icon: UserPlus, labelKey: "nav.bandCrew", path: "/band-crew", imagePrompt: "Stage crew members setting up equipment, roadies carrying gear backstage" },
            { icon: Bus, labelKey: "nav.bandVehicles", path: "/band-vehicles", imagePrompt: "A colorful tour bus with rock band artwork driving on a highway at sunset" },
            { icon: Target, labelKey: "nav.bandRiders", path: "/band-riders", imagePrompt: "A backstage rider checklist with food, drinks, and equipment demands on a clipboard" },
          ],
        },
        {
          label: "Live Performance",
          tiles: [
            { icon: Calendar, labelKey: "nav.gigs", path: "/gigs", imagePrompt: "A packed concert venue with a band performing on stage, colorful stage lights and cheering crowd" },
            { icon: Mic, labelKey: "nav.openMic", path: "/open-mic", imagePrompt: "An intimate open mic night at a cozy bar with a single microphone on stage, warm lighting" },
            { icon: Music, labelKey: "nav.jamSessions", path: "/jam-sessions", imagePrompt: "Musicians jamming together in a garage with guitars, drums, and amplifiers" },
            { icon: Music, labelKey: "nav.busking", path: "/busking", imagePrompt: "A street musician busking on a busy city corner with a guitar case open for tips" },
            { icon: Music, labelKey: "nav.rehearsals", path: "/rehearsals", imagePrompt: "A band rehearsing in a practice room with sound-dampening walls and instruments" },
            { icon: ListMusic, labelKey: "nav.setlists", path: "/setlists", imagePrompt: "A setlist taped to a stage floor with song titles and markers, ready for a performance" },
            { icon: Wrench, labelKey: "nav.stageEquipment", path: "/stage-equipment", imagePrompt: "A collection of stage equipment: amplifiers, speakers, microphone stands, and cables" },
          ],
        },
        {
          label: "Events & Competitions",
          tiles: [
            { icon: Calendar, labelKey: "nav.festivals", path: "/festivals", imagePrompt: "A massive outdoor music festival with multiple stages, tents, and thousands of fans" },
            { icon: Award, labelKey: "nav.awards", path: "/awards", imagePrompt: "A glamorous awards ceremony with a golden gramophone trophy on a red carpet stage" },
            { icon: Star, labelKey: "nav.eurovision", path: "/events/eurovision", imagePrompt: "A dazzling Eurovision-style stage with LED screens, national flags, and performers" },
            { icon: Trophy, labelKey: "Major Events", path: "/major-events", imagePrompt: "A stadium hosting a major music event with pyrotechnics and a massive crowd" },
          ],
        },
      ]}
    />
  );
}
