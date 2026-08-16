import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useActiveProfile } from "@/hooks/useActiveProfile";

interface OpenShift {
  id: string;
  company_id: string;
  role: string;
  wage_per_hour: number;
  duration_hours: number;
  required_skill: string | null;
  min_skill_level: number;
  slots_total: number;
  slots_filled: number;
  starts_at: string | null;
  companies?: { name: string; company_type: string } | null;
}

export function CompanyShiftMarketplace() {
  const queryClient = useQueryClient();
  const { profileId } = useActiveProfile();

  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ["open-company-shifts"],
    queryFn: async (): Promise<OpenShift[]> => {
      const { data, error } = await (supabase as any)
        .from("company_shifts")
        .select("*, companies:company_id(name, company_type)")
        .eq("status", "open")
        .order("wage_per_hour", { ascending: false })
        .limit(60);
      if (error) throw error;
      return (data ?? []) as OpenShift[];
    },
  });

  const { data: myClaims = [] } = useQuery({
    queryKey: ["my-shift-claims", profileId],
    queryFn: async () => {
      if (!profileId) return [];
      const { data, error } = await (supabase as any)
        .from("company_shift_claims")
        .select("id, shift_id, status")
        .eq("profile_id", profileId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!profileId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["open-company-shifts"] });
    queryClient.invalidateQueries({ queryKey: ["my-shift-claims", profileId] });
  };

  const claim = useMutation({
    mutationFn: async (shiftId: string) => {
      const { error } = await (supabase as any).rpc("claim_company_shift", { p_shift_id: shiftId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Shift claimed");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Could not claim shift"),
  });

  const complete = useMutation({
    mutationFn: async (claimId: string) => {
      const { error } = await (supabase as any).rpc("complete_company_shift", { p_claim_id: claimId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Shift completed and paid");
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not complete shift"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4" /> Player-run company shifts
        </CardTitle>
        <CardDescription>
          Casual paid shifts published by player businesses. No contract needed — claim, work, get paid.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <Skeleton className="h-14 w-full" />
        ) : shifts.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No open shifts right now. New shifts are published every morning.
          </p>
        ) : (
          shifts.map((s) => {
            const myClaim = (myClaims as any[]).find((c) => c.shift_id === s.id);
            const pay = Number(s.wage_per_hour) * s.duration_hours;
            return (
              <div key={s.id} className="flex items-center justify-between gap-3 rounded-lg border p-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{s.companies?.name ?? "Company"}</p>
                  <p className="text-[11px] capitalize text-muted-foreground">
                    {s.role.replace(/_/g, " ")} • {s.duration_hours}h • ${pay.toLocaleString()}
                    {s.starts_at ? ` • ${format(new Date(s.starts_at), "d MMM HH:mm")}` : ""}
                  </p>
                  {s.required_skill && (
                    <p className="text-[11px] text-muted-foreground">
                      Requires {s.required_skill} level {s.min_skill_level}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    {s.slots_filled}/{s.slots_total}
                  </Badge>
                  {myClaim?.status === "claimed" ? (
                    <Button size="sm" onClick={() => complete.mutate(myClaim.id)} disabled={complete.isPending}>
                      Complete
                    </Button>
                  ) : myClaim ? (
                    <Badge className="text-[10px]">{myClaim.status}</Badge>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => claim.mutate(s.id)} disabled={claim.isPending}>
                      Claim
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
