import { useMemo } from "react";

import type { UniversityTrack } from "../types";

export const useEducationUniversityTracks = (): UniversityTrack[] => {
  return useMemo(
    () => [
      {
        title: "Degree Pathways",
        description:
          "Explore accredited programs that combine performance, technology, and music business training.",
        highlights: [
          {
            name: "BFA in Contemporary Performance",
            school: "Berklee College of Music",
            focus: "Performance Major",
            details: "Focus on live performance labs, ensemble work, and songwriting collaborations."
          },
          {
            name: "BA in Music Business",
            school: "Middle Tennessee State University",
            focus: "Industry Leadership",
            details:
              "Blend legal, marketing, and management courses with internship placements in Nashville."
          },
          {
            name: "BS in Music Production",
            school: "Full Sail University",
            focus: "Studio Technology",
            details: "Hands-on studio time with DAW mastery, audio engineering, and mixing for release."
          }
        ],
        action: {
          label: "Download Program Guide",
          href: "https://www.berklee.edu/majors"
        }
      },
      {
        title: "Micro-Credentials & Certificates",
        description:
          "Stack short-form credentials to sharpen niche skills while staying active in the scene.",
        highlights: [
          {
            name: "Modern Music Production",
            school: "Coursera x Berklee",
            focus: "12-Week Certificate",
            details: "Project-based program covering beat design, mixing, and mastering workflows."
          },
          {
            name: "Music Marketing Accelerator",
            school: "Soundfly",
            focus: "Mentor-Guided",
            details: "Learn digital strategy, branding, and fan funnels with 1:1 mentor feedback."
          },
          {
            name: "Live Event Production",
            school: "Point Blank Music School",
            focus: "Hybrid",
            details: "Develop stage management and tour logistics skills with live practicum opportunities."
          }
        ],
        action: {
          label: "Browse Certificates",
          href: "https://online.berklee.edu/programs"
        }
      },
      {
        title: "Semester Planner",
        description:
          "Balance academic study with band commitments using this repeatable 15-week structure.",
        highlights: [
          {
            name: "Weeks 1-5",
            school: "Skill Ramp-Up",
            focus: "Technique & Theory",
            details:
              "Double down on practice labs and music theory intensives while scheduling songwriting sprints."
          },
          {
            name: "Weeks 6-10",
            school: "Creative Production",
            focus: "Studio & Writing",
            details:
              "Shift toward arranging, collaboration projects, and recording sessions for portfolio tracks."
          },
          {
            name: "Weeks 11-15",
            school: "Career Launch",
            focus: "Showcase & Networking",
            details:
              "Secure live showcases, meet with advisors, and prepare EPK updates ahead of finals."
          }
        ],
        action: {
          label: "Download Planner",
          href: "https://calendar.google.com"
        }
      }
    ],
    []
  );
};
