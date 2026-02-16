import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, Plus } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { toast } from "sonner";

interface FestivalMerchStandProps {
  festivalId: string;
  festivalTitle: string;
  bandId: string;
}

const MERCH_TYPES = [
  { value: "t-shirt", label: "T-Shirt", basePrice: 25 },
  { value: "hoodie", label: "Hoodie", basePrice: 45 },
  { value: "poster", label: "Poster", basePrice: 15 },
  { value: "cap", label: "Cap", basePrice: 20 },
  { value: "patch", label: "Patch", basePrice: 8 },
  { value: "sticker", label: "Sticker Pack", basePrice: 5 },
];

export function FestivalMerchStand({ festivalId, festivalTitle, bandId }: FestivalMerchStandProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [designName, setDesignName] = useState("");
  const [itemType, setItemType] = useState("");
  const [price, setPrice] = useState("");

  const { data: existingMerch = [] } = useQuery({
    queryKey: ["festival-merch", festivalId, bandId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("player_merchandise")
        .select("*")
        .eq("band_id", bandId)
        .contains("metadata", { festival_id: festivalId });
      if (error) throw error;
      return data || [];
    },
  });

  const createMerch = useMutation({
    mutationFn: async () => {
      if (!user?.id || !designName || !itemType) throw new Error("Missing fields");
      const { error } = await (supabase as any)
        .from("player_merchandise")
        .insert({
          user_id: user.id,
          band_id: bandId,
          design_name: `${festivalTitle} - ${designName}`,
          item_type: itemType,
          price: Number(price) || MERCH_TYPES.find(m => m.value === itemType)?.basePrice || 20,
          festival_exclusive: true,
          metadata: { festival_id: festivalId, festival_title: festivalTitle },
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["festival-merch", festivalId, bandId] });
      toast.success("Festival merch created!");
      setDesignName("");
      setItemType("");
      setPrice("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <ShoppingBag className="h-4 w-4" />
        Your Festival Merch
      </div>

      {existingMerch.length > 0 && (
        <div className="space-y-2">
          {existingMerch.map((item: any) => (
            <div key={item.id} className="flex items-center justify-between p-2 rounded bg-muted/50 text-sm">
              <span>{item.design_name}</span>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="capitalize">{item.item_type}</Badge>
                <span className="font-medium">${item.price}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Card className="border-dashed">
        <CardContent className="p-3 space-y-3">
          <p className="text-xs text-muted-foreground font-medium">Create festival-exclusive item</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Design Name</Label>
              <Input value={designName} onChange={e => setDesignName(e.target.value)} placeholder="Summer Vibes" className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={itemType} onValueChange={setItemType}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {MERCH_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label} (${t.basePrice}+)</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label className="text-xs">Price ($)</Label>
              <Input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder={MERCH_TYPES.find(m => m.value === itemType)?.basePrice?.toString() || "20"} className="h-8 text-sm" />
            </div>
            <Button size="sm" onClick={() => createMerch.mutate()} disabled={!designName || !itemType || createMerch.isPending}>
              <Plus className="h-3 w-3 mr-1" /> Create
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
