import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const nullableString = z.string().nullable();
const nullableNumber = z.number().nullable();

type FestivalRpc = (
  functionName: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message?: string } | null }>;

const festivalRpc = supabase.rpc.bind(supabase) as unknown as FestivalRpc;

export const festivalCompanyEditionsQueryKey = (festivalCompanyId: string) =>
  ["festival-company-editions", festivalCompanyId] as const;

export const festivalEditionPlanBindingsSchema = z.object({
  configuration: z.boolean(),
  site: z.boolean(),
  tickets: z.boolean(),
  artists: z.boolean(),
  operations: z.boolean(),
  sponsorship: z.boolean(),
  timetable: z.boolean(),
});

export const festivalCompanyEditionSchema = z.object({
  festivalEditionId: z.string().uuid(),
  editionYear: z.number().int().positive(),
  name: z.string().min(1),
  status: z.string().min(1),
  startsOn: nullableString,
  endsOn: nullableString,
  preferredMonth: nullableNumber.optional().default(null),
  countryCode: nullableString,
  cityId: z.string().uuid().nullable(),
  vibe: nullableString,
  siteType: nullableString,
  durationDays: nullableNumber,
  environmentalPolicy: nullableString,
  festivalScale: nullableString,
  marketingEmphasis: nullableString.optional().default(null),
  expectedCapacity: nullableNumber,
  estimatedOperatingCostMinor: z.number().int().nonnegative().optional().default(0),
  planningStatus: z
    .enum(["not_started", "in_progress", "ready"])
    .optional()
    .default("not_started"),
  readinessScore: z.number().int().min(0).max(100).optional().default(0),
  version: z.number().int().nonnegative(),
  lockedAt: nullableString,
  creationSource: z.string().min(1),
  editable: z.boolean(),
  planBindings: festivalEditionPlanBindingsSchema,
});

export const festivalCompanyEditionsSchema = z.object({
  festivalCompanyId: z.string().uuid(),
  publicName: z.string().min(1),
  companyStatus: z.string().min(1),
  setupCompleted: z.boolean(),
  canPlanNext: z.boolean(),
  currentGameYear: z.number().int().positive(),
  editions: z.array(festivalCompanyEditionSchema),
});

export type FestivalEditionPlanBindings = z.infer<
  typeof festivalEditionPlanBindingsSchema
>;
export type FestivalEditionPlanBindingKey = keyof FestivalEditionPlanBindings;
export type FestivalCompanyEdition = z.infer<typeof festivalCompanyEditionSchema>;
export type FestivalCompanyEditions = z.infer<typeof festivalCompanyEditionsSchema>;

export async function getFestivalCompanyEditions(
  festivalCompanyId: string,
): Promise<FestivalCompanyEditions> {
  const { data, error } = await festivalRpc("get_festival_company_editions", {
    p_festival_company_id: festivalCompanyId,
  });

  if (error) throw new Error(error.message ?? "festival_editions_unavailable");

  const parsed = festivalCompanyEditionsSchema.safeParse(data);
  if (!parsed.success) throw new Error("malformed_festival_editions_result");
  return parsed.data;
}
