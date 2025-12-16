import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/use-auth-context";
import { ContractNegotiationDialog } from "./ContractNegotiationDialog";
import { useState } from "react";
import { FileText, Building2, DollarSign, Percent, Clock, AlertCircle, CheckCircle } from "lucide-react";
import { formatDistanceToNow, parseISO, isPast } from "date-fns";

export const MyContractsList = () => {
  const { user } = useAuth();
  const [selectedContract, setSelectedContract] = useState<any>(null);

  const { data: contracts, isLoading } = useQuery({
    queryKey: ["my-contracts", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Get profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!profile) return [];

      // Get contracts for this artist or their bands
      const { data: bandMembers } = await supabase
        .from("band_members")
        .select("band_id")
        .eq("user_id", user.id);

      const bandIds = bandMembers?.map(bm => bm.band_id) || [];

      const { data, error } = await supabase
        .from("artist_label_contracts")
        .select(`
          *,
          label:labels(name, reputation_score),
          deal_type:label_deal_types(name, description)
        `)
        .or(`artist_profile_id.eq.${profile.id}${bandIds.length ? `,band_id.in.(${bandIds.join(",")})` : ""}`)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500">Active</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500">Pending</Badge>;
      case "negotiating":
        return <Badge className="bg-blue-500">Negotiating</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      case "expired":
        return <Badge variant="secondary">Expired</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map(i => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="animate-pulse h-24 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!contracts?.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="font-semibold mb-2">No Contracts Yet</h3>
          <p className="text-muted-foreground text-sm">
            Browse labels and apply for contracts to get started!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {contracts.map((contract) => {
          const isExpired = isPast(parseISO(contract.end_date));
          const releasesProgress = ((contract.releases_completed || 0) / contract.release_quota) * 100;
          const recoupProgress = contract.advance_amount 
            ? ((contract.recouped_amount || 0) / contract.advance_amount) * 100 
            : 100;

          return (
            <Card key={contract.id} className={isExpired ? "opacity-60" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-base">{contract.label?.name}</CardTitle>
                  </div>
                  {getStatusBadge(contract.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Key Terms */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <DollarSign className="h-3 w-3" /> Advance
                    </span>
                    <p className="font-medium">{formatCurrency(contract.advance_amount || 0)}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Percent className="h-3 w-3" /> Your Split
                    </span>
                    <p className="font-medium">{contract.royalty_artist_pct}%</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Duration
                    </span>
                    <p className="font-medium">
                      {formatDistanceToNow(parseISO(contract.end_date), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">Deal Type</span>
                    <p className="font-medium">{contract.deal_type?.name || "Standard"}</p>
                  </div>
                </div>

                {/* Progress Bars */}
                {contract.status === "active" && (
                  <div className="space-y-3">
                    {/* Releases Progress */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Releases</span>
                        <span>{contract.releases_completed || 0}/{contract.release_quota}</span>
                      </div>
                      <Progress value={releasesProgress} className="h-1.5" />
                    </div>

                    {/* Recoup Progress */}
                    {contract.advance_amount > 0 && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground flex items-center gap-1">
                            {recoupProgress >= 100 ? (
                              <><CheckCircle className="h-3 w-3 text-green-500" /> Recouped</>
                            ) : (
                              <><AlertCircle className="h-3 w-3 text-yellow-500" /> Recouping</>
                            )}
                          </span>
                          <span>{formatCurrency(contract.recouped_amount || 0)}/{formatCurrency(contract.advance_amount)}</span>
                        </div>
                        <Progress value={Math.min(100, recoupProgress)} className="h-1.5" />
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                {(contract.status === "pending" || contract.status === "negotiating") && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedContract(contract)}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    {contract.status === "negotiating" ? "Continue Negotiation" : "Review Contract"}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <ContractNegotiationDialog
        open={!!selectedContract}
        onOpenChange={(open) => !open && setSelectedContract(null)}
        contract={selectedContract}
      />
    </>
  );
};
