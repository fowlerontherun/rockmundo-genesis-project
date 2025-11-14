export type MentorshipGoalStatus = "not_started" | "in_progress" | "completed" | "blocked";

export interface GoalCheckIn {
  id: string;
  timestamp: string;
  progress: number;
  note?: string;
  sentiment?: "positive" | "neutral" | "negative";
}

export interface MentorshipGoal {
  id: string;
  matchId: string;
  title: string;
  description?: string | null;
  status: MentorshipGoalStatus;
  progress: number;
  targetDate?: string | null;
  focusAreas?: string[];
  metrics?: Record<string, number | string>;
  lastCheckIn?: string | null;
  checkIns?: GoalCheckIn[];
  supportNotes?: string | null;
}
