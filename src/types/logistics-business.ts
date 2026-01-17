// Logistics & Transport Company Business Types

export interface LogisticsCompany {
  id: string;
  company_id: string;
  name: string;
  license_tier: number;
  fleet_capacity: number;
  current_fleet_size: number;
  service_quality_rating: number;
  on_time_delivery_rate: number;
  total_contracts_completed: number;
  total_distance_covered: number;
  specializations: string[];
  insurance_coverage: number;
  operating_regions: string[];
  reputation: number;
  created_at: string;
  updated_at: string;
}

export interface LogisticsFleetVehicle {
  id: string;
  logistics_company_id: string;
  vehicle_catalog_id: string | null;
  name: string;
  vehicle_type: string;
  capacity_units: number;
  condition_percent: number;
  purchase_cost: number | null;
  purchase_date: string | null;
  total_km_traveled: number;
  last_maintenance_km: number;
  next_maintenance_due: string | null;
  fuel_efficiency: number;
  status: 'available' | 'in_transit' | 'maintenance' | 'retired';
  assigned_driver_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LogisticsDriver {
  id: string;
  logistics_company_id: string;
  profile_id: string | null;
  name: string;
  is_npc: boolean;
  license_type: 'standard' | 'commercial' | 'hazmat' | 'oversize';
  experience_years: number;
  skill_level: number;
  reliability_rating: number;
  salary_per_day: number;
  hired_at: string;
  status: 'active' | 'on_trip' | 'off_duty' | 'terminated';
  total_trips_completed: number;
  total_km_driven: number;
  accidents: number;
  created_at: string;
  updated_at: string;
}

export interface LogisticsContract {
  id: string;
  logistics_company_id: string;
  client_band_id: string | null;
  client_company_id: string | null;
  tour_id: string | null;
  contract_type: 'tour_transport' | 'equipment_haul' | 'merch_delivery' | 'one_way' | 'round_trip';
  vehicles_required: number;
  drivers_required: number;
  origin_city_id: string | null;
  destination_city_id: string | null;
  distance_km: number | null;
  estimated_duration_hours: number | null;
  cargo_description: string | null;
  cargo_weight_kg: number | null;
  cargo_value: number | null;
  fee_quoted: number;
  fee_paid: number;
  start_date: string | null;
  end_date: string | null;
  actual_start: string | null;
  actual_end: string | null;
  status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled' | 'disputed';
  client_rating: number | null;
  company_rating: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LogisticsContractAssignment {
  id: string;
  contract_id: string;
  vehicle_id: string;
  driver_id: string;
  leg_number: number;
  origin_city_id: string | null;
  destination_city_id: string | null;
  distance_km: number | null;
  scheduled_departure: string | null;
  scheduled_arrival: string | null;
  actual_departure: string | null;
  actual_arrival: string | null;
  status: 'scheduled' | 'in_transit' | 'delayed' | 'completed' | 'cancelled';
  delay_minutes: number;
  fuel_cost: number | null;
  toll_cost: number | null;
  incident_notes: string | null;
  created_at: string;
}

export interface LogisticsTransaction {
  id: string;
  logistics_company_id: string;
  contract_id: string | null;
  transaction_type: 'contract_payment' | 'fuel_expense' | 'maintenance' | 'salary' | 'vehicle_purchase' | 'insurance' | 'toll' | 'penalty' | 'bonus';
  amount: number;
  description: string | null;
  transaction_date: string;
  created_at: string;
}

export interface LogisticsUpgrade {
  id: string;
  logistics_company_id: string;
  upgrade_type: 'fleet_capacity' | 'gps_tracking' | 'climate_control' | 'insurance_premium' | 'regional_expansion' | 'hazmat_certification' | 'oversize_permit';
  upgrade_level: number;
  cost: number;
  purchased_at: string;
  active: boolean;
  expires_at: string | null;
  created_at: string;
}

// Constants
export const LICENSE_TIER_NAMES: Record<number, string> = {
  1: 'Local Courier',
  2: 'Regional Hauler',
  3: 'National Freight',
  4: 'International Logistics',
  5: 'Global Transport Network',
};

export const LICENSE_TIER_FLEET_LIMITS: Record<number, number> = {
  1: 3,
  2: 8,
  3: 20,
  4: 50,
  5: 100,
};

export const LICENSE_TIER_OPERATING_RADIUS: Record<number, string> = {
  1: 'Single city/region',
  2: 'Multiple regions within country',
  3: 'Nationwide',
  4: 'Continental',
  5: 'Worldwide',
};

export const DRIVER_LICENSE_TYPES = [
  { value: 'standard', label: 'Standard', description: 'Basic vehicles up to 3.5 tons' },
  { value: 'commercial', label: 'Commercial (CDL)', description: 'Trucks and tour buses' },
  { value: 'hazmat', label: 'Hazmat', description: 'Pyrotechnics and special effects equipment' },
  { value: 'oversize', label: 'Oversize Load', description: 'Large stage rigs and heavy equipment' },
] as const;

export const LOGISTICS_SPECIALIZATIONS = [
  { value: 'general', label: 'General Freight', description: 'Standard cargo transport' },
  { value: 'equipment', label: 'Music Equipment', description: 'Instruments and backline' },
  { value: 'stage', label: 'Stage Production', description: 'Lighting rigs and staging' },
  { value: 'merch', label: 'Merchandise', description: 'Band merch and retail goods' },
  { value: 'temperature', label: 'Climate Control', description: 'Temperature-sensitive cargo' },
  { value: 'fragile', label: 'Fragile Goods', description: 'Delicate instruments and art' },
] as const;

export const LOGISTICS_UPGRADE_TYPES = [
  { value: 'fleet_capacity', label: 'Fleet Expansion', baseCost: 50000, description: 'Add more vehicle slots' },
  { value: 'gps_tracking', label: 'GPS Tracking System', baseCost: 15000, description: 'Real-time fleet monitoring' },
  { value: 'climate_control', label: 'Climate Control Fleet', baseCost: 30000, description: 'Temperature-controlled vehicles' },
  { value: 'insurance_premium', label: 'Premium Insurance', baseCost: 25000, description: 'Higher coverage limits' },
  { value: 'regional_expansion', label: 'Regional License', baseCost: 40000, description: 'Expand operating territory' },
  { value: 'hazmat_certification', label: 'Hazmat Certification', baseCost: 20000, description: 'Transport pyrotechnics safely' },
  { value: 'oversize_permit', label: 'Oversize Load Permit', baseCost: 35000, description: 'Transport large stage equipment' },
] as const;

export const CONTRACT_TYPES = [
  { value: 'tour_transport', label: 'Tour Transport', description: 'Full tour logistics support' },
  { value: 'equipment_haul', label: 'Equipment Haul', description: 'Move gear between locations' },
  { value: 'merch_delivery', label: 'Merch Delivery', description: 'Deliver merchandise to venues' },
  { value: 'one_way', label: 'One-Way Trip', description: 'Single destination delivery' },
  { value: 'round_trip', label: 'Round Trip', description: 'Delivery and return' },
] as const;
