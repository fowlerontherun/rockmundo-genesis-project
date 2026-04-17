// World Parliament & Political Party Types

export type MotionType = 'resolution' | 'policy' | 'budget' | 'mayor_pay' | 'treaty';
export type MotionStatus = 'open' | 'passed' | 'rejected' | 'expired';
export type Vote = 'yes' | 'no' | 'abstain';

export interface ParliamentMotion {
  id: string;
  proposer_mayor_id: string;
  proposer_profile_id: string;
  title: string;
  body: string;
  motion_type: MotionType;
  payload: Record<string, unknown>;
  status: MotionStatus;
  voting_opens_at: string;
  voting_closes_at: string;
  yes_votes: number;
  no_votes: number;
  abstain_votes: number;
  resolved_at: string | null;
  created_at: string;
}

export interface ParliamentVote {
  id: string;
  motion_id: string;
  mayor_id: string;
  voter_profile_id: string;
  vote: Vote;
  voted_at: string;
}

export interface MayorPaySettings {
  id: number;
  weekly_salary_per_mayor: number; // cents
  min_salary: number;
  max_salary: number;
  last_motion_id: string | null;
  updated_at: string;
}

export interface MayorSalaryPayment {
  id: string;
  mayor_id: string;
  profile_id: string;
  city_id: string;
  amount: number;
  paid_at: string;
  week_of: string;
}

export const MOTION_TYPE_LABELS: Record<MotionType, string> = {
  resolution: 'Resolution',
  policy: 'Policy',
  budget: 'Budget',
  mayor_pay: 'Mayor Pay',
  treaty: 'Treaty',
};

export const MOTION_STATUS_COLOURS: Record<MotionStatus, string> = {
  open: 'bg-primary/15 text-primary border-primary/30',
  passed: 'bg-success/15 text-success border-success/30',
  rejected: 'bg-destructive/15 text-destructive border-destructive/30',
  expired: 'bg-muted text-muted-foreground border-border',
};
