export interface VenueBusinessData {
  company_id: string | null;
  is_company_owned: boolean;
  daily_operating_cost: number;
  monthly_rent: number;
  staff_count: number;
  equipment_quality: number;
  sound_system_rating: number;
  lighting_rating: number;
  backstage_quality: number;
  parking_spaces: number;
  has_green_room: boolean;
  has_recording_capability: boolean;
  alcohol_license: boolean;
  total_revenue_lifetime: number;
  total_gigs_hosted: number;
  avg_attendance_rate: number;
  reputation_score: number;
}

export interface VenueStaff {
  id: string;
  venue_id: string;
  name: string;
  role: 'manager' | 'sound_engineer' | 'lighting_tech' | 'security' | 'bartender' | 'door_staff' | 'cleaner' | 'stage_hand';
  skill_level: number;
  salary_weekly: number;
  hired_at: string;
  performance_rating: number;
  created_at: string;
}

export interface VenueBooking {
  id: string;
  venue_id: string;
  band_id: string | null;
  gig_id: string | null;
  booking_type: 'gig' | 'private_event' | 'rehearsal' | 'recording' | 'maintenance' | 'closed';
  booking_date: string;
  start_time: string | null;
  end_time: string | null;
  rental_fee: number | null;
  ticket_revenue_share_pct: number;
  bar_revenue_share_pct: number;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  notes: string | null;
  created_at: string;
  updated_at: string;
  band?: { name: string };
}

export interface VenueFinancialTransaction {
  id: string;
  venue_id: string;
  transaction_type: 'ticket_revenue' | 'bar_revenue' | 'rental_income' | 'staff_wages' | 'maintenance' | 'utilities' | 'rent' | 'equipment' | 'other';
  amount: number;
  description: string | null;
  related_booking_id: string | null;
  created_at: string;
}

export interface VenueUpgrade {
  id: string;
  venue_id: string;
  upgrade_type: 'sound_system' | 'lighting' | 'capacity' | 'backstage' | 'bar' | 'parking' | 'green_room' | 'recording' | 'security';
  upgrade_level: number;
  cost: number;
  installed_at: string;
  description: string | null;
}

export const VENUE_STAFF_ROLES = [
  { value: 'manager', label: 'Venue Manager', baseSalary: 800, description: 'Oversees all venue operations' },
  { value: 'sound_engineer', label: 'Sound Engineer', baseSalary: 600, description: 'Manages audio equipment and live sound' },
  { value: 'lighting_tech', label: 'Lighting Tech', baseSalary: 500, description: 'Controls stage lighting' },
  { value: 'security', label: 'Security', baseSalary: 450, description: 'Ensures safety and crowd control' },
  { value: 'bartender', label: 'Bartender', baseSalary: 350, description: 'Serves drinks at the bar' },
  { value: 'door_staff', label: 'Door Staff', baseSalary: 300, description: 'Manages entry and tickets' },
  { value: 'cleaner', label: 'Cleaner', baseSalary: 250, description: 'Maintains venue cleanliness' },
  { value: 'stage_hand', label: 'Stage Hand', baseSalary: 400, description: 'Assists with stage setup and teardown' },
] as const;

export const VENUE_UPGRADE_TYPES = [
  { value: 'sound_system', label: 'Sound System', baseCost: 25000, description: 'Improve audio quality' },
  { value: 'lighting', label: 'Lighting Rig', baseCost: 15000, description: 'Better stage lighting' },
  { value: 'capacity', label: 'Capacity Expansion', baseCost: 100000, description: 'Increase venue capacity' },
  { value: 'backstage', label: 'Backstage Area', baseCost: 20000, description: 'Upgrade artist facilities' },
  { value: 'bar', label: 'Bar Expansion', baseCost: 30000, description: 'Larger bar, more revenue' },
  { value: 'parking', label: 'Parking Lot', baseCost: 50000, description: 'Add parking spaces' },
  { value: 'green_room', label: 'Green Room', baseCost: 15000, description: 'Artist waiting area' },
  { value: 'recording', label: 'Recording Setup', baseCost: 40000, description: 'Live recording capability' },
  { value: 'security', label: 'Security System', baseCost: 10000, description: 'Cameras and access control' },
] as const;

export const BOOKING_TYPES = [
  { value: 'gig', label: 'Live Gig', color: 'bg-primary' },
  { value: 'private_event', label: 'Private Event', color: 'bg-purple-500' },
  { value: 'rehearsal', label: 'Rehearsal', color: 'bg-blue-500' },
  { value: 'recording', label: 'Recording Session', color: 'bg-green-500' },
  { value: 'maintenance', label: 'Maintenance', color: 'bg-orange-500' },
  { value: 'closed', label: 'Closed', color: 'bg-gray-500' },
] as const;
