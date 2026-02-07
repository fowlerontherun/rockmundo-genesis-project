import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { FileText, Calendar, DollarSign, Globe2, ShieldCheck } from "lucide-react";
import { format } from "date-fns";

interface LabelContractsTabProps {
  labelId: string;
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500/20 text-emerald-500",
  offered: "bg-amber-500/20 text-amber-500",
  completed: "bg-blue-500/20 text-blue-500",
  terminated: "bg-destructive/20 text-destructive",
  rejected: "bg-muted text-muted-foreground",
};

export function LabelContractsTab({ labelId }: LabelContractsTabProps) {
  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ["label-all-contracts", labelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("artist_label_contracts")
        .select(`
          *,
          bands:band_id(id, name, genre),
          label_deal_types:deal_type_id(name),
          label_releases(id)
        `)
        .eq("label_id", labelId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) {
    return <Card><CardContent className="p-6 text-center text-muted-foreground">Loading contracts...</CardContent></Card>;
  }

  if (contracts.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">No contracts yet</p>
          <p className="text-sm text-muted-foreground">Accept demo submissions to create contracts</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {contracts.map((contract) => {
        const band = contract.bands as any;
        const dealType = contract.label_deal_types as any;
        const advanceAmount = contract.advance_amount ?? 0;
        const recouped = contract.recouped_amount ?? 0;
        const recoupPct = advanceAmount > 0 ? Math.min((recouped / advanceAmount) * 100, 100) : 100;
        const statusClass = STATUS_COLORS[contract.status ?? ""] || STATUS_COLORS.offered;

        return (
          <Card key={contract.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-lg">{band?.name || "Unknown Artist"}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {dealType?.name && <span>{dealType.name}</span>}
                    <span>·</span>
                    <span>{band?.genre || "Various"}</span>
                  </div>
                </div>
                <Badge className={`${statusClass} border-0`}>
                  {contract.status}
                </Badge>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <DollarSign className="h-3 w-3" /> Advance
                  </div>
                  <p className="font-semibold">${advanceAmount.toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <ShieldCheck className="h-3 w-3" /> Royalty Split
                  </div>
                  <p className="font-semibold">{contract.royalty_artist_pct}% / {contract.royalty_label_pct ?? (100 - contract.royalty_artist_pct)}%</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" /> Term
                  </div>
                  <p className="text-sm">
                    {contract.start_date ? format(new Date(contract.start_date), "MMM yyyy") : "TBD"} – {contract.end_date ? format(new Date(contract.end_date), "MMM yyyy") : "TBD"}
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Globe2 className="h-3 w-3" /> Releases
                  </div>
                  <p className="font-semibold">{contract.label_releases?.length ?? 0} total</p>
                </div>
              </div>

              {contract.status === "active" && advanceAmount > 0 && (
                <div className="mt-3 space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Recoupment</span>
                    <span>${recouped.toLocaleString()} / ${advanceAmount.toLocaleString()}</span>
                  </div>
                  <Progress value={recoupPct} className="h-1.5" />
                </div>
              )}

              {contract.territories && contract.territories.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {contract.territories.map((t: string) => (
                    <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
