import type { LucideIcon } from "lucide-react";

export interface EducationTab {
  value: "books" | "university" | "videos" | "mentors" | "band";
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
  name: string;
  format: string;
  focus: string;
  link: string;
  summary: string;
}

export interface VideoPlaylist {
  title: string;
  description: string;
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

export interface BandLearningSession {
  name: string;
  focus: string;
  deliverable: string;
}

export interface BandLearningTrackAction {
  label: string;
  href: string;
}

export interface BandLearningTrack {
  title: string;
  description: string;
  sessions: BandLearningSession[];
  action?: BandLearningTrackAction;
}
