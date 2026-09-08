import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShoppingBag, Store, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MerchDesignPreview } from "@/components/merchandise/MerchDesignPreview";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { toast } from "sonner";

interface FestivalMerchStandProps {
  festivalId: string;
  festivalTitle: string;
  bandId: string;
}

type MerchRow = Record<string, any> & {
  id: string;
  design_name: string;
  item_type: string;
  selling_price?: number | null;
  stock_quantity?: number | null;
  pending_quantity?: number | null;
  drop_starts_at?: string | null;
  available_until?: string | null;
};

type Assignment = {
  id: string;
  merchandise_id: string;
};

export function FestivalMerchStand({ festivalId, festivalTitle, bandId }: FestivalMerchStandProps) {
  const queryClient = useQueryClient();
  const { profileId } = useActiveProfile();
  const [selectedMerchId, setSelectedMerchId] = useState("");

  const { data: bandMerch = [], isLoading: merchLoading } = useQuery<MerchRow[]>({
    queryKey: ["festival-merch-inventory", bandId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("player_merchandise")
        .select("*")
        .eq("band_id", bandId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: Boolean(bandId),
  });

  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery<Assignment[]>({
    queryKey: ["festival-merch-assignments", festivalId, bandId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("festival_merch_assignments")
        .select("id, merchandise_id")
        .eq("festival_id", festivalId)
        .eq("band_id", bandId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: Boolean(festivalId && bandId),
  });

  const assignedIds = useMemo(() => new Set(assignments.map((assignment) => assignment.merchandise_id)), [assignments]);
  const festivalMerch = useMemo(() => bandMerch.filter((item) => assignedIds.has(item.id)), [bandMerch, assignedIds]);

  const availableMerch = useMemo(() => {
    const now = Date.now();
    return bandMerch.filter((item) => {
      if (assignedIds.has(item.id)) return false;
      if (item.drop_starts_at && new Date(item.drop_starts_at).getTime() > now) return false;
      if (item.available_until && new Date(item.available_until).getTime() < now) return false;
      return Number(item.stock_quantity ?? 0) > 0 || Number(item.pending_quantity ?? 0) > 0;
    });
  }, [bandMerch, assignedIds]);

  const selected = availableMerch.find((item) => item.id === selectedMerchId) ?? null;
  const isLoading = merchLoading || assignmentsLoading;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["festival-merch-assignments", festivalId, bandId] });
    queryClient.invalidateQueries({ queryKey: ["festival-shop", festivalId] });
  };

  const addToFestival = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Choose a manufactured merchandise item first.");
      const { error } = await (supabase as any)
        .from("festival_merch_assignments")
        .insert({
          festival_id: festivalId,
          band_id: bandId,
          merchandise_id: selected.id,
          created_by_profile_id: profileId ?? null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${selected?.design_name ?? "Merchandise"} added to ${festivalTitle}`);
      setSelectedMerchId("");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeFromFestival = useMutation({
    mutationFn: async (item: MerchRow) => {
      const assignment = assignments.find((entry) => entry.merchandise_id === item.id);
      if (!assignment) throw new Error("Festival merchandise assignment not found.");
      const { error } = await (supabase as any)
        .from("festival_merch_assignments")
        .delete()
        .eq("id", assignment.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Merchandise removed from the festival stand");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <ShoppingBag className="h-4 w-4" />
        Festival Merchandise
      </div>

      <p className="text-xs text-muted-foreground">
        Festival stands use your real manufactured band merchandise. Assigning a product here does not create or duplicate stock.
      </p>

      {festivalMerch.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {festivalMerch.map((item) => (
            <Card key={item.id} className="overflow-hidden">
              <div className="aspect-[4/3] bg-muted/20 p-2">
                <MerchDesignPreview design={item} className="rounded-md" />
              </div>
              <CardContent className="space-y-2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{item.design_name}</p>
                    <p className="text-xs text-muted-foreground">{item.item_type}</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold">${Number(item.selling_price ?? 0).toFixed(2)}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline">{Number(item.stock_quantity ?? 0)} sellable</Badge>
                  {Number(item.pending_quantity ?? 0) > 0 ? <Badge>{Number(item.pending_quantity)} in production</Badge> : null}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => removeFromFestival.mutate(item)}
                  disabled={removeFromFestival.isPending}
                >
                  <X className="mr-1.5 h-3.5 w-3.5" /> Remove from stand
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-5 text-center text-xs text-muted-foreground">
          No merchandise is assigned to this festival yet.
        </div>
      )}

      <Card className="border-dashed">
        <CardContent className="space-y-3 p-4">
          <div>
            <p className="text-sm font-medium">Add existing merchandise</p>
            <p className="text-xs text-muted-foreground">Choose real inventory or an active production run. The same stock remains authoritative everywhere.</p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Band merchandise</Label>
            <Select value={selectedMerchId} onValueChange={setSelectedMerchId} disabled={isLoading || !availableMerch.length}>
              <SelectTrigger><SelectValue placeholder={isLoading ? "Loading merchandise..." : availableMerch.length ? "Choose merchandise" : "No eligible merchandise"} /></SelectTrigger>
              <SelectContent>
                {availableMerch.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.design_name} · {item.item_type} · {Number(item.stock_quantity ?? 0)} in stock
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selected ? (
            <div className="grid gap-3 rounded-lg border bg-muted/20 p-3 sm:grid-cols-[120px_1fr]">
              <div className="aspect-square overflow-hidden rounded-md bg-background">
                <MerchDesignPreview design={selected} />
              </div>
              <div className="space-y-1 text-xs">
                <p className="text-sm font-semibold">{selected.design_name}</p>
                <p className="text-muted-foreground">{selected.item_type}</p>
                <p>{Number(selected.stock_quantity ?? 0)} sellable · {Number(selected.pending_quantity ?? 0)} in production</p>
                <p>${Number(selected.selling_price ?? 0).toFixed(2)} retail</p>
              </div>
            </div>
          ) : null}

          <Button className="w-full" onClick={() => addToFestival.mutate()} disabled={!selected || addToFestival.isPending}>
            <Store className="mr-2 h-4 w-4" />
            {addToFestival.isPending ? "Adding to stand..." : "Add to festival stand"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
