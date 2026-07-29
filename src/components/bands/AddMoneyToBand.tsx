import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrencyMinor } from "@/services/banking/bankingService";
import { toast } from "sonner";
import { HandCoins, Loader2 } from "lucide-react";

type Source = { sourceKind: "wallet" | "bank"; sourceAccountId: string | null; displayName: string; accountType: string; currencyCode: string; availableBalanceMinor: number; eligible: boolean; ineligibleReason?: string | null };
type Preview = { sourceDisplay: string; currencyCode: string; sourceBalanceMinor: number; amountMinor: number; resultingSourceBalanceMinor: number; treasuryBalanceMinor: number; resultingTreasuryBalanceMinor: number; treasuryWillBeCreated: boolean };

const minor = (value: string) => {
  const match = value.trim().match(/^(\d+)(?:\.(\d{1,2}))?$/);
  return match ? Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0")) : 0;
};

export function AddMoneyToBand({ bandId: fixedBandId, onComplete }: { bandId?: string; onComplete?: () => void }) {
  const { profileId, isLoading: profileLoading } = useActiveProfile();
  const [bands, setBands] = useState<Array<{ id: string; name: string }>>([]);
  const [bandId, setBandId] = useState(fixedBandId ?? "");
  const [sources, setSources] = useState<Source[]>([]);
  const [sourceKey, setSourceKey] = useState("");
  const [amount, setAmount] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const source = useMemo(() => sources.find((s) => `${s.sourceKind}:${s.sourceAccountId ?? "wallet"}` === sourceKey), [sources, sourceKey]);

  useEffect(() => {
    if (fixedBandId || !profileId) return;
    void supabase.from("band_members").select("band_id,bands(id,name)").eq("profile_id", profileId).eq("member_status", "active").then(({ data, error }) => {
      if (error) toast.error(error.message);
      else setBands((data ?? []).map((row: any) => row.bands).filter(Boolean));
    });
  }, [fixedBandId, profileId]);

  const loadSources = async () => {
    if (!bandId) return;
    setBusy(true); setPreview(null);
    const { data, error } = await (supabase as any).rpc("get_my_band_funding_sources", { p_band_id: bandId });
    setBusy(false);
    if (error) return toast.error(error.message);
    const next = (data?.sources ?? []) as Source[];
    setSources(next); setSourceKey(next[0] ? `${next[0].sourceKind}:${next[0].sourceAccountId ?? "wallet"}` : "");
  };
  useEffect(() => { void loadSources(); }, [bandId]); // eslint-disable-line react-hooks/exhaustive-deps

  const previewFunding = async () => {
    if (!source || minor(amount) <= 0) return;
    setBusy(true);
    const { data, error } = await (supabase as any).rpc("preview_my_band_funding", { p_band_id: bandId, p_source_kind: source.sourceKind, p_source_account_id: source.sourceAccountId, p_amount_minor: minor(amount) });
    setBusy(false); if (error) toast.error(error.message); else setPreview(data as Preview);
  };
  const confirm = async () => {
    if (!preview || !source) return;
    setBusy(true);
    const { error } = await (supabase as any).rpc("fund_my_band", { p_band_id: bandId, p_source_kind: source.sourceKind, p_source_account_id: source.sourceAccountId, p_amount_minor: preview.amountMinor, p_note: null, p_idempotency_key: crypto.randomUUID() });
    setBusy(false); if (error) return toast.error(error.message);
    toast.success("Band funded"); setPreview(null); setAmount(""); await loadSources(); onComplete?.();
  };

  return <Card>
    <CardHeader><CardTitle className="flex items-center gap-2"><HandCoins className="h-5 w-5" />Add money to band</CardTitle><CardDescription>Fund a matching-currency treasury directly from this character's wallet or bank account. No currency conversion is performed.</CardDescription></CardHeader>
    <CardContent className="space-y-4">
      {!fixedBandId && <div><Label>Band</Label><Select value={bandId} onValueChange={setBandId}><SelectTrigger><SelectValue placeholder="Select band" /></SelectTrigger><SelectContent>{bands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>}
      {profileLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : bandId && <>
        <div><Label>Funding source</Label><Select value={sourceKey} onValueChange={(v) => { setSourceKey(v); setPreview(null); }}><SelectTrigger><SelectValue placeholder="Select wallet or account" /></SelectTrigger><SelectContent>{sources.map((s) => <SelectItem disabled={!s.eligible} key={`${s.sourceKind}:${s.sourceAccountId ?? "wallet"}`} value={`${s.sourceKind}:${s.sourceAccountId ?? "wallet"}`}>{s.displayName} · {formatCurrencyMinor({ amountMinor: s.availableBalanceMinor, currencyCode: s.currencyCode })} ({s.currencyCode})</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Amount ({source?.currencyCode ?? "currency"})</Label><Input inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value); setPreview(null); }} placeholder="0.00" /></div>
        {preview && <div className="rounded-md border p-3 text-sm space-y-1"><p>Source: {formatCurrencyMinor({ amountMinor: preview.sourceBalanceMinor, currencyCode: preview.currencyCode })} → <strong>{formatCurrencyMinor({ amountMinor: preview.resultingSourceBalanceMinor, currencyCode: preview.currencyCode })}</strong></p><p>Band {preview.currencyCode} treasury: {formatCurrencyMinor({ amountMinor: preview.treasuryBalanceMinor, currencyCode: preview.currencyCode })} → <strong>{formatCurrencyMinor({ amountMinor: preview.resultingTreasuryBalanceMinor, currencyCode: preview.currencyCode })}</strong>{preview.treasuryWillBeCreated ? " (new treasury)" : ""}</p></div>}
        <Button disabled={busy || !source || !amount} onClick={() => void (preview ? confirm() : previewFunding())}>{busy ? "Working…" : preview ? "Confirm funding" : "Preview balances"}</Button>
      </>}
    </CardContent>
  </Card>;
}
