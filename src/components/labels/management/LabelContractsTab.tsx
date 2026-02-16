import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  FileText, Calendar, DollarSign, Globe2, ShieldCheck,
  XCircle, Eye, EyeOff, CheckCircle2, Loader2, AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

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
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  const withdrawMutation = useMutation({
    mutationFn: async (contractId: string) => {
      const { error } = await supabase
        .from("artist_label_contracts")
        .update({ status: "terminated", terminated_at: new Date().toISOString() })
        .eq("id", contractId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["label-all-contracts", labelId] });
      queryClient.invalidateQueries({ queryKey: ["label-pending-contract-count", labelId] });
      toast.success("Offer withdrawn");
    },
    onError: () => toast.error("Failed to withdraw offer"),
  });

  const activateMutation = useMutation({
    mutationFn: async (contractId: string) => {
      const startDate = new Date();
      const contract = contracts.find(c => c.id === contractId);
      const termMonths = contract?.end_date && contract?.start_date
        ? Math.round((new Date(contract.end_date).getTime() - new Date(contract.start_date).getTime()) / (1000 * 60 * 60 * 24 * 30))
        : 24;
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + termMonths);

      const { error } = await supabase
        .from("artist_label_contracts")
        .update({
          status: "active",
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
        })
        .eq("id", contractId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["label-all-contracts", labelId] });
      queryClient.invalidateQueries({ queryKey: ["label-pending-contract-count", labelId] });
      queryClient.invalidateQueries({ queryKey: ["label-roster-contracts", labelId] });
      toast.success("Contract activated!");
    },
    onError: () => toast.error("Failed to activate contract"),
  });

  const rejectMutation = useMutation({
    mutationFn: async (contractId: string) => {
      const { error } = await supabase
        .from("artist_label_contracts")
        .update({ status: "rejected" })
        .eq("id", contractId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["label-all-contracts", labelId] });
      queryClient.invalidateQueries({ queryKey: ["label-pending-contract-count", labelId] });
      toast.success("Contract rejected");
    },
    onError: () => toast.error("Failed to reject contract"),
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
          <p className="text-sm text-muted-foreground">Accept demo submissions or scout bands to create contracts</p>
        </CardContent>
      </Card>
    );
  }

  // Status summary badges
  const statusCounts: Record<string, number> = {};
  contracts.forEach((c) => {
    const s = c.status ?? "unknown";
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  });

  return (
    <div className="space-y-4">
      {/* Status summary */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(statusCounts).map(([status, count]) => (
          <Badge key={status} variant="outline" className={STATUS_COLORS[status] || ""}>
            {status}: {count}
          </Badge>
        ))}
      </div>

      {contracts.map((contract) => {
        const band = contract.bands as any;
        const dealType = contract.label_deal_types as any;
        const advanceAmount = contract.advance_amount ?? 0;
        const recouped = contract.recouped_amount ?? 0;
        const recoupPct = advanceAmount > 0 ? Math.min((recouped / advanceAmount) * 100, 100) : 100;
        const statusClass = STATUS_COLORS[contract.status ?? ""] || STATUS_COLORS.offered;
        const isExpanded = expandedId === contract.id;
        const singlesCompleted = contract.singles_completed ?? 0;
        const albumsCompleted = contract.albums_completed ?? 0;

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
                <div className="flex items-center gap-2">
                  <Badge className={`${statusClass} border-0`}>
                    {contract.status}
                  </Badge>
                </div>
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

              {/* Action buttons by status */}
              <div className="flex flex-wrap gap-2 mt-3">
                {contract.status === "offered" && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive"
                      onClick={() => withdrawMutation.mutate(contract.id)}
                      disabled={withdrawMutation.isPending}
                    >
                      {withdrawMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                      Withdraw Offer
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => activateMutation.mutate(contract.id)}
                      disabled={activateMutation.isPending}
                    >
                      {activateMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                      Activate Contract
                    </Button>
                  </>
                )}

                {contract.status === "active" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setExpandedId(isExpanded ? null : contract.id)}
                  >
                    {isExpanded ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                    {isExpanded ? "Hide Details" : "View Details"}
                  </Button>
                )}
              </div>

              {/* Expanded details for active contracts */}
              {contract.status === "active" && isExpanded && (
                <div className="mt-4 p-3 bg-muted/30 rounded-lg space-y-3">
                  {/* Release progress */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Singles Progress</p>
                      <p className="font-semibold">{singlesCompleted} / {contract.single_quota ?? 0} delivered</p>
                      <Progress value={contract.single_quota ? (singlesCompleted / contract.single_quota) * 100 : 100} className="h-1.5 mt-1" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Albums Progress</p>
                      <p className="font-semibold">{albumsCompleted} / {contract.album_quota ?? 0} delivered</p>
                      <Progress value={contract.album_quota ? (albumsCompleted / contract.album_quota) * 100 : 100} className="h-1.5 mt-1" />
                    </div>
                  </div>

                  {/* Recoupment */}
                  {advanceAmount > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Recoupment</span>
                        <span>${recouped.toLocaleString()} / ${advanceAmount.toLocaleString()}</span>
                      </div>
                      <Progress value={recoupPct} className="h-1.5" />
                    </div>
                  )}

                  {/* Extra details */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Termination Fee:</span>{" "}
                      <span className="font-medium">{contract.termination_fee_pct ?? 0}%</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Manufacturing:</span>{" "}
                      <span className="font-medium">{contract.manufacturing_covered ? "Covered" : "Not covered"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Contract Value:</span>{" "}
                      <span className="font-medium">${(contract.contract_value ?? 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Recoupment bar for active (non-expanded) */}
              {contract.status === "active" && advanceAmount > 0 && !isExpanded && (
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
