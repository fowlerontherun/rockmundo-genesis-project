import { useMemo } from "react";

import type { MentorProgram } from "../types";

export const useEducationMentorPrograms = (): MentorProgram[] => {
  return useMemo(
    () => [
      {
        title: "Mentorship Tracks",
        description:
          "Choose a pathway that matches your current career phase and desired feedback style.",
        cohorts: [
          {
            name: "Songwriting Lab",
            focus: "Co-Writing Circle",
            cadence: "Bi-weekly",
            support: "Collaborative feedback on drafts, melody rewrites, and lyric polish."
          },
          {
            name: "Stagecraft Intensive",
            focus: "Performance Coaching",
            cadence: "Monthly",
            support: "Virtual showcase critiques with movement and mic technique guidance."
          },
          {
            name: "Indie Release Accelerator",
            focus: "Launch Strategy",
            cadence: "Weekly",
            support: "Release calendar planning, marketing funnels, and analytics reviews."
          }
        ],
        action: {
          label: "Apply for Mentorship",
          href: "https://forms.gle/mentor-application"
        }
      },
      {
        title: "Expert Network",
        description:
          "Tap into a curated roster of industry veterans for one-off consultations or recurring coaching.",
        cohorts: [
          {
            name: "Creative Director",
            focus: "Visual Branding",
            cadence: "On-Demand",
            support: "Refine album art, stage visuals, and social media style guides."
          },
          {
            name: "Music Attorney",
            focus: "Contract Review",
            cadence: "Retainer",
            support: "Protect intellectual property, negotiate deals, and review licensing opportunities."
          },
          {
            name: "Tour Manager",
            focus: "Live Logistics",
            cadence: "Consulting",
            support: "Route tours, manage advancing, and streamline crew coordination."
          }
        ],
        action: {
          label: "Browse Mentor Roster",
          href: "https://rockmundo.com/mentors"
        }
      },
      {
        title: "Accountability Systems",
        description:
          "Stay consistent with structured check-ins, progress dashboards, and peer support.",
        cohorts: [
          {
            name: "Weekly Standups",
            focus: "Goal Tracking",
            cadence: "15 min",
            support: "Share wins, blockers, and next actions with your mentor pod."
          },
          {
            name: "Progress Journals",
            focus: "Reflection",
            cadence: "Daily",
            support: "Log practice stats, gig insights, and mindset notes inside Rockmundo."
          },
          {
            name: "Quarterly Audits",
            focus: "Career Review",
            cadence: "Seasonal",
            support: "Assess KPIs, adjust roadmaps, and celebrate milestones with your coach."
          }
        ],
        action: {
          label: "Download Templates",
          href: "https://notion.so"
        }
      }
    ],
    []
  );
};
