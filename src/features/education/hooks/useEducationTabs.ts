import { useMemo } from "react";
import { BookOpen, GraduationCap, PlaySquare, Users, LayoutDashboard } from "lucide-react";

import type { EducationTab } from "../types";

export const useEducationTabs = (): EducationTab[] => {
  return useMemo(
    () => [
      {
        value: "summary",
        label: "Summary",
        icon: LayoutDashboard,
        description: "Overview of your current learning journey, progress, and recent achievements."
      },
      {
        value: "books",
        label: "Books",
        icon: BookOpen,
        description: "Build a foundational library for musicianship, songwriting, and career growth."
      },
      {
        value: "university",
        label: "University",
        icon: GraduationCap,
        description: "Map out formal education paths and micro-credentials that align with your goals."
      },
      {
        value: "videos",
        label: "YouTube Videos",
        icon: PlaySquare,
        description: "Curated playlists and channels that deliver high-impact lessons on demand."
      },
      {
        value: "mentors",
        label: "Mentors",
        icon: Users,
        description: "Connect with experts for personalized feedback, coaching, and accountability."
      }
    ],
    []
  );
};
