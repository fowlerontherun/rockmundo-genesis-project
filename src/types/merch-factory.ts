export interface MerchFactory {
  id: string;
  company_id: string;
  name: string;
  city_id: string | null;
  factory_type: 'apparel' | 'accessories' | 'vinyl' | 'cd' | 'posters' | 'mixed';
  quality_level: number;
  production_capacity: number;
  current_production: number;
  equipment_condition: number;
  worker_count: number;
  worker_skill_avg: number;
  operating_costs_daily: number;
  is_operational: boolean;
  created_at: string;
  updated_at: string;
  city?: {
    name: string;
    country: string;
  };
}

export interface MerchProductCatalog {
  id: string;
  factory_id: string;
  product_name: string;
  product_type: 'tshirt' | 'hoodie' | 'cap' | 'poster' | 'vinyl' | 'cd' | 'sticker' | 'patch' | 'keychain' | 'mug';
  base_cost: number;
  suggested_price: number;
  production_time_hours: number;
  min_order_quantity: number;
  is_active: boolean;
  created_at: string;
}

export interface MerchProductionQueue {
  id: string;
  factory_id: string;
  product_catalog_id: string;
  client_band_id: string | null;
  client_label_id: string | null;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  quality_rating: number | null;
  status: 'pending' | 'in_production' | 'quality_check' | 'completed' | 'shipped' | 'cancelled';
  priority: number;
  started_at: string | null;
  estimated_completion: string | null;
  completed_at: string | null;
  shipped_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  product?: MerchProductCatalog;
  client_band?: {
    name: string;
  };
}

export interface MerchFactoryWorker {
  id: string;
  factory_id: string;
  name: string;
  role: 'production' | 'quality_control' | 'supervisor' | 'maintenance';
  skill_level: number;
  experience_months: number;
  salary_weekly: number;
  morale: number;
  hired_at: string;
  created_at: string;
}

export interface MerchQualityRecord {
  id: string;
  production_queue_id: string;
  inspector_id: string | null;
  items_inspected: number;
  items_passed: number;
  items_failed: number;
  defect_types: Record<string, number> | null;
  quality_score: number;
  notes: string | null;
  inspected_at: string;
}

export interface MerchFactoryContract {
  id: string;
  factory_id: string;
  client_band_id: string | null;
  client_label_id: string | null;
  contract_type: 'per_order' | 'monthly' | 'exclusive';
  discount_percentage: number;
  minimum_monthly_orders: number | null;
  priority_level: number;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  client_band?: {
    name: string;
  };
}

export const FACTORY_TYPES = [
  { value: 'apparel', label: 'Apparel', icon: '👕' },
  { value: 'accessories', label: 'Accessories', icon: '🧢' },
  { value: 'vinyl', label: 'Vinyl Records', icon: '💿' },
  { value: 'cd', label: 'CD Production', icon: '📀' },
  { value: 'posters', label: 'Posters & Prints', icon: '🖼️' },
  { value: 'mixed', label: 'Mixed Production', icon: '🏭' },
] as const;

export const PRODUCT_TYPES = [
  { value: 'tshirt', label: 'T-Shirt', baseCost: 8, suggestedPrice: 25 },
  { value: 'hoodie', label: 'Hoodie', baseCost: 18, suggestedPrice: 55 },
  { value: 'cap', label: 'Cap', baseCost: 6, suggestedPrice: 20 },
  { value: 'poster', label: 'Poster', baseCost: 2, suggestedPrice: 15 },
  { value: 'vinyl', label: 'Vinyl Record', baseCost: 12, suggestedPrice: 35 },
  { value: 'cd', label: 'CD', baseCost: 3, suggestedPrice: 15 },
  { value: 'sticker', label: 'Sticker Pack', baseCost: 1, suggestedPrice: 5 },
  { value: 'patch', label: 'Patch', baseCost: 2, suggestedPrice: 8 },
  { value: 'keychain', label: 'Keychain', baseCost: 3, suggestedPrice: 10 },
  { value: 'mug', label: 'Mug', baseCost: 5, suggestedPrice: 18 },
] as const;

export const WORKER_ROLES = [
  { value: 'production', label: 'Production Worker', baseSalary: 400 },
  { value: 'quality_control', label: 'Quality Inspector', baseSalary: 550 },
  { value: 'supervisor', label: 'Supervisor', baseSalary: 750 },
  { value: 'maintenance', label: 'Maintenance Tech', baseSalary: 500 },
] as const;
