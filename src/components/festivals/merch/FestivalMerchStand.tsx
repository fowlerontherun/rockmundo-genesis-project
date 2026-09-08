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
  festival_exclusive?: boolean | null;
  metadata?: Record<string, any> | null;
};

const festivalIdsFor = (item: MerchRow) => {
  const metadata = item.metadata ?? {};
  const ids = Array.isArray(metadata.festival_ids) ? metadata.festival_ids.filter(Boolean) : [];
  if (metadata.festival_id) ids.push(metadata.festival_id);
  return Array.from(new Set(ids.map(String)));
};

export function FestivalMerchStand({ festivalId, festivalTitle, bandId }: FestivalMerchStandProps) {
  const queryClient = useQueryClient();
  const [selectedMerchId, setSelectedMerchId] = useState("");

  const { data: bandMerch = [], isLoading } = useQuery<MerchRow[]>({
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

  const festivalMerch = useMemo(
    () => bandMerch.filter((item) => festivalIdsFor(item).includes(festivalId)),
    [bandMerch, festivalId],
  );

  const availableMerch = useMemo(() => {
    const now = Date.now();
    return bandMerch.filter((item) => {
      if (festivalIdsFor(item).includes(festivalId)) return false;
      if (item.sale_end_date && new Date(item.sale_end_date).getTime() < now) return false;
      return Number(item.stock_quantity ?? 0) > 0 || Number(item.pending_quantity ?? 0) > 0;
    });
  }, [bandMerch, festivalId]);

  const selected = availableMerch.find((item) => item.id === selectedMerchId) ?? null;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["festival-merch-inventory", bandId] });
    queryClient.invalidateQueries({ queryKey: ["player-merchandise", bandId] });
  };

  const addToFestival = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Choose a manufactured merchandise item first.");
      const metadata = { ...(selected.metadata ?? {}) };
      const festivalIds = Array.from(new Set([...festivalIdsFor(selected), festivalId]));
      delete metadata.festival_id;
      delete metadata.festival_title;
      metadata.festival_ids = festivalIds;
      metadata.festival_titles = { ...(metadata.festival_titles ?? {}), [festivalId]: festivalTitle };

      const { error } = await (supabase as any)
        .from("player_merchandise")
        .update({ festival_exclusive: true, metadata })
        .eq("id", selected.id)
        .eq("band_id", bandId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Merchandise added to the festival stand");
      setSelectedMerchId("");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeFromFestival = useMutation({
    mutationFn: async (item: MerchRow) => {
      const metadata = { ...(item.metadata ?? {}) };
      const remainingIds = festivalIdsFor(item).filter((id) => id !== festivalId);
      const titles = { ...(metadata.festival_titles ?? {}) };
      delete titles[festivalId];
      delete metadata.festival_id;
      delete metadata.festival_title;
      if (remainingIds.length) metadata.festival_ids = remainingIds;
      else delete metadata.festival_ids;
      if (Object.keys(titles).length) metadata.festival_titles = titles;
      else delete metadata.festival_titles;

      const { error } = await (supabase as any)
        .from("player_merchandise")
        .update({ festival_exclusive: remainingIds.length > 0, metadata })
        .eq("id", item.id)
        .eq("band_id", bandId);
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
        Festival stands now use your real band merchandise. Design products in Merch Studio and manufacture stock before assigning them here.
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
            <p className="text-xs text-muted-foreground">Only real inventory or an active production run can be assigned. This does not create free stock.</p>
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
