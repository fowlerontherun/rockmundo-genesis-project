import { CategoryHub } from "@/components/CategoryHub";
import { Calendar, Mic, Music, ListMusic, Wrench, Swords } from "lucide-react";

export default function LiveHub() {
  return (
    <CategoryHub
      titleKey="nav.live"
      description="Perform live — gigs, open mics, jams, busking, and rehearsals."
      tiles={[
        { icon: Calendar, labelKey: "nav.gigs", path: "/gigs", imagePrompt: "A packed concert venue with a band performing on stage, colorful stage lights and cheering crowd" },
        { icon: Mic, labelKey: "nav.openMic", path: "/open-mic", imagePrompt: "An intimate open mic night at a cozy bar with a single microphone on stage, warm lighting" },
        { icon: Swords, labelKey: "Battle of the Bands", path: "/battle-of-the-bands", imagePrompt: "Two rival bands facing off on a club stage under dramatic red and blue lights, cheering crowd" },
        { icon: Music, labelKey: "nav.jamSessions", path: "/jam-sessions", imagePrompt: "Musicians jamming together in a garage with guitars, drums, and amplifiers" },
        { icon: Music, labelKey: "nav.busking", path: "/busking", imagePrompt: "A street musician busking on a busy city corner with a guitar case open for tips" },
        { icon: Music, labelKey: "nav.rehearsals", path: "/rehearsals", imagePrompt: "A band rehearsing in a practice room with sound-dampening walls and instruments" },
        { icon: ListMusic, labelKey: "nav.setlists", path: "/setlists", imagePrompt: "A setlist taped to a stage floor with song titles and markers, ready for a performance" },
        { icon: Wrench, labelKey: "Band Equipment", path: "/stage-equipment", imagePrompt: "A collection of shared band production equipment: amplifiers, speakers, microphone stands, and cables" },
      ]}
    />
  );
}
