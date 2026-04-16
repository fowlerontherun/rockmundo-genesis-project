import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Guitar, Zap, Shirt, Cpu, Radio, Car, Star } from "lucide-react";

const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const iconMap: Record<string, typeof Star> = {
  Guitar, Zap, Shirt, Cpu, Radio, Car,
};

interface SponsorshipType {
  id: string;
  name: string;
  category: string;
  fame_multiplier: number;
  streaming_bonus_pct: number;
  merch_discount_pct: number;
  gig_pay_bonus_pct: number;
  tour_cost_reduction_pct: number;
  description: string | null;
  icon_name: string;
}

export const SponsorshipTypesPanel = () => {
  const { data: types = [] } = useQuery({
    queryKey: ["sponsorship-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sponsorship_types")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as SponsorshipType[];
    },
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {types.map((type) => {
          const Icon = iconMap[type.icon_name] || Star;
          const bonuses = [
            type.fame_multiplier > 1 && `Fame ×${type.fame_multiplier}`,
            type.streaming_bonus_pct > 0 && `Streaming +${type.streaming_bonus_pct}%`,
            type.merch_discount_pct > 0 && `Merch -${type.merch_discount_pct}%`,
            type.gig_pay_bonus_pct > 0 && `Gig Pay +${type.gig_pay_bonus_pct}%`,
            type.tour_cost_reduction_pct > 0 && `Tour Cost -${type.tour_cost_reduction_pct}%`,
          ].filter(Boolean) as string[];

          return (
            <Card key={type.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{type.name}</CardTitle>
                    <CardDescription className="text-xs capitalize">{type.category}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground line-clamp-2">{type.description}</p>
                <div className="flex flex-wrap gap-1">
                  {bonuses.map((b) => (
                    <Badge key={b} variant="secondary" className="text-xs">
                      {b}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {types.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">Loading sponsorship types…</p>
      )}
    </div>
  );
};
