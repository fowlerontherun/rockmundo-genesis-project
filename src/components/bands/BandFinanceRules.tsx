import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { Scale, Send, Check, X } from "lucide-react";

type Policy = {
  band_id: string;
  minimum_reserve_minor: number;
  member_withdrawals_allowed: boolean;
  withdrawals_require_approval: boolean;
  approval_threshold_minor: number;
  revenue_split_method: string;
  member_visibility_level: string;
};
type RequestRow = {
  id: string;
  kind: "withdrawal" | "reimbursement";
  profile_id: string;
  amount_minor: number;
  reason: string;
  status: string;
  created_at: string;
};

const db = supabase as any;
const usd = (minor: number) => `$${(minor / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const toMinor = (value: string) => Math.round(Number(value || 0) * 100);

const SPLIT_LABELS: Record<string, string> = {
  retain_all: "Band keeps all income",
  equal: "Equal split",
  custom_percentage: "Custom percentages",
  role_weighted: "Weighted by role",
  reserve_then_distribute: "Keep reserve, split the rest",
};

export function BandFinanceRules({ bandId, isLeader }: { bandId: string; isLeader: boolean }) {
  const { profileId } = useActiveProfile() as { profileId?: string | null };
  const { toast } = useToast();
  const qc = useQueryClient();
  const [kind, setKind] = useState<"withdrawal" | "reimbursement">("reimbursement");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const policyQ = useQuery({
    queryKey: ["band-finance-policy", bandId],
    queryFn: async () => {
      const { data, error } = await db.from("band_finance_policies").select("*").eq("band_id", bandId).maybeSingle();
      if (error) throw error;
      return data as Policy | null;
    },
  });
  const requestsQ = useQuery({
    queryKey: ["band-finance-requests", bandId],
    queryFn: async () => {
      const [w, r] = await Promise.all([
        db.from("band_withdrawal_requests").select("id,requesting_profile_id,amount_minor,reason,status,created_at").eq("band_id", bandId).order("created_at", { ascending: false }).limit(20),
        db.from("band_reimbursement_requests").select("id,profile_id,amount_minor,description,status,created_at").eq("band_id", bandId).order("created_at", { ascending: false }).limit(20),
      ]);
      if (w.error) throw w.error;
      if (r.error) throw r.error;
      const rows: RequestRow[] = [
        ...(w.data ?? []).map((x: any) => ({ id: x.id, kind: "withdrawal" as const, profile_id: x.requesting_profile_id, amount_minor: x.amount_minor, reason: x.reason, status: x.status, created_at: x.created_at })),
        ...(r.data ?? []).map((x: any) => ({ id: x.id, kind: "reimbursement" as const, profile_id: x.profile_id, amount_minor: x.amount_minor, reason: x.description, status: x.status, created_at: x.created_at })),
      ];
      return rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["band-finance-policy", bandId] });
    void qc.invalidateQueries({ queryKey: ["band-finance-requests", bandId] });
  };
  const fail = (e: unknown) => toast({ title: "Couldn't save", description: e instanceof Error ? e.message : String((e as any)?.message ?? e), variant: "destructive" });

  const updatePolicy = async (changes: Record<string, unknown>) => {
    if (!profileId) return;
    const { error } = await db.rpc("update_band_finance_policy", { p_band_id: bandId, p_profile_id: profileId, p_changes: changes });
    if (error) return fail(error);
    toast({ title: "Finance rules updated" });
    refresh();
  };

  const submit = async () => {
    if (!profileId) return;
    setBusy(true);
    const { error } = await db.rpc("submit_band_finance_request", { p_band_id: bandId, p_profile_id: profileId, p_kind: kind, p_amount_minor: toMinor(amount), p_reason: reason, p_category: "other" });
    setBusy(false);
    if (error) return fail(error);
    toast({ title: "Request sent", description: "The band leader will review it." });
    setAmount("");
    setReason("");
    refresh();
  };

  const decide = async (row: RequestRow, decision: "approved" | "rejected" | "cancelled") => {
    if (!profileId) return;
    const { error } = await db.rpc("review_band_finance_request", { p_profile_id: profileId, p_kind: row.kind, p_request_id: row.id, p_decision: decision, p_note: null });
    if (error) return fail(error);
    toast({ title: `Request ${decision}` });
    refresh();
  };

  const p = policyQ.data;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm"><Scale className="h-4 w-4 text-primary" />Finance rules & requests</CardTitle>
        <CardDescription className="text-xs">How the band handles reserves, withdrawals and expense refunds.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-xs">
        {!p ? (
          <p className="text-muted-foreground">{policyQ.isLoading ? "Loading…" : "No finance rules yet."}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-[11px]">Keep in reserve ($)</Label>
              <Input type="number" min={0} defaultValue={p.minimum_reserve_minor / 100} disabled={!isLeader} className="h-8 text-xs"
                onBlur={(e) => { const v = toMinor(e.target.value); if (v !== p.minimum_reserve_minor) void updatePolicy({ minimum_reserve_minor: v }); }} />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Income split</Label>
              <Select value={p.revenue_split_method} disabled={!isLeader} onValueChange={(v) => void updatePolicy({ revenue_split_method: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(SPLIT_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <label className="flex items-center justify-between gap-2 rounded border p-2">
              <span>Members may request withdrawals</span>
              <Switch checked={p.member_withdrawals_allowed} disabled={!isLeader} onCheckedChange={(v) => void updatePolicy({ member_withdrawals_allowed: v })} />
            </label>
            <label className="flex items-center justify-between gap-2 rounded border p-2">
              <span>Withdrawals need leader approval</span>
              <Switch checked={p.withdrawals_require_approval} disabled={!isLeader} onCheckedChange={(v) => void updatePolicy({ withdrawals_require_approval: v })} />
            </label>
            {!isLeader && <p className="text-[10px] text-muted-foreground sm:col-span-2">Only the band leader can change these rules.</p>}
          </div>
        )}

        <div className="space-y-2 rounded border p-2">
          <p className="font-medium">New request</p>
          <div className="flex flex-wrap gap-2">
            <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
              <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="reimbursement">Expense refund</SelectItem>
                <SelectItem value="withdrawal">Withdrawal</SelectItem>
              </SelectContent>
            </Select>
            <Input type="number" min={0} step="0.01" placeholder="Amount $" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-8 w-28 text-xs" />
            <Input placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} className="h-8 min-w-[10rem] flex-1 text-xs" maxLength={500} />
            <Button size="sm" className="h-8" onClick={() => void submit()} disabled={busy || !amount || reason.trim().length < 3}><Send className="mr-1 h-3.5 w-3.5" />Send</Button>
          </div>
          <p className="text-[10px] text-muted-foreground">Approval records the decision; the money is paid out separately.</p>
        </div>

        <div className="space-y-1">
          <p className="font-medium">Recent requests</p>
          {(requestsQ.data ?? []).length === 0 && <p className="text-muted-foreground">No requests yet.</p>}
          {(requestsQ.data ?? []).map((row) => {
            const open = row.status === "submitted" || row.status === "awaiting_approval";
            return (
              <div key={row.id} className="flex flex-wrap items-center gap-2 rounded border px-2 py-1.5">
                <Badge variant="outline" className="text-[10px]">{row.kind === "withdrawal" ? "Withdrawal" : "Refund"}</Badge>
                <span className="font-medium">{usd(row.amount_minor)}</span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{row.reason}</span>
                <Badge variant={open ? "secondary" : "outline"} className="text-[10px]">{row.status.replace(/_/g, " ")}</Badge>
                {open && isLeader && row.profile_id !== profileId && (
                  <>
                    <Button size="icon" variant="ghost" className="h-6 w-6" aria-label="Approve" onClick={() => void decide(row, "approved")}><Check className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6" aria-label="Reject" onClick={() => void decide(row, "rejected")}><X className="h-3.5 w-3.5" /></Button>
                  </>
                )}
                {open && row.profile_id === profileId && (
                  <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => void decide(row, "cancelled")}>Cancel</Button>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
