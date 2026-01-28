import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Building2, 
  DollarSign, 
  Settings, 
  AlertTriangle, 
  Users,
  MapPin,
  TrendingUp,
  Banknote
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LabelFinanceDialog } from "./LabelFinanceDialog";

interface MyLabel {
  id: string;
  name: string;
  logo_url: string | null;
  balance: number;
  is_bankrupt: boolean;
  balance_went_negative_at: string | null;
  headquarters_city: string | null;
  reputation_score: number | null;
  roster_slot_capacity: number | null;
  artist_label_contracts: { id: string; status: string }[];
}

export function MyLabelsTab() {
  const { user } = useAuth();
  const [selectedLabel, setSelectedLabel] = useState<{ id: string; name: string } | null>(null);

  const { data: myLabels = [], isLoading } = useQuery<MyLabel[]>({
    queryKey: ["my-labels", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      // First get user's profile ID
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user!.id)
        .single();

      if (!profile) return [];

      // Get labels where:
      // 1. owner_id = profile.id (directly owned)
      // 2. OR company.owner_id = user_id (owned via company subsidiary)
      const { data, error } = await supabase
        .from("labels")
        .select(`
          id,
          name,
          logo_url,
          balance,
          is_bankrupt,
          balance_went_negative_at,
          headquarters_city,
          reputation_score,
          roster_slot_capacity,
          artist_label_contracts(id, status),
          companies!labels_company_id_fkey(owner_id)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Filter to show labels where user is direct owner OR owns the parent company
      const filteredLabels = (data || []).filter((label: any) => {
        const isDirectOwner = label.owner_id === profile.id;
        const ownsParentCompany = label.companies?.owner_id === user!.id;
        return isDirectOwner || ownsParentCompany;
      });
      
      return filteredLabels as MyLabel[];
    },
  });

  const getBalanceStatus = (balance: number, isBankrupt: boolean, negativeAt: string | null) => {
    if (isBankrupt) return { color: "text-destructive", bg: "bg-destructive/10", label: "BANKRUPT" };
    if (balance < 0) {
      const daysNegative = negativeAt 
        ? Math.floor((Date.now() - new Date(negativeAt).getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      return { 
        color: "text-destructive", 
        bg: "bg-destructive/10", 
        label: `Critical (${5 - daysNegative}d)` 
      };
    }
    if (balance < 100_000) return { color: "text-amber-500", bg: "bg-amber-500/10", label: "Low" };
    if (balance < 500_000) return { color: "text-yellow-500", bg: "bg-yellow-500/10", label: "Moderate" };
    return { color: "text-emerald-500", bg: "bg-emerald-500/10", label: "Healthy" };
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Loading your labels...
        </CardContent>
      </Card>
    );
  }

  if (myLabels.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center space-y-2">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground" />
          <h3 className="text-lg font-semibold">No Labels Yet</h3>
          <p className="text-sm text-muted-foreground">
            You haven't created any labels. Use the "Launch new label" button to get started!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        {myLabels.map((label) => {
          const activeContracts = label.artist_label_contracts?.filter(
            (c) => c.status !== "terminated"
          ).length ?? 0;
          const status = getBalanceStatus(label.balance, label.is_bankrupt, label.balance_went_negative_at);

          return (
            <Card key={label.id} className={cn(label.is_bankrupt && "border-destructive")}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12 border">
                    <AvatarImage src={label.logo_url || undefined} />
                    <AvatarFallback>
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{label.name}</CardTitle>
                      {label.is_bankrupt && (
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                      )}
                    </div>
                    {label.headquarters_city && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {label.headquarters_city}
                      </div>
                    )}
                  </div>
                  <Badge className={cn(status.bg, status.color, "border-0")}>
                    {status.label}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="flex items-center justify-center gap-1 text-muted-foreground">
                      <Banknote className="h-4 w-4" />
                    </div>
                    <p className={cn("text-lg font-bold", status.color)}>
                      ${(label.balance / 1000).toFixed(0)}k
                    </p>
                    <p className="text-xs text-muted-foreground">Balance</p>
                  </div>
                  <div>
                    <div className="flex items-center justify-center gap-1 text-muted-foreground">
                      <Users className="h-4 w-4" />
                    </div>
                    <p className="text-lg font-bold">
                      {activeContracts}/{label.roster_slot_capacity ?? 5}
                    </p>
                    <p className="text-xs text-muted-foreground">Roster</p>
                  </div>
                  <div>
                    <div className="flex items-center justify-center gap-1 text-muted-foreground">
                      <TrendingUp className="h-4 w-4" />
                    </div>
                    <p className="text-lg font-bold">{label.reputation_score ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Reputation</p>
                  </div>
                </div>
              </CardContent>

              <CardFooter>
                <Button 
                  className="w-full" 
                  onClick={() => setSelectedLabel({ id: label.id, name: label.name })}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Manage Label
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {selectedLabel && (
        <LabelFinanceDialog
          open={!!selectedLabel}
          onOpenChange={(open) => !open && setSelectedLabel(null)}
          labelId={selectedLabel.id}
          labelName={selectedLabel.name}
        />
      )}
    </>
  );
}