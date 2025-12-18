import type { LucideIcon } from "lucide-react";

export interface EducationTab {
  value: "books" | "university" | "videos" | "mentors";
  label: string;
  icon: LucideIcon;
  description: string;
}

export interface BookCollectionItem {
  name: string;
  author: string;
  focus: string;
  takeaway: string;
}

export interface BookCollection {
  title: string;
  description: string;
  items: BookCollectionItem[];
}

export interface UniversityHighlight {
  name: string;
  school: string;
  focus: string;
  details: string;
}

export interface UniversityTrackAction {
  label: string;
  href: string;
}

export interface UniversityTrack {
  title: string;
  description: string;
  highlights: UniversityHighlight[];
  action?: UniversityTrackAction;
}

export interface VideoResource {
  id: string;
  name: string;
  format: string;
  focus: string;
  url: string;
  summary: string;
  sortOrder: number;
}

export interface VideoPlaylist {
  key: string;
  title: string;
  description: string;
  sortOrder: number;
  resources: VideoResource[];
}

export interface MentorCohort {
  name: string;
  focus: string;
  cadence: string;
  support: string;
}

export interface MentorProgramAction {
  label: string;
  href: string;
}

export interface MentorProgram {
  title: string;
  description: string;
  cohorts: MentorCohort[];
  action?: MentorProgramAction;
}
