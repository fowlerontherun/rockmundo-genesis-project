import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { FileSignature, ShieldCheck, AlertTriangle, DollarSign, CheckCircle2 } from "lucide-react";

const db = supabase as any;

type Props = { companyId?: string };

const money = (minor: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((minor ?? 0) / 100);

export function CompanyEmploymentContracts({ companyId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: contracts = [], isLoading, error } = useQuery({
    queryKey: ["company-employment-contracts", companyId ?? "mine"],
    queryFn: async () => {
      const { data, error } = await db.rpc("get_company_employment_contracts", { p_company_id: companyId ?? null });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["company-employment-contracts"] });

  const dispute = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await db.rpc("open_company_employment_dispute", { p_contract_id: id, p_reason_code: reason, p_details: null });
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: "Dispute opened", description: "The server evidence bundle has been frozen for review." }); refresh(); },
    onError: (e: Error) => toast({ title: "Could not open dispute", description: e.message, variant: "destructive" }),
  });

  const terminate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.rpc("terminate_company_employment_contract", { p_contract_id: id, p_reason: companyId ? "employer_termination" : "resignation" });
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: "Employment ended", description: "Termination and reserve settlement were recorded." }); refresh(); },
    onError: (e: Error) => toast({ title: "Could not end employment", description: e.message, variant: "destructive" }),
  });

  return <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2"><FileSignature className="h-5 w-5" />Employment contracts</CardTitle>
      <CardDescription>{companyId ? "Salary, duties, trial periods, reserve protection and payroll evidence for company employees." : "Your player-company employment terms, verified payroll and dispute protections."}</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      {isLoading && <p className="text-sm text-muted-foreground">Loading contracts…</p>}
      {error && <p className="text-sm text-destructive">Could not load employment contracts.</p>}
      {!isLoading && !error && contracts.length === 0 && <p className="text-sm text-muted-foreground">No employment contracts yet.</p>}
      {contracts.map((contract: any) => <div key={contract.id} className="rounded-lg border p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div><p className="font-medium">{companyId ? contract.employeeName : "Employment agreement"}</p><p className="text-sm text-muted-foreground">Started {new Date(contract.startsAt).toLocaleDateString()}</p></div>
          <div className="flex gap-2"><Badge variant="outline">{contract.status}</Badge><Badge variant={contract.reserveStatus === "funded" ? "default" : "secondary"}><ShieldCheck className="mr-1 h-3 w-3" />Reserve {contract.reserveStatus}</Badge></div>
        </div>
        <div className="grid gap-2 sm:grid-cols-3 text-sm">
          <div className="rounded bg-muted p-2"><span className="text-muted-foreground">Salary</span><p className="font-medium">{money(contract.weeklySalaryMinor)}/week</p></div>
          <div className="rounded bg-muted p-2"><span className="text-muted-foreground">Verified shift bonus</span><p className="font-medium">{money(contract.bonusPerVerifiedShiftMinor)}</p></div>
          <div className="rounded bg-muted p-2"><span className="text-muted-foreground">Notice</span><p className="font-medium">{contract.terminationNoticeDays} days</p></div>
        </div>
        {contract.trialEndsAt && <p className="text-xs text-muted-foreground">Trial ends {new Date(contract.trialEndsAt).toLocaleDateString()}.</p>}
        {Array.isArray(contract.duties) && contract.duties.length > 0 && <div className="text-sm"><p className="font-medium mb-1">Duties</p><div className="flex flex-wrap gap-1">{contract.duties.map((duty: any, i: number) => <Badge key={i} variant="secondary">{typeof duty === "string" ? duty : duty?.label ?? "Duty"}</Badge>)}</div></div>}
        <div className="space-y-2">
          <p className="text-sm font-medium flex items-center gap-1"><DollarSign className="h-4 w-4" />Payroll evidence</p>
          {(contract.payroll ?? []).length === 0 ? <p className="text-xs text-muted-foreground">No payroll settlement has been recorded yet.</p> : (contract.payroll ?? []).slice(0, 6).map((row: any) => <div key={row.weekStart} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2 text-sm"><span>{row.weekStart}</span><span>{money(row.salaryDueMinor)} salary + {money(row.bonusDueMinor)} bonus</span><Badge variant={row.status === "paid" ? "default" : "destructive"}>{row.status === "paid" && <CheckCircle2 className="mr-1 h-3 w-3" />}{row.status}</Badge></div>)}
        </div>
        {contract.consecutiveUnpaidWeeks > 0 && <div className="flex items-center gap-2 rounded border border-destructive/40 p-2 text-sm text-destructive"><AlertTriangle className="h-4 w-4" />{contract.consecutiveUnpaidWeeks} consecutive unpaid payroll week(s). Reserve protection may apply.</div>}
        {!['terminated','completed'].includes(contract.status) && <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={dispute.isPending} onClick={() => dispute.mutate({ id: contract.id, reason: contract.consecutiveUnpaidWeeks > 0 ? "non_payment" : "breach" })}>Open dispute</Button><Button size="sm" variant="destructive" disabled={terminate.isPending || contract.status === "disputed"} onClick={() => terminate.mutate(contract.id)}>{companyId ? "End employment" : "Resign"}</Button></div>}
      </div>)}
    </CardContent>
  </Card>;
}
