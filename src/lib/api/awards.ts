export type AwardStatus =
  | "nominations_open"
  | "selection"
  | "live"
  | "voting_open"
  | "results";

export interface NominationPayload {
  award_show_id: string;
  category_name: string;
  nominee_type: string;
  nominee_id: string;
  nominee_name: string;
  band_id?: string;
  submission_data?: Record<string, any>;
}

export interface CountrySubmission {
  country: string;
  [key: string]: any;
}

const REQUIRED_FIELDS: (keyof NominationPayload)[] = [
  "award_show_id",
  "category_name",
  "nominee_name",
];

export const STATUS_TRANSITIONS: Record<AwardStatus, AwardStatus[]> = {
  nominations_open: ["selection"],
  selection: ["live"],
  live: ["voting_open"],
  voting_open: ["results"],
  results: [],
};

export const validateNominationSubmission = (
  payload: NominationPayload,
): NominationPayload => {
  const missing = REQUIRED_FIELDS.filter((field) => !payload[field]);

  if (missing.length) {
    throw new Error(`Missing required fields: ${missing.join(", ")}`);
  }

  return payload;
};

export const selectRandomNomineesByCountry = <T extends CountrySubmission>(
  submissions: T[],
  random: () => number = Math.random,
): T[] => {
  const grouped = submissions.reduce<Record<string, T[]>>((acc, submission) => {
    if (!submission.country) return acc;
    acc[submission.country] = acc[submission.country] || [];
    acc[submission.country].push(submission);
    return acc;
  }, {});

  return Object.values(grouped).map((entries) => {
    const index = Math.floor(random() * entries.length);
    return entries[index];
  });
};

export const enforceVoteCap = (
  existingVotes: number,
  voteCap: number,
): number => {
  if (existingVotes >= voteCap) {
    throw new Error("Vote limit reached for this nomination");
  }
  return voteCap - existingVotes;
};

export const isValidStatusTransition = (
  current: AwardStatus,
  next: AwardStatus,
): boolean => {
  return STATUS_TRANSITIONS[current]?.includes(next) ?? false;
};

export const getNextStatus = (current: AwardStatus, next: AwardStatus): AwardStatus => {
  if (!isValidStatusTransition(current, next)) {
    throw new Error(`Invalid status transition from ${current} to ${next}`);
  }
  return next;
};
