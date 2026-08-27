import { supabase } from "@/integrations/supabase/client";

export interface BandEquipmentPurchaseResult {
  equipment_id: string;
  band_id: string;
  catalog_item_id: string;
  equipment_name: string;
  brand: string | null;
  price: number;
  band_balance: number;
  condition_rating: number;
  quality_rating: number;
}

interface RpcErrorLike {
  message: string;
}

interface DirectRpcClient {
  rpc: (
    functionName: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: RpcErrorLike | null }>;
}

const directRpcClient = supabase as unknown as DirectRpcClient;

export async function purchaseBandEquipment(
  bandId: string,
  catalogItemId: string,
): Promise<BandEquipmentPurchaseResult> {
  const { data, error } = await directRpcClient.rpc("purchase_band_stage_equipment", {
    p_band_id: bandId,
    p_catalog_item_id: catalogItemId,
  });

  if (error) throw new Error(error.message);
  return data as BandEquipmentPurchaseResult;
}
