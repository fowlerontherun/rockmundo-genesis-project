export interface RecordingStudioBusiness {
  id: string;
  name: string;
  city_id: string | null;
  district_id: string | null;
  company_id: string | null;
  is_company_owned: boolean;
  hourly_rate: number;
  quality_rating: number;
  equipment_rating: number;
  specialties: string[];
  daily_operating_cost: number;
  monthly_rent: number;
  console_type: string;
  max_tracks: number;
  has_live_room: boolean;
  has_isolation_booths: number;
  mastering_capable: boolean;
  reputation: number;
  total_sessions: number;
  total_revenue: number;
  albums_recorded: number;
  hit_songs_recorded: number;
  created_at: string;
  cities?: { name: string; country: string };
  city_districts?: { name: string };
  companies?: { name: string };
}

export interface RecordingStudioStaff {
  id: string;
  studio_id: string;
  name: string;
  role: 'chief_engineer' | 'assistant_engineer' | 'producer' | 'studio_manager' | 'maintenance_tech' | 'runner';
  skill_level: number;
  specialty: string | null;
  salary: number;
  albums_worked: number;
  hit_songs: number;
  hire_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RecordingStudioTransaction {
  id: string;
  studio_id: string;
  transaction_type: 'session_revenue' | 'mixing_revenue' | 'mastering_revenue' | 'equipment_rental' | 'staff_salary' | 'maintenance' | 'utilities' | 'upgrade_cost' | 'other_income' | 'other_expense';
  amount: number;
  description: string | null;
  reference_id: string | null;
  band_name: string | null;
  transaction_date: string;
  created_at: string;
}

export interface RecordingStudioUpgrade {
  id: string;
  studio_id: string;
  upgrade_type: 'console' | 'monitors' | 'microphones' | 'preamps' | 'outboard_gear' | 'live_room' | 'isolation_booth' | 'control_room' | 'mastering_suite';
  name: string;
  level: number;
  cost: number;
  effect_value: number;
  effect_description: string | null;
  installed_at: string;
  created_at: string;
}

export interface RecordingStudioEquipment {
  id: string;
  studio_id: string;
  equipment_name: string;
  equipment_type: 'microphone' | 'preamp' | 'compressor' | 'equalizer' | 'reverb' | 'console' | 'monitor' | 'instrument' | 'plugin_bundle' | 'other';
  brand: string | null;
  model: string | null;
  value: number;
  hourly_rental_rate: number;
  condition: number;
  is_vintage: boolean;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

export const STUDIO_STAFF_ROLES = [
  { value: 'chief_engineer', label: 'Chief Engineer', description: 'Lead audio engineer, runs sessions' },
  { value: 'assistant_engineer', label: 'Assistant Engineer', description: 'Supports sessions, manages setup' },
  { value: 'producer', label: 'In-House Producer', description: 'Guides artistic direction' },
  { value: 'studio_manager', label: 'Studio Manager', description: 'Handles bookings and operations' },
  { value: 'maintenance_tech', label: 'Maintenance Tech', description: 'Repairs and maintains equipment' },
  { value: 'runner', label: 'Runner', description: 'Assists with errands and basic tasks' },
] as const;

export const STUDIO_UPGRADE_TYPES = [
  { value: 'console', label: 'Mixing Console', icon: '🎛️', maxLevel: 5 },
  { value: 'monitors', label: 'Studio Monitors', icon: '🔊', maxLevel: 5 },
  { value: 'microphones', label: 'Microphone Collection', icon: '🎤', maxLevel: 5 },
  { value: 'preamps', label: 'Preamps & Channel Strips', icon: '🎚️', maxLevel: 5 },
  { value: 'outboard_gear', label: 'Outboard Gear', icon: '📻', maxLevel: 5 },
  { value: 'live_room', label: 'Live Room Acoustics', icon: '🏠', maxLevel: 5 },
  { value: 'isolation_booth', label: 'Isolation Booths', icon: '🚪', maxLevel: 5 },
  { value: 'control_room', label: 'Control Room', icon: '🎬', maxLevel: 5 },
  { value: 'mastering_suite', label: 'Mastering Suite', icon: '💿', maxLevel: 5 },
] as const;

export const STUDIO_EQUIPMENT_TYPES = [
  { value: 'microphone', label: 'Microphone' },
  { value: 'preamp', label: 'Preamp' },
  { value: 'compressor', label: 'Compressor' },
  { value: 'equalizer', label: 'Equalizer' },
  { value: 'reverb', label: 'Reverb Unit' },
  { value: 'console', label: 'Mixing Console' },
  { value: 'monitor', label: 'Studio Monitor' },
  { value: 'instrument', label: 'Instrument' },
  { value: 'plugin_bundle', label: 'Plugin Bundle' },
  { value: 'other', label: 'Other' },
] as const;

export const GENRE_SPECIALTIES = [
  { value: 'rock', label: 'Rock' },
  { value: 'pop', label: 'Pop' },
  { value: 'hip_hop', label: 'Hip Hop' },
  { value: 'electronic', label: 'Electronic' },
  { value: 'jazz', label: 'Jazz' },
  { value: 'classical', label: 'Classical' },
  { value: 'metal', label: 'Metal' },
  { value: 'country', label: 'Country' },
  { value: 'all_genres', label: 'All Genres' },
] as const;
