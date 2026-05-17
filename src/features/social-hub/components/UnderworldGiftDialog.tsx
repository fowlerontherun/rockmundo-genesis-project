import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skull, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUnderworldInventory } from "@/hooks/useUnderworldInventory";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  recipientProfileId: string;
  recipientName: string;
}

export function UnderworldGiftDialog({
  open,
  onOpenChange,
  recipientProfileId,
  recipientName,
}: Props) {
  const queryClient = useQueryClient();
  const { inventoryItems, inventoryLoading } = useUnderworldInventory();
  const [purchaseId, setPurchaseId] = useState<string>("");

  const gift = useMutation({
    mutationFn: async () => {
      if (!purchaseId) throw new Error("Pick an item to gift");
      const { error } = await (supabase as any).rpc("gift_underworld_item", {
        _purchase_id: purchaseId,
        _recipient_profile_id: recipientProfileId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Gift sent to ${recipientName}`);
      queryClient.invalidateQueries({ queryKey: ["underworld-inventory"] });
      setPurchaseId("");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message ?? "Could not gift item"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Skull className="h-5 w-5 text-destructive" /> Gift underworld item
          </DialogTitle>
          <DialogDescription>
            Slip {recipientName} something from your stash. They'll receive it as a gift in their
            inventory.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Item</Label>
            {inventoryLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading inventory…
              </div>
            ) : inventoryItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No giftable items in your underworld inventory.
              </p>
            ) : (
              <Select value={purchaseId} onValueChange={setPurchaseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick something to gift" />
                </SelectTrigger>
                <SelectContent>
                  {inventoryItems.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.product?.name ?? "Unknown item"} × {item.quantity}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Gifting underworld goods may affect both of your reputations.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => gift.mutate()}
            disabled={!purchaseId || gift.isPending}
          >
            {gift.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send gift
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
