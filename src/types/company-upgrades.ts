export interface SecurityFirmUpgrade {
  id: string;
  security_firm_id: string;
  upgrade_type: string;
  name: string;
  level: number;
  cost: number;
  effect_value: number;
  effect_description: string | null;
  installed_at: string;
  created_at: string;
}

export interface MerchFactoryUpgrade {
  id: string;
  merch_factory_id: string;
  upgrade_type: string;
  name: string;
  level: number;
  cost: number;
  effect_value: number;
  effect_description: string | null;
  installed_at: string;
  created_at: string;
}

export interface LogisticsCompanyUpgrade {
  id: string;
  logistics_company_id: string;
  upgrade_type: string;
  name: string;
  level: number;
  cost: number;
  effect_value: number;
  effect_description: string | null;
  installed_at: string;
  created_at: string;
}

export interface VenueUpgrade {
  id: string;
  venue_id: string;
  upgrade_type: string;
  name: string;
  level: number;
  cost: number;
  effect_value: number;
  effect_description: string | null;
  installed_at: string;
  created_at: string;
}

export const SECURITY_UPGRADE_TYPES = [
  { value: 'basic_training', label: 'Basic Training', icon: '🎓', maxLevel: 5 },
  { value: 'crowd_control', label: 'Crowd Control', icon: '👥', maxLevel: 5 },
  { value: 'vip_protection', label: 'VIP Protection', icon: '⭐', maxLevel: 3 },
  { value: 'emergency_response', label: 'Emergency Response', icon: '🚨', maxLevel: 5 },
  { value: 'equipment', label: 'Equipment Upgrade', icon: '🛡️', maxLevel: 5 },
] as const;

export const FACTORY_UPGRADE_TYPES = [
  { value: 'print_quality', label: 'Print Quality', icon: '🖨️', maxLevel: 5 },
  { value: 'speed_lines', label: 'Speed Lines', icon: '⚡', maxLevel: 5 },
  { value: 'custom_packaging', label: 'Custom Packaging', icon: '📦', maxLevel: 3 },
  { value: 'eco_materials', label: 'Eco-Friendly Materials', icon: '🌱', maxLevel: 3 },
  { value: 'design_studio', label: 'Design Studio', icon: '🎨', maxLevel: 3 },
] as const;

export const LOGISTICS_UPGRADE_TYPES = [
  { value: 'gps_tracking', label: 'GPS Tracking', icon: '📍', maxLevel: 3 },
  { value: 'climate_control', label: 'Climate Control', icon: '❄️', maxLevel: 3 },
  { value: 'fleet_expansion', label: 'Fleet Expansion', icon: '🚛', maxLevel: 5 },
  { value: 'premium_insurance', label: 'Premium Insurance', icon: '📋', maxLevel: 3 },
] as const;

export const VENUE_UPGRADE_TYPES = [
  { value: 'sound_system', label: 'Sound System', icon: '🔊', maxLevel: 5 },
  { value: 'lighting', label: 'Lighting Rig', icon: '💡', maxLevel: 5 },
  { value: 'backstage', label: 'Backstage Facilities', icon: '🚪', maxLevel: 3 },
  { value: 'security_system', label: 'Security System', icon: '📹', maxLevel: 3 },
  { value: 'bar_facilities', label: 'Bar & Catering', icon: '🍺', maxLevel: 3 },
] as const;
