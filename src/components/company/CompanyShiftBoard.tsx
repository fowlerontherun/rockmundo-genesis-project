import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, Plus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useActiveProfile } from "@/hooks/useActiveProfile";

interface ShiftRow {
  id: string;
  company_id: string;
  role: string;
  description: string | null;
  wage_per_hour: number;
  duration_hours: number;
  required_skill: string | null;
  min_skill_level: number;
  slots_total: number;
  slots_filled: number;
  status: string;
  starts_at: string | null;
  expires_at: string | null;
}

export function CompanyShiftBoard({ companyId, isOwner }: { companyId: string; isOwner: boolean }) {
  const queryClient = useQueryClient();
  const { profileId } = useActiveProfile();

  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ["company-shifts", companyId],
    queryFn: async (): Promise<ShiftRow[]> => {
      const { data, error } = await (supabase as any)
        .from("company_shifts")
        .select("*")
        .eq("company_id", companyId)
        .in("status", ["open", "full"])
        .order("starts_at", { ascending: true })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as ShiftRow[];
    },
    enabled: !!companyId,
  });

  const { data: myClaims = [] } = useQuery({
    queryKey: ["company-shift-claims", companyId, profileId],
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
    queryClient.invalidateQueries({ queryKey: ["company-shifts", companyId] });
    queryClient.invalidateQueries({ queryKey: ["company-shift-claims", companyId, profileId] });
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

  const createShift = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("company_shifts").insert({
        company_id: companyId,
        role: "staff",
        description: "Owner-created shift",
        wage_per_hour: 30,
        duration_hours: 4,
        slots_total: 1,
        status: "open",
        starts_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        expires_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Shift published");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Could not create shift"),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" /> Shift board
          </CardTitle>
          <CardDescription>
            Open shifts are generated daily for every business type. Complete a shift to be paid from company funds.
          </CardDescription>
        </div>
        {isOwner && (
          <Button size="sm" variant="outline" onClick={() => createShift.mutate()} disabled={createShift.isPending}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add shift
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <Skeleton className="h-14 w-full" />
        ) : shifts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No open shifts right now. New shifts are published each morning.
          </p>
        ) : (
          shifts.map((s) => {
            const myClaim = (myClaims as any[]).find((c) => c.shift_id === s.id);
            const pay = Number(s.wage_per_hour) * s.duration_hours;
            return (
              <div key={s.id} className="flex items-center justify-between gap-3 rounded-lg border p-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium capitalize truncate">{s.role.replace(/_/g, " ")}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {s.duration_hours}h • ${pay.toLocaleString()} total • {s.slots_filled}/{s.slots_total} filled
                    {s.starts_at ? ` • ${format(new Date(s.starts_at), "d MMM HH:mm")}` : ""}
                  </p>
                  {s.required_skill && (
                    <p className="text-[11px] text-muted-foreground">
                      Requires {s.required_skill} level {s.min_skill_level}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="text-[10px]">
                    {s.status}
                  </Badge>
                  {myClaim?.status === "claimed" ? (
                    <Button size="sm" onClick={() => complete.mutate(myClaim.id)} disabled={complete.isPending}>
                      Complete
                    </Button>
                  ) : myClaim ? (
                    <Badge className="text-[10px]">{myClaim.status}</Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => claim.mutate(s.id)}
                      disabled={claim.isPending || s.slots_filled >= s.slots_total}
                    >
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
