import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type StudioEquipmentKind = "recording_equipment" | "rehearsal_equipment";

export interface SubsidiaryEquipmentCatalogItem {
  id: string;
  name: string;
  brand: string | null;
  model: string | null;
  category: string;
  subcategory: string | null;
  base_price: number;
  stock_quantity: number;
}

// Keep these mappings aligned with the server-side whitelist in
// 20261016_catalog_backed_subsidiary_equipment.sql.
// The database revalidates each item and calculates all charges independently.
export function subsidiaryEquipmentType(
  kind: StudioEquipmentKind,
  item: Pick<SubsidiaryEquipmentCatalogItem, "category" | "subcategory">,
): string | null {
  const { category, subcategory } = item;
  if (kind === "recording_equipment") {
    if (category === "recording") return "microphone";
    if (category === "instrument") return "instrument";
    if (category === "stage" && subcategory === "mixer") return "console";
    if (category === "stage" && subcategory === "monitor") return "monitor";
    if (category === "effects" && subcategory === "compressor") return "compressor";
    if (category === "effects" && subcategory === "reverb") return "reverb";
    return null;
  }
  if (category === "amplifier") return "amp";
  if (category === "instrument" && ["drums", "electronic_drums"].includes(subcategory ?? "")) return "drums";
  if (category === "instrument" && ["keyboard", "synthesizer"].includes(subcategory ?? "")) return "keyboard";
  if (category === "stage" && ["pa_speaker", "line_array", "speaker"].includes(subcategory ?? "")) return "pa_system";
  if (category === "recording") return "microphone";
  if (category === "effects") return "effects_pedals";
  return null;
}

export function useSubsidiaryEquipmentCatalog(kind: StudioEquipmentKind) {
  return useQuery({
    queryKey: ["subsidiary-equipment-catalog", kind],
    queryFn: async (): Promise<SubsidiaryEquipmentCatalogItem[]> => {
      const { data, error } = await supabase
        .from("equipment_catalog")
        .select("id, name, brand, model, category, subcategory, base_price, stock_quantity")
        .eq("is_available", true)
        .gt("base_price", 0)
        .gt("stock_quantity", 0)
        .order("base_price", { ascending: true })
        .limit(1000);
      if (error) throw error;
      return (data ?? [])
        .filter((item) => subsidiaryEquipmentType(kind, item) !== null)
        .map((item) => ({
          ...item,
          base_price: Number(item.base_price),
          stock_quantity: Number(item.stock_quantity),
        }));
    },
  });
}

export function subsidiaryEquipmentHourlyRate(price: number) {
  return Math.max(5, Math.round(price * 0.005));
}

export function subsidiaryEquipmentDailyRate(price: number) {
  return Math.max(subsidiaryEquipmentHourlyRate(price), Math.round(price * 0.025));
}
