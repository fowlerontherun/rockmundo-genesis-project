import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const nullableString = z.string().nullable();
const nullableNumber = z.number().nullable();

export const festivalCompanyEditionSchema = z.object({
  festivalEditionId: z.string().uuid(),
  editionYear: z.number().int().positive(),
  name: z.string().min(1),
  status: z.string().min(1),
  startsOn: nullableString,
  endsOn: nullableString,
  countryCode: nullableString,
  cityId: z.string().uuid().nullable(),
  vibe: nullableString,
  siteType: nullableString,
  durationDays: nullableNumber,
  environmentalPolicy: nullableString,
  festivalScale: nullableString,
  expectedCapacity: nullableNumber,
  version: z.number().int().nonnegative(),
  lockedAt: nullableString,
  creationSource: z.string().min(1),
  editable: z.boolean(),
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

export type FestivalCompanyEdition = z.infer<typeof festivalCompanyEditionSchema>;
export type FestivalCompanyEditions = z.infer<typeof festivalCompanyEditionsSchema>;

export async function getFestivalCompanyEditions(
  festivalCompanyId: string,
): Promise<FestivalCompanyEditions> {
  const { data, error } = await (supabase as any).rpc(
    "get_festival_company_editions",
    { p_festival_company_id: festivalCompanyId },
  );

  if (error) throw new Error(error.message ?? "festival_editions_unavailable");

  const parsed = festivalCompanyEditionsSchema.safeParse(data);
  if (!parsed.success) throw new Error("malformed_festival_editions_result");
  return parsed.data;
}
