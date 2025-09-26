import type { Json } from "@/integrations/supabase/types";

// Working database types to override the problematic generated types
export type RequirementValue = number | string | boolean | null;

export type RequirementRecord = Record<string, RequirementValue>;

export type AchievementValue = number | string;

export type AchievementRequirements = Record<string, AchievementValue>;

export type AchievementRewards = Record<string, AchievementValue>;

export type AchievementProgress = Record<string, AchievementValue>;

export type EquipmentStatBoosts = Record<string, number>;

export interface Profile {
  id: string;
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  level: number;
  experience: number;
  experience_at_last_weekly_bonus: number;
  cash: number;
  fame: number;
  fans: number;
  last_weekly_bonus_at: string | null;
  weekly_bonus_streak: number;
  weekly_bonus_metadata: Record<string, unknown>;
  current_city_id: string | null;
  age: number;
  created_at: string;
  updated_at: string;
}

export interface Band {
  id: string;
  name: string;
  genre: string | null;
  description: string | null;
  leader_id: string;
  popularity: number;
  weekly_fans: number;
  max_members: number;
  created_at: string;
  updated_at: string;
}

export interface BandMember {
  id: string;
  band_id: string;
  user_id: string;
  role: string;
  joined_at: string;
  salary: number;
}

export interface Venue {
  id: string;
  name: string;
  location: string | null;
  city: string | null;
  capacity: number | null;
  base_payment: number;
  venue_type: string | null;
  prestige_level: number;
  requirements: RequirementRecord;
  created_at: string;
}

export interface Gig {
  id: string;
  band_id: string;
  venue_id: string;
  scheduled_date: string;
  status: string;
  payment: number | null;
  attendance: number;
  fan_gain: number;
  created_at: string;
  updated_at: string;
}

export interface Song {
  id: string;
  user_id: string;
  title: string;
  genre: string;
  lyrics: string | null;
  audio_layers: Json[] | null;
  status: string;
  quality_score: number;
  streams: number;
  revenue: number;
  chart_position: number | null;
  release_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlayerSkills {
  id: string;
  user_id: string;
  vocals: number;
  guitar: number;
  bass: number;
  drums: number;
  songwriting: number;
  performance: number;
  creativity: number;
  technical: number;
  business: number;
  marketing: number;
  composition: number;
  created_at: string;
  updated_at: string;
}

export interface Achievement {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  category: string | null;
  rarity: string;
  requirements: AchievementRequirements;
  rewards: AchievementRewards;
  created_at: string;
}

export interface PlayerAchievement {
  id: string;
  user_id: string;
  achievement_id: string;
  progress: AchievementProgress;
  unlocked_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: 'user' | 'admin' | 'moderator';
  created_at: string;
}

export interface EquipmentItem {
  id: string;
  name: string;
  description: string | null;
  category: string;
  subcategory: string | null;
  price: number;
  rarity: string;
  stat_boosts: EquipmentStatBoosts;
  image_url: string | null;
  created_at: string;
}

export interface PlayerEquipment {
  id: string;
  user_id: string;
  equipment_id: string;
  equipped: boolean;
  is_equipped: boolean;
  condition: number;
  purchased_at: string;
  created_at: string;
}

export interface EducationYoutubeResource {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  category: string | null;
  difficulty_level: number;
  duration_minutes: number | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileDailyXpGrant {
  id: string;
  profile_id: string;
  grant_date: string;
  xp_awarded: number;
  metadata: Record<string, unknown>;
  claimed_at: string;
}