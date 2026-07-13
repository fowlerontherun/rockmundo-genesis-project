export const BLOCK_REASON_OPTIONS = [
  { value: "unwanted_contact", label: "Unwanted contact" },
  { value: "harassment", label: "Harassment" },
  { value: "spam", label: "Spam" },
  { value: "scam", label: "Scam attempt" },
  { value: "inappropriate_content", label: "Inappropriate content" },
  { value: "threatening_behaviour", label: "Threatening behaviour" },
  { value: "impersonation", label: "Impersonation" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
] as const;

export const REPORT_CATEGORY_OPTIONS = [
  { value: "harassment", label: "Harassment or bullying", priority: "normal" },
  { value: "threats", label: "Threats or intimidation", priority: "high", emergency: true },
  { value: "hate", label: "Hate or discriminatory abuse", priority: "high" },
  { value: "sexual_content", label: "Sexual or inappropriate content", priority: "high" },
  { value: "spam", label: "Spam", priority: "normal" },
  { value: "scam", label: "Scam or fraud attempt", priority: "high" },
  { value: "impersonation", label: "Impersonation", priority: "normal" },
  { value: "other", label: "Other", priority: "normal" },
] as const;

export type BlockReasonCategory = (typeof BLOCK_REASON_OPTIONS)[number]["value"];
export type ReportCategory = (typeof REPORT_CATEGORY_OPTIONS)[number]["value"];

export const BLOCK_CONFIRMATION_COPY =
  "Blocking removes any friendship, cancels pending requests, hides both of you from social discovery, prevents direct social interaction, and does not notify the other player.";

export const EMERGENCY_SAFETY_COPY =
  "If this involves immediate danger or a real-world threat, contact emergency services or local authorities now. RockMundo moderation cannot provide emergency intervention.";
