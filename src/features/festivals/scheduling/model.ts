import { z } from "zod";

export const scheduleItemSchema = z.object({
  id: z.string(),
  revision_id: z.string().optional(),
  festival_id: z.string(),
  edition_id: z.string(),
  stage_id: z.string().nullable().optional(),
  festival_date: z.string().nullable().optional(),
  item_type: z.string(),
  starts_at: z.string().nullable().optional(),
  ends_at: z.string().nullable().optional(),
  duration_minutes: z.coerce.number(),
  title: z.string(),
  status: z.string().optional(),
  locked: z.boolean().optional(),
  public_visible: z.boolean().optional(),
  changeover_minutes: z.coerce.number().optional(),
  internal_notes: z.string().nullable().optional(),
  version: z.coerce.number().optional(),
}).passthrough();

export const stageOperatingHoursSchema = z.object({
  id: z.string().optional(),
  stage_id: z.string(),
  festival_date: z.string(),
  opens_at: z.string(),
  curfew_at: z.string(),
  shutdown_buffer_minutes: z.coerce.number().optional(),
  default_changeover_minutes: z.coerce.number().optional(),
  public_operating_label: z.string().nullable().optional(),
}).passthrough();

export const workspaceSchema = z.object({
  festival: z.record(z.unknown()).nullable(),
  edition: z.record(z.unknown()),
  timeZone: z.string(),
  festivalDates: z.array(z.string()),
  scheduleState: z.string(),
  draftRevision: z.record(z.unknown()).nullable(),
  publishedRevision: z.record(z.unknown()).nullable().optional(),
  revisionHistory: z.array(z.record(z.unknown())),
  stages: z.array(z.record(z.unknown())),
  operatingHours: z.array(stageOperatingHoursSchema).default([]),
  scheduleItems: z.array(scheduleItemSchema),
  unscheduledItems: z.array(scheduleItemSchema),
  conflictSummary: z.record(z.unknown()),
  readinessSummary: z.record(z.unknown()),
  permissions: z.record(z.unknown()),
  availableActions: z.array(z.string()),
}).passthrough();

export type FestivalScheduleWorkspaceData = z.infer<typeof workspaceSchema>;
export type FestivalScheduleItem = z.infer<typeof scheduleItemSchema>;
export type FestivalStageOperatingHours = z.infer<typeof stageOperatingHoursSchema>;

export const scheduleTemplates = [
  ["small_stage", "Small stage"],
  ["standard_stage", "Standard stage"],
  ["festival_main_stage", "Festival main stage"],
  ["new_music_stage", "New music stage"],
  ["electronic_stage", "Electronic stage"],
] as const;
