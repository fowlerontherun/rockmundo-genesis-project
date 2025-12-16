import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Briefcase, Handshake } from "lucide-react";
import { format } from "date-fns";

export function DealAnnouncements() {
  const today = new Date().toISOString().split('T')[0];

  const { data: deals } = useQuery({
    queryKey: ["deal-announcements", today],
    queryFn: async () => {
      const results: Array<{ type: string; title: string; detail: string; time: string }> = [];

      // Record label signings
      const { data: contracts } = await supabase
        .from("artist_label_contracts")
        .select("created_at, status, bands(name), labels(name)")
        .eq("status", "active")
        .gte("created_at", `${today}T00:00:00`)
        .order("created_at", { ascending: false })
        .limit(5);

      contracts?.forEach((contract: any) => {
        if (contract.bands && contract.labels) {
          results.push({
            type: "contract",
            title: `${contract.bands.name} signed with ${contract.labels.name}`,
            detail: "New record deal",
            time: format(new Date(contract.created_at), "HH:mm"),
          });
        }
      });

      // Note: Sponsorship data would come from band_sponsorships if it exists

      return results.slice(0, 6);
    },
  });

  const getIcon = (type: string) => {
    switch (type) {
      case "contract": return <FileText className="h-4 w-4 text-blue-500" />;
      case "sponsorship": return <Briefcase className="h-4 w-4 text-green-500" />;
      default: return <Handshake className="h-4 w-4 text-purple-500" />;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Handshake className="h-5 w-5" />
          Business Deals
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {deals && deals.length > 0 ? (
          deals.map((deal, index) => (
            <div key={index} className="flex items-start gap-2 py-1">
              {getIcon(deal.type)}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{deal.title}</p>
                <p className="text-xs text-muted-foreground">{deal.detail}</p>
              </div>
              <Badge variant="outline" className="shrink-0">{deal.time}</Badge>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground py-2">No deals announced today</p>
        )}
      </CardContent>
    </Card>
  );
}
