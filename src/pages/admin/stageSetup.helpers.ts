import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/lib/supabase-types";

export type StageBandRoleRow = Tables<"stage_band_roles">;
export type StageBandRoleInsert = TablesInsert<"stage_band_roles">;
export type StageBandRoleUpdate = TablesUpdate<"stage_band_roles">;

export type StagePedalboardItemRow = Tables<"stage_pedalboard_items">;
export type StagePedalboardItemInsert = TablesInsert<"stage_pedalboard_items">;
export type StagePedalboardItemUpdate = TablesUpdate<"stage_pedalboard_items">;

export type StageRigSystemRow = Tables<"stage_rig_systems">;
export type StageRigSystemInsert = TablesInsert<"stage_rig_systems">;
export type StageRigSystemUpdate = TablesUpdate<"stage_rig_systems">;

export type StageCrewRoleRow = Tables<"stage_crew_roles">;
export type StageCrewRoleInsert = TablesInsert<"stage_crew_roles">;
export type StageCrewRoleUpdate = TablesUpdate<"stage_crew_roles">;

export type StageSetupMetricRow = Tables<"stage_setup_metrics">;
export type StageSetupMetricInsert = TablesInsert<"stage_setup_metrics">;
export type StageSetupMetricUpdate = TablesUpdate<"stage_setup_metrics">;

export type StageBandRoleWithPedals = StageBandRoleRow & {
  pedalboard: StagePedalboardItemRow[];
};

export const multilineToArray = (value: string): string[] => {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
};

export const arrayToMultiline = (values: string[] | null | undefined): string => {
  return Array.isArray(values) && values.length > 0 ? values.join("\n") : "";
};

export const bandRoleSchema = z.object({
  role: z.string().min(1, "Role is required"),
  instrument: z.string().min(1, "Instrument is required"),
  amps: z.string().optional(),
  monitors: z.string().optional(),
  notes: z.string().optional(),
});

export type StageBandRoleFormValues = z.infer<typeof bandRoleSchema>;

export const defaultBandRoleValues: StageBandRoleFormValues = {
  role: "",
  instrument: "",
  amps: "",
  monitors: "",
  notes: "",
};

export const rigSystemSchema = z.object({
  system: z.string().min(1, "System name is required"),
  status: z.string().min(1, "Status is required"),
  coverage: z.string().optional(),
  details: z.string().optional(),
});

export type StageRigSystemFormValues = z.infer<typeof rigSystemSchema>;

export const defaultRigSystemValues: StageRigSystemFormValues = {
  system: "",
  status: "",
  coverage: "",
  details: "",
};

export const crewRoleSchema = z.object({
  specialty: z.string().min(1, "Specialty is required"),
  headcount: z
    .coerce
    .number({ invalid_type_error: "Headcount must be a number" })
    .int("Headcount must be a whole number")
    .min(1, "Headcount must be at least 1"),
  responsibilities: z.string().optional(),
  skill: z
    .coerce
    .number({ invalid_type_error: "Skill must be a number" })
    .int("Skill must be a whole number")
    .min(0, "Skill cannot be negative")
    .max(100, "Skill cannot exceed 100"),
});

export type StageCrewRoleFormValues = z.infer<typeof crewRoleSchema>;

export const defaultCrewRoleValues: StageCrewRoleFormValues = {
  specialty: "",
  headcount: 1,
  responsibilities: "",
  skill: 50,
};

export const pedalboardItemSchema = z.object({
  position: z
    .coerce
    .number({ invalid_type_error: "Position must be a number" })
    .int("Position must be a whole number")
    .min(1, "Position must be at least 1"),
  pedal: z.string().min(1, "Pedal name is required"),
  notes: z.string().optional(),
  powerDraw: z.string().optional(),
});

export type StagePedalboardFormValues = z.infer<typeof pedalboardItemSchema>;

export const defaultPedalboardValues: StagePedalboardFormValues = {
  position: 1,
  pedal: "",
  notes: "",
  powerDraw: "",
};

const preprocessOptionalNumber = (value: unknown) => {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isNaN(parsed) ? value : parsed;
};

export const metricsSchema = z.object({
  rating: z
    .coerce
    .number({ invalid_type_error: "Rating must be a number" })
    .min(0, "Rating cannot be negative"),
  maxRating: z
    .coerce
    .number({ invalid_type_error: "Maximum rating must be a number" })
    .min(1, "Maximum rating must be at least 1"),
  currentWattage: z
    .preprocess(preprocessOptionalNumber, z
      .number({ invalid_type_error: "Current wattage must be a number" })
      .min(0, "Current wattage cannot be negative")
      .optional()),
  maxDb: z
    .preprocess(preprocessOptionalNumber, z
      .number({ invalid_type_error: "Max dB must be a number" })
      .min(0, "Max dB cannot be negative")
      .optional()),
});

export type StageMetricsFormValues = z.infer<typeof metricsSchema>;

export const defaultMetricsValues: StageMetricsFormValues = {
  rating: 40,
  maxRating: 50,
  currentWattage: undefined,
  maxDb: undefined,
};

export const fetchStageBandRolesWithPedals = async (): Promise<StageBandRoleWithPedals[]> => {
  const { data: rolesData, error: rolesError } = await supabase
    .from("stage_band_roles")
    .select("*")
    .order("role", { ascending: true });

  if (rolesError) throw rolesError;

  const { data: pedalData, error: pedalError } = await supabase
    .from("stage_pedalboard_items")
    .select("*")
    .order("position", { ascending: true });

  if (pedalError) throw pedalError;

  const pedalboardByRole = new Map<string, StagePedalboardItemRow[]>();
  for (const item of pedalData ?? []) {
    const list = pedalboardByRole.get(item.band_role_id) ?? [];
    list.push(item);
    pedalboardByRole.set(item.band_role_id, list);
  }

  return (rolesData ?? []).map((role) => ({
    ...role,
    pedalboard: pedalboardByRole.get(role.id) ?? [],
  }));
};

export const createStageBandRole = async (payload: StageBandRoleInsert) => {
  const { error } = await supabase.from("stage_band_roles").insert(payload);
  if (error) throw error;
};

export const updateStageBandRole = async (id: string, payload: StageBandRoleUpdate) => {
  const { error } = await supabase.from("stage_band_roles").update(payload).eq("id", id);
  if (error) throw error;
};

export const deleteStageBandRole = async (id: string) => {
  const { error } = await supabase.from("stage_band_roles").delete().eq("id", id);
  if (error) throw error;
};

export const createStagePedalboardItem = async (payload: StagePedalboardItemInsert) => {
  const { error } = await supabase.from("stage_pedalboard_items").insert(payload);
  if (error) throw error;
};

export const updateStagePedalboardItem = async (id: string, payload: StagePedalboardItemUpdate) => {
  const { error } = await supabase.from("stage_pedalboard_items").update(payload).eq("id", id);
  if (error) throw error;
};

export const deleteStagePedalboardItem = async (id: string) => {
  const { error } = await supabase.from("stage_pedalboard_items").delete().eq("id", id);
  if (error) throw error;
};

export const fetchStageRigSystems = async (): Promise<StageRigSystemRow[]> => {
  const { data, error } = await supabase
    .from("stage_rig_systems")
    .select("*")
    .order("system", { ascending: true });

  if (error) throw error;
  return (data as StageRigSystemRow[] | null) ?? [];
};

export const createStageRigSystem = async (payload: StageRigSystemInsert) => {
  const { error } = await supabase.from("stage_rig_systems").insert(payload);
  if (error) throw error;
};

export const updateStageRigSystem = async (id: string, payload: StageRigSystemUpdate) => {
  const { error } = await supabase.from("stage_rig_systems").update(payload).eq("id", id);
  if (error) throw error;
};

export const deleteStageRigSystem = async (id: string) => {
  const { error } = await supabase.from("stage_rig_systems").delete().eq("id", id);
  if (error) throw error;
};

export const fetchStageCrewRoles = async (): Promise<StageCrewRoleRow[]> => {
  const { data, error } = await supabase
    .from("stage_crew_roles")
    .select("*")
    .order("specialty", { ascending: true });

  if (error) throw error;
  return (data as StageCrewRoleRow[] | null) ?? [];
};

export const createStageCrewRole = async (payload: StageCrewRoleInsert) => {
  const { error } = await supabase.from("stage_crew_roles").insert(payload);
  if (error) throw error;
};

export const updateStageCrewRole = async (id: string, payload: StageCrewRoleUpdate) => {
  const { error } = await supabase.from("stage_crew_roles").update(payload).eq("id", id);
  if (error) throw error;
};

export const deleteStageCrewRole = async (id: string) => {
  const { error } = await supabase.from("stage_crew_roles").delete().eq("id", id);
  if (error) throw error;
};

export const fetchStageSetupMetrics = async (): Promise<StageSetupMetricRow | null> => {
  const { data, error } = await supabase
    .from("stage_setup_metrics")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as StageSetupMetricRow | null) ?? null;
};

export const saveStageSetupMetrics = async (
  payload: StageSetupMetricInsert | StageSetupMetricUpdate,
  id?: string,
) => {
  if (id) {
    const { error } = await supabase.from("stage_setup_metrics").update(payload).eq("id", id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("stage_setup_metrics").insert(payload);
  if (error) throw error;
};
