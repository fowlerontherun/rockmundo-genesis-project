export interface RehearsalStudioBusiness {
  id: string;
  name: string;
  location: string | null;
  city_id: string | null;
  district_id: string | null;
  company_id: string | null;
  is_company_owned: boolean;
  hourly_rate: number;
  quality_rating: number;
  capacity: number;
  equipment_quality: number;
  description: string | null;
  daily_operating_cost: number;
  monthly_rent: number;
  soundproofing_level: number;
  recording_capable: boolean;
  max_simultaneous_bands: number;
  amenities: string[];
  reputation: number;
  total_bookings: number;
  total_revenue: number;
  created_at: string;
  updated_at: string;
  cities?: { name: string; country: string };
  city_districts?: { name: string };
  companies?: { name: string };
}

export interface RehearsalRoomStaff {
  id: string;
  room_id: string;
  name: string;
  role: 'manager' | 'technician' | 'receptionist' | 'security' | 'maintenance';
  skill_level: number;
  salary: number;
  hire_date: string;
  performance_rating: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RehearsalRoomTransaction {
  id: string;
  room_id: string;
  transaction_type: 'booking_revenue' | 'equipment_rental' | 'staff_salary' | 'maintenance' | 'utilities' | 'upgrade_cost' | 'other_income' | 'other_expense';
  amount: number;
  description: string | null;
  reference_id: string | null;
  transaction_date: string;
  created_at: string;
}

export interface RehearsalRoomUpgrade {
  id: string;
  room_id: string;
  upgrade_type: 'soundproofing' | 'equipment' | 'recording_gear' | 'climate_control' | 'lounge_area' | 'storage' | 'lighting';
  name: string;
  level: number;
  cost: number;
  effect_value: number;
  effect_description: string | null;
  installed_at: string;
  created_at: string;
}

export interface RehearsalRoomEquipment {
  id: string;
  room_id: string;
  equipment_name: string;
  equipment_type: 'amp' | 'drums' | 'keyboard' | 'pa_system' | 'microphone' | 'recording_interface' | 'effects_pedals' | 'other';
  hourly_rate: number;
  daily_rate: number;
  condition: number;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

export const STAFF_ROLES = [
  { value: 'manager', label: 'Manager', description: 'Oversees operations and scheduling' },
  { value: 'technician', label: 'Sound Technician', description: 'Maintains equipment and assists bands' },
  { value: 'receptionist', label: 'Receptionist', description: 'Handles bookings and customer service' },
  { value: 'security', label: 'Security', description: 'Ensures safety and manages access' },
  { value: 'maintenance', label: 'Maintenance', description: 'Repairs and upkeep of facilities' },
] as const;

export const UPGRADE_TYPES = [
  { value: 'soundproofing', label: 'Soundproofing', icon: '🔇', maxLevel: 5 },
  { value: 'equipment', label: 'Equipment Quality', icon: '🎸', maxLevel: 5 },
  { value: 'recording_gear', label: 'Recording Gear', icon: '🎙️', maxLevel: 5 },
  { value: 'climate_control', label: 'Climate Control', icon: '❄️', maxLevel: 5 },
  { value: 'lounge_area', label: 'Lounge Area', icon: '🛋️', maxLevel: 5 },
  { value: 'storage', label: 'Storage Space', icon: '📦', maxLevel: 5 },
  { value: 'lighting', label: 'Stage Lighting', icon: '💡', maxLevel: 5 },
] as const;

export const EQUIPMENT_TYPES = [
  { value: 'amp', label: 'Amplifier' },
  { value: 'drums', label: 'Drum Kit' },
  { value: 'keyboard', label: 'Keyboard/Synth' },
  { value: 'pa_system', label: 'PA System' },
  { value: 'microphone', label: 'Microphone' },
  { value: 'recording_interface', label: 'Recording Interface' },
  { value: 'effects_pedals', label: 'Effects Pedals' },
  { value: 'other', label: 'Other' },
] as const;
