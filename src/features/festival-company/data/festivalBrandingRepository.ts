import { supabase } from "@/integrations/supabase/client";
import { festivalBrandingSchema, type FestivalBranding } from "../domain/festivalBranding";

type Rpc = (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>;
const rpc = supabase.rpc.bind(supabase) as unknown as Rpc;

export async function getFestivalBranding(editionId: string): Promise<FestivalBranding> {
  const { data, error } = await rpc("get_festival_edition_branding", { p_edition_id: editionId });
  if (error) throw new Error(error.message || "Festival colours could not be loaded");
  return festivalBrandingSchema.parse(data);
}

export async function saveFestivalBranding(companyId: string, editionId: string, branding: FestivalBranding): Promise<FestivalBranding> {
  const { data, error } = await rpc("save_festival_edition_branding", {
    p_company_id: companyId, p_edition_id: editionId, p_expected_version: branding.version,
    p_theme: branding.theme, p_motif: branding.motif,
  });
  if (error) throw new Error(error.message || "Festival colours could not be saved");
  return festivalBrandingSchema.parse(data);
}