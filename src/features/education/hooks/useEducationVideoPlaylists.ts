import { useMemo } from "react";

import type { VideoPlaylist } from "../types";

export const useEducationVideoPlaylists = (): VideoPlaylist[] => {
  return useMemo(
    () => [
      {
        title: "Technique & Theory Channels",
        description:
          "Weekly uploads from trusted educators to keep your chops sharp and your theory knowledge fresh.",
        resources: [
          {
            name: "Rick Beato",
            format: "Deep-Dive Lessons",
            focus: "Ear Training & Analysis",
            link: "https://www.youtube.com/user/pegzch",
            summary:
              "Break down legendary songs, chord progressions, and arrangement secrets in long-form videos."
          },
          {
            name: "Marty Music",
            format: "Guitar Tutorials",
            focus: "Technique",
            link: "https://www.youtube.com/c/martyschwartz",
            summary: "Accessible guitar lessons covering riffs, tone tips, and style-specific workouts."
          },
          {
            name: "Nahre Sol",
            format: "Creative Exercises",
            focus: "Composition",
            link: "https://www.youtube.com/c/nahresol",
            summary: "Hybrid classical & electronic explorations for players who love experimentation."
          }
        ]
      },
      {
        title: "Structured Playlists",
        description:
          "Follow curated playlists that simulate guided courses complete with homework prompts.",
        resources: [
          {
            name: "30-Day Songwriting Bootcamp",
            format: "Playlist",
            focus: "Daily Prompts",
            link: "https://www.youtube.com/playlist?list=PL1A2F2A3",
            summary:
              "Short daily assignments that move from lyric sketches to full demos in a month."
          },
          {
            name: "Mixing Essentials in Logic Pro",
            format: "Playlist",
            focus: "Home Studio",
            link: "https://www.youtube.com/playlist?list=PL2F3G4H5",
            summary:
              "Step-by-step walkthroughs on EQ, compression, and mix bus processing for indie releases."
          },
          {
            name: "Stage Presence Fundamentals",
            format: "Mini-Series",
            focus: "Performance",
            link: "https://www.youtube.com/playlist?list=PL7K8L9M0",
            summary:
              "Learn crowd engagement, mic control, and dynamic movement in live settings."
          }
        ]
      },
      {
        title: "Practice Accountability",
        description:
          "Use these formats to keep consistent practice logs and track incremental progress.",
        resources: [
          {
            name: "Practice With Me Streams",
            format: "Co-Practice",
            focus: "Routine Building",
            link: "https://www.youtube.com/results?search_query=music+practice+with+me",
            summary:
              "Join real-time practice rooms that mimic study halls for musicians working on technique."
          },
          {
            name: "Looped Backing Tracks",
            format: "Play-Along",
            focus: "Improvisation",
            link: "https://www.youtube.com/results?search_query=backing+tracks+for+guitar",
            summary:
              "Select tempo-specific jam tracks to develop improvisation vocabulary and stage endurance."
          },
          {
            name: "Ear Training Drills",
            format: "Interactive",
            focus: "Listening Skills",
            link: "https://www.youtube.com/results?search_query=ear+training+intervals",
            summary:
              "Build interval recognition speed with call-and-response exercises and on-screen quizzes."
          }
        ]
      }
    ],
    []
  );
};
