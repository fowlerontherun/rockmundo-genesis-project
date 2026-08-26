import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { CompanyEmploymentContracts } from "@/components/company/CompanyEmploymentContracts";

interface RosterRow {
  id: string;
  profile_id: string;
  display_name: string | null;
  username: string | null;
  role: string;
  salary: number;
  status: string;
  performance_rating: number | null;
  shifts_completed: number | null;
  total_earned: number | null;
  hired_at: string;
}

export function useCompanyEmployeeRoster(companyId?: string) {
  return useQuery({
    queryKey: ["company-employee-roster", companyId],
    queryFn: async (): Promise<RosterRow[]> => {
      if (!companyId) return [];
      const { data, error } = await (supabase as any).rpc("get_company_employee_roster", {
        p_company_id: companyId,
      });
      if (error) throw error;
      return (data ?? []) as RosterRow[];
    },
    enabled: !!companyId,
  });
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  on_leave: "secondary",
  suspended_unpaid: "destructive",
  terminated: "destructive",
};

export function CompanyEmployeeRoster({ companyId, isOwner }: { companyId: string; isOwner: boolean }) {
  const queryClient = useQueryClient();
  const { data: roster = [], isLoading } = useCompanyEmployeeRoster(companyId);

  const dismiss = useMutation({
    mutationFn: async (employeeId: string) => {
      const { data: contracts, error: contractError } = await (supabase as any).rpc("get_company_employment_contracts", { p_company_id: companyId });
      if (contractError) throw contractError;
      const contract = (contracts ?? []).find((row: any) => row.employmentId === employeeId);
      if (contract) {
        const { error } = await (supabase as any).rpc("terminate_company_employment_contract", {
          p_contract_id: contract.id,
          p_reason: "employer_termination",
        });
        if (error) throw error;
        return;
      }
      const { error } = await (supabase as any).rpc("dismiss_company_employee", {
        p_employee_id: employeeId,
        p_reason: "Dismissed by company owner",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Employee dismissed");
      queryClient.invalidateQueries({ queryKey: ["company-employee-roster", companyId] });
      queryClient.invalidateQueries({ queryKey: ["company-employment-contracts"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not dismiss employee"),
  });

  const active = roster.filter((r) => ["active", "suspended_unpaid"].includes(r.status));
  const wageBill = active.reduce((sum, r) => sum + Number(r.salary ?? 0), 0);

  return (
    <div className="space-y-4">
      <CompanyEmploymentContracts companyId={companyId} />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" /> Employees ({active.length})
          </CardTitle>
          <CardDescription>
            Weekly wage bill ${wageBill.toLocaleString()}. Contracted player staff have auditable payroll, reserve and dispute protection.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <>
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </>
          ) : roster.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No employees yet. Post a vacancy in the Recruitment tab to start hiring.</p>
            </div>
          ) : (
            roster.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border p-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{r.display_name || r.username || "Unknown"}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {r.role.replace(/_/g, " ")} • ${Number(r.salary ?? 0).toLocaleString()}/wk • since{" "}
                    {format(new Date(r.hired_at), "d MMM yyyy")}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {r.shifts_completed ?? 0} shifts • ${Number(r.total_earned ?? 0).toLocaleString()} earned • rating{" "}
                    {r.performance_rating ?? 50}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={STATUS_VARIANT[r.status] ?? "outline"} className="text-[10px]">
                    {r.status}
                  </Badge>
                  {isOwner && ["active", "suspended_unpaid"].includes(r.status) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => dismiss.mutate(r.id)}
                      disabled={dismiss.isPending}
                    >
                      <UserMinus className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
