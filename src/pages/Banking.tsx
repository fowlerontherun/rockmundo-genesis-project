import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, CalendarClock, Landmark, Loader2, PiggyBank, Plus, Target, TrendingUp, WalletCards, ArrowUpRight, ArrowDownLeft, ArrowLeftRight, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { fetchBankingDashboard, formatCurrencyMinor } from "@/services/banking/bankingService";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong.";
}
const toCents = (v: string | number) => Math.max(0, Math.round(Number(v || 0) * 100));

export default function Banking() {
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["banking-dashboard"],
    queryFn: fetchBankingDashboard,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["banking-dashboard"] });

  if (isLoading) {
    return (
      <FMPageScaffold title="Banking" subtitle="Personal accounts, savings, fixed deposits, goals and band deposits." icon={Landmark} backTo="/finances">
        <div className="flex min-h-[320px] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      </FMPageScaffold>
    );
  }

  if (error) {
    return (
      <FMPageScaffold title="Banking" subtitle="Personal accounts, savings, fixed deposits, goals and band deposits." icon={Landmark} backTo="/finances">
        <Card><CardHeader><CardTitle>Banking unavailable</CardTitle><CardDescription>{errMsg(error)}</CardDescription></CardHeader><CardContent><Button onClick={() => void refetch()}>Retry</Button></CardContent></Card>
      </FMPageScaffold>
    );
  }

  const accounts = data?.accounts ?? [];
  const goals = data?.savingsGoals ?? [];
  const recent = data?.recentActivity ?? [];
  const summary = data?.savingsSummary;
  const currency = summary?.currencyCode ?? "USD";

  return (
    <FMPageScaffold title="Banking" subtitle="Personal accounts, savings, fixed deposits, goals and band deposits." icon={Landmark} backTo="/finances">
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard icon={<WalletCards className="h-5 w-5" />} label="Net worth" value={formatCurrencyMinor({ amountMinor: summary?.netWorthMinor ?? 0, currencyCode: currency })} hint="Wallet + bank" />
          <StatCard icon={<PiggyBank className="h-5 w-5" />} label="Savings" value={formatCurrencyMinor({ amountMinor: summary?.savingsMinor ?? 0, currencyCode: currency })} hint="Easy access" />
          <StatCard icon={<CalendarClock className="h-5 w-5" />} label="Locked deposits" value={formatCurrencyMinor({ amountMinor: summary?.lockedDepositsMinor ?? 0, currencyCode: currency })} hint="Fixed term" />
          <StatCard icon={<TrendingUp className="h-5 w-5" />} label="Wallet cash" value={formatCurrencyMinor({ amountMinor: summary?.cashMinor ?? 0, currencyCode: currency })} hint="Available now" />
        </div>

        <Tabs defaultValue="accounts">
          <TabsList>
            <TabsTrigger value="accounts">Accounts</TabsTrigger>
            <TabsTrigger value="goals">Goals</TabsTrigger>
            <TabsTrigger value="statements">Statements</TabsTrigger>
            <TabsTrigger value="band">Band deposit</TabsTrigger>
          </TabsList>

          <TabsContent value="accounts" className="space-y-4">
            <div className="flex justify-end"><OpenAccountDialog onDone={invalidate} /></div>
            {accounts.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No accounts yet. Open your first current or savings account to get started.</CardContent></Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {accounts.map((acct) => (
                  <AccountCard key={acct.id} account={acct} accounts={accounts} onDone={invalidate} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="goals" className="space-y-4">
            <div className="flex justify-end"><CreateGoalDialog onDone={invalidate} /></div>
            {goals.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No savings goals yet. Create one for a new guitar, tour bus or studio deposit.</CardContent></Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {goals.map((g) => (
                  <GoalCard key={g.id} goal={g} accounts={accounts} onDone={invalidate} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="statements">
            <Card>
              <CardHeader><CardTitle>Recent activity</CardTitle><CardDescription>Latest 25 transactions across your accounts.</CardDescription></CardHeader>
              <CardContent className="space-y-2">
                {recent.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No transactions yet.</p>
                ) : recent.map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between border-b py-2 text-sm last:border-0">
                    <div>
                      <div className="font-medium">{t.description ?? t.txType}</div>
                      <div className="text-xs text-muted-foreground">{format(new Date(t.createdAt), "PPp")} · {t.txType}</div>
                    </div>
                    <div className={t.txType?.includes("out") || t.txType === "withdrawal" || t.txType === "band_deposit" || t.txType === "goal_contribution" || t.txType === "fee" ? "text-destructive font-semibold" : "text-emerald-500 font-semibold"}>
                      {formatCurrencyMinor({ amountMinor: t.amountMinor, currencyCode: t.currencyCode })}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="band">
            <BandDepositPanel accounts={accounts} onDone={invalidate} />
          </TabsContent>
        </Tabs>
      </div>
    </FMPageScaffold>
  );
}

function StatCard({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint: string }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">{icon} {label}</CardTitle></CardHeader>
      <CardContent><div className="text-2xl font-bold">{value}</div><p className="text-xs text-muted-foreground">{hint}</p></CardContent>
    </Card>
  );
}

function AccountCard({ account, accounts, onDone }: { account: any; accounts: any[]; onDone: () => void }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{account.nickname || account.providerName}</CardTitle>
            <CardDescription className="capitalize">{account.accountType.replace("_", " ")} · {account.currencyCode} · {(account.annualRateBps / 100).toFixed(2)}% APR</CardDescription>
          </div>
          <Badge variant={account.accountType === "fixed_deposit" ? "secondary" : "outline"}>{account.accountType.replace("_", " ")}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-3xl font-bold">{formatCurrencyMinor({ amountMinor: account.balanceMinor, currencyCode: account.currencyCode })}</div>
        {account.restrictionSummary && <p className="text-xs text-muted-foreground">{account.restrictionSummary}</p>}
        <div className="flex flex-wrap gap-2">
          <DepositDialog account={account} onDone={onDone} />
          <WithdrawDialog account={account} onDone={onDone} />
          <TransferDialog fromAccount={account} accounts={accounts.filter(a => a.id !== account.id)} onDone={onDone} />
        </div>
      </CardContent>
    </Card>
  );
}

function OpenAccountDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"current" | "savings" | "fixed_deposit">("current");
  const [nickname, setNickname] = useState("");
  const [initial, setInitial] = useState("0");
  const [term, setTerm] = useState("6");
  const mut = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any).rpc("create_bank_account", {
        p_account_type: type, p_nickname: nickname || null, p_initial_deposit_cents: toCents(initial),
        p_term_months: type === "fixed_deposit" ? Number(term) : null,
      });
      if (error) throw new Error(error.message); return data;
    },
    onSuccess: () => { toast.success("Account opened"); onDone(); setOpen(false); setNickname(""); setInitial("0"); },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" />Open account</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Open a bank account</DialogTitle><DialogDescription>Current (0%), Savings (2.5% APR), or Fixed Deposit (3–8% APR, locked).</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div><Label>Account type</Label>
            <Select value={type} onValueChange={(v: any) => setType(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Current</SelectItem>
                <SelectItem value="savings">Savings</SelectItem>
                <SelectItem value="fixed_deposit">Fixed deposit</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Nickname (optional)</Label><Input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Tour fund" /></div>
          <div><Label>Opening deposit ($)</Label><Input type="number" min="0" value={initial} onChange={(e) => setInitial(e.target.value)} /></div>
          {type === "fixed_deposit" && (
            <div><Label>Term (months)</Label>
              <Select value={term} onValueChange={setTerm}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[3, 6, 12, 24, 36].map((m) => <SelectItem key={m} value={String(m)}>{m} months ({(3 + m * 0.25).toFixed(2)}% APR)</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter><Button onClick={() => mut.mutate()} disabled={mut.isPending}>{mut.isPending ? "Opening…" : "Open"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AmountRpcDialog({ trigger, title, description, rpc, extraArgs = {}, onDone, currency, accountId }: {
  trigger: React.ReactNode; title: string; description: string; rpc: string; extraArgs?: Record<string, any>; onDone: () => void; currency: string; accountId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const mut = useMutation({
    mutationFn: async () => {
      const args: any = { p_amount_cents: toCents(amount), ...extraArgs };
      if (accountId) args.p_account_id = accountId;
      const { data, error } = await (supabase as any).rpc(rpc, args);
      if (error) throw new Error(error.message); return data;
    },
    onSuccess: () => { toast.success("Done"); onDone(); setOpen(false); setAmount(""); },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
        <div><Label>Amount ({currency})</Label><Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        <DialogFooter><Button onClick={() => mut.mutate()} disabled={mut.isPending || !amount}>{mut.isPending ? "Working…" : "Confirm"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DepositDialog({ account, onDone }: { account: any; onDone: () => void }) {
  return <AmountRpcDialog
    trigger={<Button size="sm" variant="outline"><ArrowDownLeft className="mr-1 h-4 w-4" />Deposit</Button>}
    title="Deposit from wallet" description="Move cash from your wallet into this account."
    rpc="bank_deposit_from_cash" accountId={account.id} currency={account.currencyCode} onDone={onDone}
  />;
}
function WithdrawDialog({ account, onDone }: { account: any; onDone: () => void }) {
  return <AmountRpcDialog
    trigger={<Button size="sm" variant="outline"><ArrowUpRight className="mr-1 h-4 w-4" />Withdraw</Button>}
    title="Withdraw to wallet" description="Move money from this account into your wallet."
    rpc="bank_withdraw_to_cash" accountId={account.id} currency={account.currencyCode} onDone={onDone}
  />;
}

function TransferDialog({ fromAccount, accounts, onDone }: { fromAccount: any; accounts: any[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(accounts[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const mut = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).rpc("bank_transfer", { p_from_account: fromAccount.id, p_to_account: to, p_amount_cents: toCents(amount) });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { toast.success("Transfer complete"); onDone(); setOpen(false); setAmount(""); },
    onError: (e) => toast.error(errMsg(e)),
  });
  if (accounts.length === 0) return null;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline"><ArrowLeftRight className="mr-1 h-4 w-4" />Transfer</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Transfer between accounts</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>To account</Label>
            <Select value={to} onValueChange={setTo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.nickname || a.providerName} · {a.accountType}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Amount ({fromAccount.currencyCode})</Label><Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        </div>
        <DialogFooter><Button onClick={() => mut.mutate()} disabled={mut.isPending || !amount || !to}>{mut.isPending ? "Working…" : "Transfer"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateGoalDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(""); const [target, setTarget] = useState(""); const [targetDate, setTargetDate] = useState("");
  const mut = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).rpc("create_savings_goal", { p_name: name, p_target_cents: toCents(target), p_target_date: targetDate || null, p_linked_account: null });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { toast.success("Goal created"); onDone(); setOpen(false); setName(""); setTarget(""); setTargetDate(""); },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" />New goal</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create savings goal</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New guitar" /></div>
          <div><Label>Target ($)</Label><Input type="number" min="0" step="0.01" value={target} onChange={(e) => setTarget(e.target.value)} /></div>
          <div><Label>Target date (optional)</Label><Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} /></div>
        </div>
        <DialogFooter><Button onClick={() => mut.mutate()} disabled={mut.isPending || !name || !target}>{mut.isPending ? "Saving…" : "Create"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GoalCard({ goal, accounts, onDone }: { goal: any; accounts: any[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [fromAcct, setFromAcct] = useState(accounts[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const pct = Math.min(100, (goal.completionBps ?? 0) / 100);
  const mut = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).rpc("contribute_to_savings_goal", { p_goal_id: goal.id, p_from_account: fromAcct, p_amount_cents: toCents(amount) });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { toast.success("Contributed"); onDone(); setOpen(false); setAmount(""); },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between"><CardTitle className="flex items-center gap-2 text-base"><Target className="h-4 w-4" />{goal.name}</CardTitle><span className="text-sm text-muted-foreground">{pct.toFixed(0)}%</span></div>
        {goal.projectedCompletionDate && <CardDescription>Target: {goal.projectedCompletionDate}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="mt-1 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${pct}%` }} /></div>
        <p className="mt-2 text-sm text-muted-foreground">{formatCurrencyMinor({ amountMinor: goal.currentMinor, currencyCode: goal.currencyCode })} of {formatCurrencyMinor({ amountMinor: goal.targetMinor, currencyCode: goal.currencyCode })}</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" variant="outline" className="mt-3" disabled={accounts.length === 0}>Contribute</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Contribute to {goal.name}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>From account</Label>
                <Select value={fromAcct} onValueChange={setFromAcct}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.nickname || a.providerName} · {formatCurrencyMinor({ amountMinor: a.balanceMinor, currencyCode: a.currencyCode })}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Amount ($)</Label><Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            </div>
            <DialogFooter><Button onClick={() => mut.mutate()} disabled={mut.isPending || !amount || !fromAcct}>{mut.isPending ? "Working…" : "Confirm"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function BandDepositPanel({ accounts, onDone }: { accounts: any[]; onDone: () => void }) {
  const { data: myBands = [] } = useQuery({
    queryKey: ["my-bands-for-deposit"],
    queryFn: async () => {
      const { data: profile } = await supabase.auth.getUser();
      if (!profile.user) return [];
      const { data: pRow } = await supabase.from("profiles").select("id").eq("user_id", profile.user.id).maybeSingle();
      if (!pRow) return [];
      const { data, error } = await supabase.from("band_members").select("band_id, bands(id, name, band_balance)").eq("profile_id", pRow.id);
      if (error) return [];
      return (data ?? []).map((r: any) => r.bands).filter(Boolean);
    },
  });

  const [bandId, setBandId] = useState<string>("");
  const [fromAcct, setFromAcct] = useState<string>(accounts[0]?.id ?? "");
  const [amount, setAmount] = useState("");

  const mut = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).rpc("deposit_to_band_treasury", { p_band_id: bandId, p_from_account: fromAcct, p_amount_cents: toCents(amount) });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { toast.success("Deposit sent to band treasury"); onDone(); setAmount(""); },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Deposit into a band's treasury</CardTitle><CardDescription>Move personal savings into a band you are a member of. Fixed deposits can't be used until they mature.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        {myBands.length === 0 ? (
          <p className="text-sm text-muted-foreground">You aren't a member of any band yet.</p>
        ) : accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Open a bank account first to make a deposit.</p>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-3">
              <div><Label>Band</Label>
                <Select value={bandId} onValueChange={setBandId}>
                  <SelectTrigger><SelectValue placeholder="Select band" /></SelectTrigger>
                  <SelectContent>{myBands.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name} · ${b.band_balance ?? 0}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>From account</Label>
                <Select value={fromAcct} onValueChange={setFromAcct}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.nickname || a.providerName} · {formatCurrencyMinor({ amountMinor: a.balanceMinor, currencyCode: a.currencyCode })}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Amount ($)</Label><Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            </div>
            <Button onClick={() => mut.mutate()} disabled={!bandId || !fromAcct || !amount || mut.isPending}>
              {mut.isPending ? "Sending…" : "Deposit to band"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
