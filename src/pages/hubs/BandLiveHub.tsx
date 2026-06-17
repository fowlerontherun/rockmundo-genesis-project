import { CategoryHub } from "@/components/CategoryHub";
import {
  Users, Sparkles, Globe, Trophy, UserPlus, Bus, Target, Calendar,
  Mic, Music, ListMusic, Wrench, Award, Star, Map,
} from "lucide-react";

export default function BandLiveHub() {
  return (
    <CategoryHub
      titleKey="nav.bandLive"
      description="Manage your band, perform live, and compete in events."
      groups={[
        {
          label: "Your Band",
          tiles: [
            { icon: Users, labelKey: "nav.bandManager", path: "/band", imagePrompt: "A rock band group photo in a rehearsal room with instruments and a logo on the wall" },
            { icon: ListMusic, labelKey: "Repertoire", path: "/band/repertoire", imagePrompt: "A music binder with setlist pages, tabs, and song notes" },
            { icon: Sparkles, labelKey: "nav.bandChemistry", path: "/chemistry", imagePrompt: "Band members high-fiving with sparkles and energy flowing between them" },
            { icon: ListMusic, labelKey: "nav.setlists", path: "/setlists", imagePrompt: "A setlist taped to a stage floor with song titles and markers" },
            { icon: Music, labelKey: "nav.rehearsals", path: "/rehearsals", imagePrompt: "A band rehearsing in a practice room with sound-dampening walls" },
            { icon: UserPlus, labelKey: "nav.bandCrew", path: "/band-crew", imagePrompt: "Stage crew members setting up equipment backstage" },
            { icon: Target, labelKey: "nav.bandRiders", path: "/band-riders", imagePrompt: "A backstage rider checklist with food, drinks, and equipment on a clipboard" },
            { icon: Bus, labelKey: "nav.bandVehicles", path: "/band-vehicles", imagePrompt: "A colorful tour bus with rock band artwork driving at sunset" },
          ],
        },
        {
          label: "Discover Bands",
          tiles: [
            { icon: Users, labelKey: "Browse Bands", path: "/bands/browse", imagePrompt: "A directory of bands with profile cards and genres" },
            { icon: Globe, labelKey: "nav.bandFinder", path: "/bands/finder", imagePrompt: "A globe with musician silhouettes connected by lines, finding members" },
            { icon: Trophy, labelKey: "nav.bandRankings", path: "/band-rankings", imagePrompt: "A leaderboard with band names, trophies and spotlights" },
            { icon: Map, labelKey: "nav.bandFameMap", path: "/band-fame-map", imagePrompt: "A glowing world map with neon heat spots showing band popularity" },
          ],
        },
        {
          label: "Perform",
          tiles: [
            { icon: Calendar, labelKey: "Book Gigs", path: "/gig-booking", imagePrompt: "A booking calendar with venue offers, dates, and contract slips" },
            { icon: Mic, labelKey: "My Gigs", path: "/gigs", imagePrompt: "A packed concert venue with a band performing, colorful stage lights" },
            { icon: Mic, labelKey: "nav.openMic", path: "/open-mic", imagePrompt: "An intimate open mic night at a cozy bar with a single microphone, warm lighting" },
            { icon: Music, labelKey: "nav.jamSessions", path: "/jam-sessions", imagePrompt: "Musicians jamming together in a garage with guitars and amplifiers" },
            { icon: Music, labelKey: "nav.busking", path: "/busking", imagePrompt: "A street musician busking on a busy city corner with a guitar case open" },
            { icon: Wrench, labelKey: "nav.stageEquipment", path: "/stage-equipment", imagePrompt: "Amplifiers, speakers, microphone stands, and cables on a stage" },
          ],
        },
        {
          label: "Tours & Events",
          tiles: [
            { icon: Bus, labelKey: "nav.tours", path: "/tour-manager", imagePrompt: "A tour bus route map with concert dates pinned across cities" },
            { icon: Calendar, labelKey: "nav.festivals", path: "/festivals", imagePrompt: "A massive outdoor music festival with multiple stages and thousands of fans" },
            { icon: Trophy, labelKey: "Major Events", path: "/major-events", imagePrompt: "A stadium hosting a major music event with pyrotechnics and a massive crowd" },
            { icon: Star, labelKey: "nav.eurovision", path: "/events/eurovision", imagePrompt: "A dazzling Eurovision-style stage with LED screens and national flags" },
            { icon: Award, labelKey: "nav.awards", path: "/awards", imagePrompt: "A glamorous awards ceremony with a golden gramophone trophy on a red carpet" },
          ],
        },
      ]}
    />
  );
}
