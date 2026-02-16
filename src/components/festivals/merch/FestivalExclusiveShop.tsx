import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Check } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { toast } from "sonner";

interface FestivalExclusiveShopProps {
  festivalId: string;
  festivalTitle: string;
  location: string | null;
}

const COLLECTIBLES = [
  { id: "wristband", name: "Festival Wristband", emoji: "🎗️", price: 10, description: "Commemorative woven wristband" },
  { id: "poster", name: "Commemorative Poster", emoji: "🖼️", price: 25, description: "Limited edition art print" },
  { id: "tshirt", name: "Festival T-Shirt", emoji: "👕", price: 35, description: "Exclusive event tee" },
  { id: "pin", name: "Enamel Pin", emoji: "📌", price: 8, description: "Collector's enamel pin badge" },
];

export function FestivalExclusiveShop({ festivalId, festivalTitle, location }: FestivalExclusiveShopProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [purchased, setPurchased] = useState<Set<string>>(new Set());

  const { data: profile } = useQuery({
    queryKey: ["profile-cash", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase.from("profiles").select("cash").eq("user_id", user.id).single();
      return data;
    },
    enabled: !!user?.id,
  });

  const buyItem = useMutation({
    mutationFn: async (item: typeof COLLECTIBLES[0]) => {
      if (!user?.id) throw new Error("Not authenticated");
      if (!profile || profile.cash < item.price) throw new Error("Not enough cash");

      await supabase.from("profiles").update({ cash: profile.cash - item.price }).eq("user_id", user.id);

      // Log as activity
      await (supabase as any).from("activity_feed").insert({
        user_id: user.id,
        activity_type: "festival_purchase",
        message: `Bought ${item.name} at ${festivalTitle}`,
        earnings: -item.price,
        metadata: { festival_id: festivalId, item_id: item.id, item_name: item.name },
      });

      return item.id;
    },
    onSuccess: (itemId) => {
      setPurchased(prev => new Set([...prev, itemId]));
      queryClient.invalidateQueries({ queryKey: ["profile-cash"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Item purchased!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cash = profile?.cash ?? 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <ShoppingCart className="h-4 w-4" />
          Festival Shop
        </div>
        <Badge variant="outline" className="text-xs">Balance: ${cash.toLocaleString()}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {COLLECTIBLES.map(item => {
          const owned = purchased.has(item.id);
          return (
            <Card key={item.id} className={`border-dashed ${owned ? "opacity-60" : ""}`}>
              <CardContent className="p-3 text-center space-y-1.5">
                <span className="text-2xl">{item.emoji}</span>
                <p className="text-sm font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.description}</p>
                <p className="font-bold text-sm">${item.price}</p>
                <Button
                  size="sm"
                  variant={owned ? "secondary" : "default"}
                  className="w-full text-xs"
                  disabled={owned || cash < item.price || buyItem.isPending}
                  onClick={() => buyItem.mutate(item)}
                >
                  {owned ? <><Check className="h-3 w-3 mr-1" /> Owned</> : "Buy"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
