import { useMemo } from "react";

import type { BandLearningTrack } from "../types";

export const useEducationBandLearningTracks = (): BandLearningTrack[] => {
  return useMemo(
    () => [
      {
        title: "Band Intensives",
        description:
          "Plan immersive weekends that combine rehearsal, songwriting, and branding workshops.",
        sessions: [
          {
            name: "Day 1: Groove Lab",
            focus: "Tighten Rhythmic Chemistry",
            deliverable: "Record a live rehearsal take with click + crowd cues."
          },
          {
            name: "Day 2: Story & Stage",
            focus: "Brand Alignment",
            deliverable: "Craft a unified band bio, stage plot, and social hook."
          },
          {
            name: "Day 3: Release Sprint",
            focus: "Content Production",
            deliverable: "Capture video + photo assets for upcoming release cycle."
          }
        ],
        action: {
          label: "Download Weekend Agenda",
          href: "https://docs.google.com"
        }
      },
      {
        title: "Ongoing Band Curriculum",
        description:
          "Rotate focus areas each month to keep the whole group evolving in sync.",
        sessions: [
          {
            name: "Month 1: Arrangement Lab",
            focus: "Reimagine Setlist",
            deliverable: "New live transitions, medleys, and crowd participation cues."
          },
          {
            name: "Month 2: Business HQ",
            focus: "Operational Systems",
            deliverable: "Shared budget tracker, merch inventory log, and task board."
          },
          {
            name: "Month 3: Audience Engine",
            focus: "Growth Experiments",
            deliverable: "Launch fan challenges, collect emails, and test paid promotion."
          }
        ],
        action: {
          label: "View Curriculum",
          href: "https://rockmundo.com/band-learning"
        }
      },
      {
        title: "Performance Feedback Loops",
        description: "Capture data from every show to iterate faster as a unit.",
        sessions: [
          {
            name: "Show Debrief",
            focus: "Immediate Reflection",
            deliverable: "Rate crowd energy, set pacing, and technical stability within 24 hours."
          },
          {
            name: "Fan Pulse",
            focus: "Community Insights",
            deliverable: "Survey attendees, review social mentions, and note merch conversion."
          },
          {
            name: "Iterate & Implement",
            focus: "Action Plan",
            deliverable: "Assign next-step experiments for setlist, visuals, and engagement."
          }
        ],
        action: {
          label: "Create Feedback Form",
          href: "https://forms.gle/band-feedback"
        }
      }
    ],
    []
  );
};
