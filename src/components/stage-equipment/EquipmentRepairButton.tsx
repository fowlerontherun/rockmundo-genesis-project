import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatEquipmentCurrency as formatCurrency } from "@/features/stage-equipment/catalog";
import { supabase } from "@/integrations/supabase/client";
import { getBandEquipmentRepairCost, type BandEquipmentLiveSetupItem } from "@/utils/liveSetup";

interface RepairableEquipment extends BandEquipmentLiveSetupItem {
  id: string;
  equipment_name?: string | null;
}

interface RepairResult {
  equipment_id: string;
  band_id: string;
  previous_condition: number;
  condition_rating: number;
  repair_cost: number;
  band_balance: number;
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

interface EquipmentRepairButtonProps {
  item: RepairableEquipment;
  bandId: string;
}

export const EquipmentRepairButton = ({ item, bandId }: EquipmentRepairButtonProps) => {
  const queryClient = useQueryClient();
  const repairCost = getBandEquipmentRepairCost(item);

  const repairMutation = useMutation({
    mutationFn: async () => {
      // The live RPC is applied directly in Supabase. Keep a narrow local type
      // until generated database types are refreshed in the repository.
      const { data, error } = await directRpcClient.rpc("repair_band_stage_equipment", {
        p_equipment_id: item.id,
      });
      if (error) throw new Error(error.message);
      return data as RepairResult;
    },
    onSuccess: (result) => {
      toast.success(
        `${item.equipment_name || "Equipment"} repaired to 100/100 for ${formatCurrency(result.repair_cost)}`,
      );
      queryClient.invalidateQueries({ queryKey: ["band-stage-equipment", bandId] });
      queryClient.invalidateQueries({ queryKey: ["band", bandId] });
      queryClient.invalidateQueries({ queryKey: ["live-setup-preview"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to repair equipment");
    },
  });

  if (repairCost <= 0) return null;

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => repairMutation.mutate()}
      disabled={repairMutation.isPending}
      title={`Restore this item to 100 condition for ${formatCurrency(repairCost)} from band funds`}
    >
      {repairMutation.isPending ? (
        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
      ) : (
        <Wrench className="mr-1 h-3 w-3" />
      )}
      Repair {formatCurrency(repairCost)}
    </Button>
  );
};

export default EquipmentRepairButton;
