export const ACHIEVEMENT_CATEGORIES = [
  "onboarding", "skills", "attributes", "role", "songwriting", "recording", "gigs", "touring",
  "mastery", "teaching", "social", "band", "professional", "longevity", "collection", "challenge",
] as const;

export const ACHIEVEMENT_TIERS = ["bronze", "silver", "gold", "platinum", "legendary"] as const;
export const ACHIEVEMENT_TYPES = ["achievement", "milestone", "career_milestone", "challenge", "hidden"] as const;
export const CRITERION_TYPES = [
  "skill_level", "skill_count_at_level", "attribute_threshold", "role_readiness", "completed_songs",
  "songwriting_quality", "recordings_completed", "recording_quality", "gigs_completed", "audience_response",
  "fan_growth", "mastery_rank", "teaching_sessions", "student_outcomes", "band_goal_completion",
  "professional_credits", "cumulative_count", "venue_tier", "genre_diversity", "longevity_months",
] as const;
export const COMPARISONS = ["gte", "lte", "eq", "gt", "lt", "between", "in"] as const;
export const CRITERION_SCOPES = ["profile", "role", "band", "song", "recording", "gig", "student", "professional"] as const;

export type AchievementCategory = typeof ACHIEVEMENT_CATEGORIES[number];
export type AchievementTier = typeof ACHIEVEMENT_TIERS[number];
export type AchievementType = typeof ACHIEVEMENT_TYPES[number];

export interface AchievementDefinition {
  slug: string;
  name: string;
  description: string;
  category: AchievementCategory;
  tier: AchievementTier;
  achievement_type: AchievementType;
  is_hidden?: boolean;
  is_repeatable?: boolean;
  repeat_limit?: number | null;
  points: number;
  icon_key: string;
  chain_key?: string;
}

export interface AchievementCriterionDefinition {
  achievement_slug: string;
  criterion_type: typeof CRITERION_TYPES[number];
  target_key: string;
  comparison: typeof COMPARISONS[number];
  target_value: number | string | boolean;
  scope: typeof CRITERION_SCOPES[number];
  sequence_group?: string | null;
  sequence_order?: number | null;
  metadata?: Record<string, unknown>;
}

export const CANONICAL_ACHIEVEMENTS: AchievementDefinition[] = [
  { slug: "first-skill-unlocked", name: "First Chord", description: "Unlock your first skill.", category: "onboarding", tier: "bronze", achievement_type: "milestone", points: 5, icon_key: "sparkles" },
  { slug: "first-attribute-improved", name: "Sharper Edge", description: "Improve any useful attribute for the first time.", category: "attributes", tier: "bronze", achievement_type: "milestone", points: 5, icon_key: "activity" },
  { slug: "working-musician-i", name: "Working Musician I", description: "Complete your first gig.", category: "gigs", tier: "bronze", achievement_type: "career_milestone", points: 10, icon_key: "mic", chain_key: "working-musician" },
  { slug: "working-musician-ii", name: "Working Musician II", description: "Complete ten gigs and earn strong audience response in five of them.", category: "gigs", tier: "silver", achievement_type: "career_milestone", points: 25, icon_key: "stage", chain_key: "working-musician" },
  { slug: "first-song-completed", name: "Finished Draft", description: "Complete your first song project.", category: "songwriting", tier: "bronze", achievement_type: "milestone", points: 10, icon_key: "music" },
  { slug: "studio-first-master", name: "First Master", description: "Complete your first recording master.", category: "recording", tier: "bronze", achievement_type: "career_milestone", points: 10, icon_key: "disc" },
  { slug: "strong-master", name: "Studio Professional", description: "Create a completed master with strong final quality.", category: "recording", tier: "gold", achievement_type: "achievement", points: 40, icon_key: "sliders" },
  { slug: "rising-guitarist", name: "Rising Guitarist", description: "Reach advanced guitar readiness with one advanced guitar skill and two competent supporting skills.", category: "role", tier: "silver", achievement_type: "milestone", points: 30, icon_key: "guitar" },
  { slug: "first-mastery-rank", name: "First Mastery Rank", description: "Earn your first true mastery rank.", category: "mastery", tier: "gold", achievement_type: "career_milestone", points: 50, icon_key: "award" },
  { slug: "trusted-mentor", name: "Trusted Mentor", description: "Help three distinct students reach a milestone.", category: "teaching", tier: "silver", achievement_type: "achievement", points: 30, icon_key: "graduation-cap" },
  { slug: "band-architect", name: "Band Architect", description: "Complete a coordinated band training plan with at least three contributors.", category: "band", tier: "gold", achievement_type: "achievement", points: 45, icon_key: "users" },
  { slug: "career-season", name: "Career Season", description: "Be active in six distinct career months without a daily streak requirement.", category: "longevity", tier: "silver", achievement_type: "milestone", points: 20, icon_key: "calendar" },
  { slug: "against-the-room", name: "Against the Room", description: "Deliver a strong gig despite a difficult venue fit.", category: "challenge", tier: "platinum", achievement_type: "challenge", is_hidden: true, points: 75, icon_key: "flame" },
  { slug: "repeatable-gig-consistency", name: "Consistent Night", description: "Repeatably recognise a strong completed gig, up to five times.", category: "gigs", tier: "bronze", achievement_type: "achievement", is_repeatable: true, repeat_limit: 5, points: 2, icon_key: "repeat" },
];

export const CANONICAL_CRITERIA: AchievementCriterionDefinition[] = [
  { achievement_slug: "first-skill-unlocked", criterion_type: "skill_level", target_key: "any_active_skill", comparison: "gte", target_value: 1, scope: "profile" },
  { achievement_slug: "first-attribute-improved", criterion_type: "attribute_threshold", target_key: "any_role_relevant_attribute", comparison: "gte", target_value: 2, scope: "profile" },
  { achievement_slug: "working-musician-i", criterion_type: "gigs_completed", target_key: "completed_gigs", comparison: "gte", target_value: 1, scope: "profile" },
  { achievement_slug: "working-musician-ii", criterion_type: "gigs_completed", target_key: "completed_gigs", comparison: "gte", target_value: 10, scope: "profile" },
  { achievement_slug: "working-musician-ii", criterion_type: "audience_response", target_key: "strong_or_better_gigs", comparison: "gte", target_value: 5, scope: "profile" },
  { achievement_slug: "first-song-completed", criterion_type: "completed_songs", target_key: "completed_song_projects", comparison: "gte", target_value: 1, scope: "profile" },
  { achievement_slug: "studio-first-master", criterion_type: "recordings_completed", target_key: "completed_masters", comparison: "gte", target_value: 1, scope: "profile" },
  { achievement_slug: "strong-master", criterion_type: "recording_quality", target_key: "final_master_quality", comparison: "gte", target_value: 780, scope: "recording" },
  { achievement_slug: "rising-guitarist", criterion_type: "role_readiness", target_key: "guitarist_readiness", comparison: "gte", target_value: 70, scope: "role", metadata: { role: "guitarist" } },
  { achievement_slug: "rising-guitarist", criterion_type: "skill_level", target_key: "guitar", comparison: "gte", target_value: 50, scope: "role" },
  { achievement_slug: "rising-guitarist", criterion_type: "skill_count_at_level", target_key: "guitarist_supporting_skills", comparison: "gte", target_value: 2, scope: "role", metadata: { minimumLevel: 25 } },
  { achievement_slug: "first-mastery-rank", criterion_type: "mastery_rank", target_key: "any_mastery_rank", comparison: "gte", target_value: 1, scope: "profile" },
  { achievement_slug: "trusted-mentor", criterion_type: "student_outcomes", target_key: "distinct_students_helped", comparison: "gte", target_value: 3, scope: "student", metadata: { distinctEntity: "student_profile_id" } },
  { achievement_slug: "band-architect", criterion_type: "band_goal_completion", target_key: "coordinated_training_plan", comparison: "gte", target_value: 1, scope: "band", metadata: { minDistinctContributors: 3 } },
  { achievement_slug: "career-season", criterion_type: "longevity_months", target_key: "distinct_active_months", comparison: "gte", target_value: 6, scope: "profile" },
  { achievement_slug: "against-the-room", criterion_type: "audience_response", target_key: "strong_gig_difficult_venue_fit", comparison: "gte", target_value: 1, scope: "gig", metadata: { hiddenHint: "Win over the wrong room." } },
  { achievement_slug: "repeatable-gig-consistency", criterion_type: "audience_response", target_key: "strong_completed_gig", comparison: "gte", target_value: 1, scope: "gig" },
];
