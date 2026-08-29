import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/lib/supabase-types";

export const TOUR_OPERATIONS_QUERY_KEY = "tour-operations-workspace";

export type ProductionStatus = "ready" | "at_risk" | "blocked" | string;

export interface TourOperationCrewMember {
  id?: string;
  gig_id?: string | null;
  display_name: string;
  role: string;
  shift_starts_at?: string | null;
  shift_ends_at?: string | null;
  daily_cost: number;
  fatigue_score: number;
  morale_score: number;
  accommodation_status: string;
  transport_status: string;
}

export interface TourOperationEquipmentItem {
  id?: string;
  name: string;
  equipment_source: string;
  equipment_id?: string | null;
  role: string;
  load_weight: number;
  condition_snapshot: number;
  is_spare: boolean;
  in_transit: boolean;
  needs_repair: boolean;
  replacement_cost: number;
  current_city_id?: string | null;
}

export interface TourMerchandisePlan {
  starting_stock: number;
  stock_remaining?: number;
  units_sold?: number;
  lost_sales?: number;
  unit_cost: number;
  unit_price: number;
  reorder_quantity: number;
  reorder_cost: number;
  shipping_cost: number;
  storage_cost_per_day: number;
  updated_at?: string;
}

export type SponsorObligationType =
  | "meet_fans"
  | "social_post"
  | "vip_appearance"
  | "interview"
  | "merch_promotion";

export interface TourSponsorObligation {
  id?: string;
  sponsor_name: string;
  obligation_type: SponsorObligationType;
  due_gig_id?: string | null;
  due_at?: string | null;
  value_amount: number;
  status?: string;
  completed_at?: string | null;
  notes?: string | null;
}

export interface TourOperationSettings {
  production_package: string;
  lighting_package: string;
  audio_package: string;
  vehicle_setup: Record<string, Json | undefined>;
  accommodation_preferences: Record<string, Json | undefined>;
  rehearsal_schedule: Record<string, Json | undefined>;
  catering_preferences: Record<string, Json | undefined>;
  backup_equipment: Json[];
}

export interface TourOperationsPlan {
  crew: TourOperationCrewMember[];
  equipment: TourOperationEquipmentItem[];
  merchandise: TourMerchandisePlan;
  sponsors: TourSponsorObligation[];
  settings: TourOperationSettings;
}

export interface TourOperationTemplate {
  id: string;
  name: string;
  production_package: string;
  crew: TourOperationCrewMember[];
  equipment: TourOperationEquipmentItem[];
  vehicle_setup: Record<string, Json | undefined>;
  accommodation_preferences: Record<string, Json | undefined>;
  rehearsal_schedule: Record<string, Json | undefined>;
  catering_preferences: Record<string, Json | undefined>;
  backup_equipment: Json[];
  lighting_package: string;
  audio_package: string;
  merchandise: TourMerchandisePlan;
  sponsors: TourSponsorObligation[];
  updated_at: string;
}

export interface TourLiveStop {
  id: string;
  date: string;
  rating: number | null;
  status: string;
  city_id: string | null;
  revenue: number;
  capacity: number;
  venue_id: string | null;
  city_name: string;
  venue_name: string;
  ticket_price: number;
  tickets_sold: number;
}

export interface TourLiveIssue {
  code?: string;
  message: string;
  severity?: string;
  [key: string]: unknown;
}

export interface TourLiveSnapshot {
  tour: {
    id: string;
    name: string;
    scope: string | null;
    status: string;
    band_id: string | null;
    end_date: string;
    start_date: string;
    travel_mode: string | null;
    vehicle_tier: string;
    production_rating: number;
  };
  stops: TourLiveStop[];
  issues: TourLiveIssue[];
  travel: {
    total_cost: number;
    total_legs: number;
    total_hours: number;
    cancelled_legs: number;
    completed_legs: number;
    next_leg?: Record<string, Json | undefined> | null;
  };
  finance: {
    travel_cost: number;
    sponsor_cash: number;
    upfront_cost: number;
    realised_revenue: number;
    stage_setup_cost: number;
    accommodation_cost: number;
    stored_total_revenue: number;
    equipment_hauling_cost: number;
  };
  progress: {
    total: number;
    cancelled: number;
    completed: number;
    remaining: number;
  };
  logistics: Record<string, Json | undefined>;
  performance: {
    tickets_sold: number;
    average_rating: number | null;
  };
  current_stop: Pick<TourLiveStop, "id" | "date" | "status" | "city_name" | "venue_name"> | null;
  next_stop: Pick<TourLiveStop, "id" | "date" | "status" | "city_name" | "venue_name"> | null;
  generated_at: string;
}

export interface TourLogisticsEvent {
  id: string;
  gig_id: string | null;
  event_type: string;
  severity: string;
  message: string;
  cost_impact: number;
  fatigue_impact: number;
  morale_impact: number;
  resolved: boolean;
  generated_at: string;
  resolved_at: string | null;
}

export interface TourBudgetEntry {
  id: string;
  gig_id: string | null;
  category: string;
  direction: string;
  amount: number;
  source_type: string;
  description: string | null;
  posted_at: string;
}

export interface TourCompletionReport {
  tour_id: string;
  completed_at: string;
  financial_performance: Record<string, Json | undefined>;
  reputation_gained: number;
  fans_gained: number;
  crew_performance: Record<string, Json | undefined>;
  equipment_wear: Record<string, Json | undefined>;
  vehicle_usage: Record<string, Json | undefined>;
  tour_highlights: Json[];
  best_gig_id: string | null;
  worst_gig_id: string | null;
  most_profitable_city_id: string | null;
  strongest_audience_city_id: string | null;
  biggest_media_story: string | null;
  future_planning_modifiers: Record<string, Json | undefined>;
}

export interface TourOperationsWorkspace {
  live: TourLiveSnapshot;
  can_manage: boolean;
  state: {
    plan_version: number;
    template_id?: string | null;
    plan_snapshot?: Partial<TourOperationsPlan>;
    fatigue_score?: number;
    health_score?: number;
    band_morale?: number;
    crew_morale?: number;
    tour_reputation?: number;
    tour_momentum?: number;
    production_status: ProductionStatus;
    outstanding_issues?: TourLiveIssue[];
    updated_at?: string;
  };
  templates: TourOperationTemplate[];
  crew: TourOperationCrewMember[];
  equipment: TourOperationEquipmentItem[];
  merchandise: TourMerchandisePlan | null;
  sponsors: TourSponsorObligation[];
  events: TourLogisticsEvent[];
  ledger: TourBudgetEntry[];
  report: TourCompletionReport | null;
  generated_at: string;
}

export type TourLogisticsEventType =
  | "vehicle_breakdown"
  | "flight_delay"
  | "lost_luggage"
  | "food_poisoning"
  | "sponsor_dinner"
  | "fan_meet_greet"
  | "local_media_interview"
  | "weather_delay"
  | "customs_inspection"
  | "equipment_delivery_issue"
  | "unexpected_upgrade"
  | "hotel_overbooking";

export const EMPTY_TOUR_OPERATIONS_PLAN: TourOperationsPlan = {
  crew: [],
  equipment: [],
  merchandise: {
    starting_stock: 0,
    unit_cost: 0,
    unit_price: 0,
    reorder_quantity: 0,
    reorder_cost: 0,
    shipping_cost: 0,
    storage_cost_per_day: 0,
  },
  sponsors: [],
  settings: {
    production_package: "basic",
    lighting_package: "house",
    audio_package: "house",
    vehicle_setup: {},
    accommodation_preferences: {},
    rehearsal_schedule: {},
    catering_preferences: {},
    backup_equipment: [],
  },
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const assertWorkspace = (value: unknown): TourOperationsWorkspace => {
  if (!isRecord(value) || !isRecord(value.live) || !isRecord(value.state)) {
    throw new Error("Tour HQ returned an invalid workspace payload");
  }

  return value as unknown as TourOperationsWorkspace;
};

const requestId = () => crypto.randomUUID();

export const getTourOperationsWorkspace = async (
  tourId: string,
): Promise<TourOperationsWorkspace> => {
  const { data, error } = await supabase.rpc("get_tour_operations_workspace", {
    p_tour_id: tourId,
  });

  if (error) throw error;
  return assertWorkspace(data);
};

export const saveTourOperationsPlan = async (
  tourId: string,
  expectedVersion: number,
  plan: TourOperationsPlan,
  idempotencyKey: string = requestId(),
): Promise<{ tour_id: string; version: number; already_applied: boolean }> => {
  const { data, error } = await supabase.rpc("save_tour_operations_plan", {
    p_tour_id: tourId,
    p_expected_version: expectedVersion,
    p_plan: plan as unknown as Json,
    p_idempotency_key: idempotencyKey,
  });

  if (error) throw error;
  return data as unknown as { tour_id: string; version: number; already_applied: boolean };
};

export const saveTourOperationTemplate = async (
  tourId: string,
  name: string,
  plan: TourOperationsPlan,
  templateId?: string,
  idempotencyKey: string = requestId(),
): Promise<{ template_id: string; name: string; already_applied: boolean }> => {
  const template = {
    id: templateId,
    name,
    crew: plan.crew,
    equipment: plan.equipment,
    merchandise: plan.merchandise,
    sponsors: plan.sponsors,
    ...plan.settings,
  };
  const { data, error } = await supabase.rpc("save_tour_operation_template", {
    p_tour_id: tourId,
    p_template: template as unknown as Json,
    p_idempotency_key: idempotencyKey,
  });

  if (error) throw error;
  return data as unknown as { template_id: string; name: string; already_applied: boolean };
};

export const applyTourOperationTemplate = async (
  tourId: string,
  templateId: string,
  expectedVersion: number,
  idempotencyKey: string = requestId(),
): Promise<{ tour_id: string; template_id: string; version: number; already_applied: boolean }> => {
  const { data, error } = await supabase.rpc("apply_tour_operation_template", {
    p_tour_id: tourId,
    p_template_id: templateId,
    p_expected_version: expectedVersion,
    p_idempotency_key: idempotencyKey,
  });

  if (error) throw error;
  return data as unknown as {
    tour_id: string;
    template_id: string;
    version: number;
    already_applied: boolean;
  };
};

export const recordTourLogisticsEvent = async (
  tourId: string,
  eventType: TourLogisticsEventType,
  notes?: string,
  gigId?: string,
  idempotencyKey: string = requestId(),
): Promise<{ event_id: string; version: number; already_applied: boolean }> => {
  const { data, error } = await supabase.rpc("record_tour_logistics_event", {
    p_tour_id: tourId,
    p_event_type: eventType,
    p_notes: notes,
    p_gig_id: gigId,
    p_idempotency_key: idempotencyKey,
  });

  if (error) throw error;
  return data as unknown as { event_id: string; version: number; already_applied: boolean };
};

export const resolveTourLogisticsEvent = async (
  tourId: string,
  eventId: string,
  idempotencyKey: string = requestId(),
): Promise<{ event_id: string; version: number; already_applied: boolean }> => {
  const { data, error } = await supabase.rpc("resolve_tour_logistics_event", {
    p_tour_id: tourId,
    p_event_id: eventId,
    p_idempotency_key: idempotencyKey,
  });

  if (error) throw error;
  return data as unknown as { event_id: string; version: number; already_applied: boolean };
};

export const completeTourOperationsReport = async (
  tourId: string,
  idempotencyKey: string = requestId(),
): Promise<TourCompletionReport & { already_applied: boolean }> => {
  const { data, error } = await supabase.rpc("complete_tour_operations_report", {
    p_tour_id: tourId,
    p_idempotency_key: idempotencyKey,
  });

  if (error) throw error;
  return data as unknown as TourCompletionReport & { already_applied: boolean };
};

const copySettings = (settings?: Partial<TourOperationSettings>): TourOperationSettings => ({
  ...EMPTY_TOUR_OPERATIONS_PLAN.settings,
  ...settings,
  vehicle_setup: { ...(settings?.vehicle_setup ?? {}) },
  accommodation_preferences: { ...(settings?.accommodation_preferences ?? {}) },
  rehearsal_schedule: { ...(settings?.rehearsal_schedule ?? {}) },
  catering_preferences: { ...(settings?.catering_preferences ?? {}) },
  backup_equipment: [...(settings?.backup_equipment ?? [])],
});

export const workspaceToEditablePlan = (
  workspace: TourOperationsWorkspace,
): TourOperationsPlan => {
  const snapshot = workspace.state.plan_snapshot;
  return {
    crew: [...(snapshot?.crew ?? workspace.crew)],
    equipment: [...(snapshot?.equipment ?? workspace.equipment)],
    merchandise: {
      ...EMPTY_TOUR_OPERATIONS_PLAN.merchandise,
      ...(snapshot?.merchandise ?? workspace.merchandise ?? {}),
    },
    sponsors: [...(snapshot?.sponsors ?? workspace.sponsors)],
    settings: copySettings(snapshot?.settings),
  };
};

export const tourOperationsErrorMessage = (error: unknown): string => {
  const message = isRecord(error) && typeof error.message === "string"
    ? error.message
    : error instanceof Error
      ? error.message
      : "Tour HQ could not complete that operation.";

  if (message.includes("tour_operations_version_conflict")) {
    return "This plan changed in another session. Refresh Tour HQ, review the latest version, and try again.";
  }
  if (message.includes("tour_operations_manage_forbidden")) {
    return "Only the band leader or manager can change this Tour HQ plan.";
  }
  if (message.includes("tour_operations_report_not_ready")) {
    return "The completion report is available after every remaining stop is completed or cancelled.";
  }

  return message;
};
