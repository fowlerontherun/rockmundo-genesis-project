import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DollarSign, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { OwnedNightclub } from "@/hooks/useNightclubOwnership";

type Shortlisted = {
  id: string;
  dj_display_name: string;
  setlist_name: string;
  starts_at: string;
};
type Offer = {
  id: string;
  application_id: string;
  fee: number;
  status: string;
  expires_at: string;
};
const uuidPattern = /^[a-f0-9-]{36}$/i;

export function OwnedClubDjFundedOffers({ club }: { club: OwnedNightclub }) {
  const verified = Boolean(club.verified_purchase_id && club.club_id);
  const queryClient = useQueryClient();
  const [feeDrafts, setFeeDrafts] = useState<Record<string, string>>({});
  const attempts = useRef(new Map<string, string>());
  const { data: applicants = [], isError: applicantsError } = useQuery<Shortlisted[]>({
    queryKey: ["owned-club-dj-offer-applicants", club.id],
    enabled: verified,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).from("dj_club_applications")
        .select("id,dj_display_name,setlist_name,starts_at")
        .eq("owned_club_id", club.id).eq("status", "shortlisted")
        .gte("starts_at", new Date(Date.now() + 90 * 60000).toISOString())
        .order("starts_at").limit(30);
      if (error) throw error;
      return (data ?? []) as Shortlisted[];
    },
  });
  const { data: offers = [], isError: offersError } = useQuery<Offer[]>({
    queryKey: ["nightclub-dj-funded-offers", club.id],
    enabled: verified,
    refetchInterval: 60_000,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).from("nightclub_dj_funded_offers")
        .select("id,application_id,fee,status,expires_at")
        .eq("owned_club_id", club.id).order("created_at", { ascending: false }).limit(35);
      if (error) throw error;
      return (data ?? []) as Offer[];
    },
  });
  function requestId(key: string) {
    let id = attempts.current.get(key);
    if (!id) {
      try { const stored = sessionStorage.getItem(key); if (stored && uuidPattern.test(stored)) id = stored; }
      catch { /* Storage may not be available. */ }
    }
    id ??= crypto.randomUUID();
    attempts.current.set(key, id);
    try { sessionStorage.setItem(key, id); } catch { /* Keep in-memory retry identity. */ }
    return id;
  }
  function clear(key: string) {
    attempts.current.delete(key);
    try { sessionStorage.removeItem(key); } catch { /* Best effort. */ }
  }
  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["nightclub-dj-funded-offers", club.id] });
    void queryClient.invalidateQueries({ queryKey: ["dj-funded-offers-for-club"] });
    void queryClient.invalidateQueries({ queryKey: ["profile"] });
    void queryClient.invalidateQueries({ queryKey: ["player-financial-accounts"] });
  }
  const fund = useMutation({
    mutationFn: async ({ appId, amount }: { appId: string; amount: number }) => {
      if (!verified) throw new Error("Verified nightclub ownership required");
      if (!Number.isInteger(amount) || amount < 50 ||
          amount > Math.min(1250, Math.max(250, 250 * club.quality_level))) {
        throw new Error("The fee must be a whole amount within your club tier limit");
      }
      const key = `dj-fee-fund:${club.id}:${appId}:${amount}`;
      const id = requestId(key);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("fund_nightclub_dj_offer", {
        p_owned_club_id: club.id, p_application_id: appId, p_fee: amount, p_request_id: id,
      });
      if (error) throw error;
      if (!data || !uuidPattern.test(data.offer_id ?? "") || data.fee !== amount) {
        throw new Error("Fee escrow was not confirmed by the server");
      }
      clear(key);
      return data as { offer_id: string; fee: number };
    },
    onSuccess: (result) => {
      toast.success(`$${result.fee} held securely for a DJ offer — no gig is booked yet`);
      refresh();
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Could not fund DJ offer"),
  });
  const cancel = useMutation({
    mutationFn: async (offerId: string) => {
      const key = `dj-fee-cancel:${club.id}:${offerId}`;
      const id = requestId(key);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("decide_nightclub_dj_offer", {
        p_offer_id: offerId, p_action: "cancel", p_request_id: id,
      });
      if (error) throw error;
      if (!data || data.offer_id !== offerId || data.status !== "cancelled") {
        throw new Error("Escrow refund was not confirmed");
      }
      clear(key);
    },
    onSuccess: () => { toast.success("DJ offer cancelled and fee refunded"); refresh(); },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Could not cancel DJ offer"),
  });

  return (
    <Card data-testid="nightclub-dj-funded-offers">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg"><DollarSign className="h-5 w-5 text-primary" /> Funded DJ offers</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Reserve cash to propose a fee to a shortlisted DJ. Your money is held in escrow,
          refundable on cancellation, rejection or expiry (within 24 hours).
          Even an accepted offer is <strong>not a booked gig</strong> and pays no DJ until
          the separate performance settlement system is certified.
        </p>
        {!verified ? <p className="text-sm text-muted-foreground">
          A receipt-verified club purchase is required before offering DJ fees.
        </p> : <>
          {(offersError || applicantsError) && <p role="alert" className="text-sm text-destructive">
            Could not load all offer details. Check the club's financial history before retrying.
          </p>}
          {!offersError && !applicantsError && applicants.filter(a => !offers.some(o => o.application_id === a.id)).map(a => {
            const amount = feeDrafts[a.id] ?? "100";
            return <div key={a.id} className="flex flex-wrap items-end gap-2 rounded-md border p-3">
              <div className="min-w-40 flex-1">
                <p className="text-sm font-medium">{a.dj_display_name} · {a.setlist_name}</p>
                <p className="text-xs text-muted-foreground">{new Date(a.starts_at).toLocaleString()}</p>
              </div>
              <div>
                <label htmlFor={`fee-${a.id}`} className="text-xs">Offer fee ($)</label>
                <Input id={`fee-${a.id}`} type="number" min={50}
                  max={Math.min(1250, Math.max(250, 250 * club.quality_level))}
                  step={1} className="w-24" value={amount}
                  onChange={e => setFeeDrafts(old => ({ ...old, [a.id]: e.target.value }))} />
              </div>
              <Button disabled={fund.isPending || !Number.isInteger(Number(amount)) || !amount.trim()}
                onClick={() => fund.mutate({ appId: a.id, amount: Number(amount) })}>
                {fund.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Hold fee
              </Button>
            </div>;
          })}
          {offers.length > 0 && <div className="space-y-2">
            <p className="text-sm font-medium">Offer escrow history</p>
            {offers.map(o => <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2.5">
              <div>
                <p className="text-sm font-medium">$​{o.fee} · {o.status}</p>
                <p className="text-xs text-muted-foreground">
                  {o.status === "offered" || o.status === "accepted"
                    ? `Held until ${new Date(o.expires_at).toLocaleString()} unless cancelled`
                    : "Offer closed and original fee returned to owner"}
                </p>
              </div>
              {["offered", "accepted"].includes(o.status) &&
                <Button size="sm" variant="outline" disabled={cancel.isPending}
                  onClick={() => cancel.mutate(o.id)}>Cancel & refund</Button>}
            </div>)}
          </div>}
        </>}
      </CardContent>
    </Card>
  );
}
