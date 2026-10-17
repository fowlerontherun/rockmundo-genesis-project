import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Stethoscope, Star } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useActiveProfile } from "@/hooks/useActiveProfile";

type Listing = {
  id: string; service_slug: string; service_name: string; description: string | null; price_cents: number; duration_minutes: number;
  effects: Record<string, number>;
  provider: { id: string; display_name: string; role: string; qualification_tier: string; reputation_score: number; completed_appointments: number } | null;
};
type Appointment = { id: string; service_slug: string; starts_at: string; price_cents: number; effects_applied: Record<string, number>; reviewed: boolean };

const db = supabase as any;
const label = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;

export default function WellnessProfessionalsPanel() {
  const { profileId } = useActiveProfile() as { profileId?: string | null };
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const listings = useQuery({
    queryKey: ["wellness-pro-listings"],
    queryFn: async () => {
      const { data, error } = await db
        .from("wellness_provider_listings")
        .select("id,service_slug,service_name,description,price_cents,duration_minutes,effects,provider:wellness_provider_profiles!wellness_provider_listings_provider_profile_id_fkey(id,display_name,role,qualification_tier,reputation_score,completed_appointments)")
        .order("price_cents");
      if (error) throw error;
      return (data ?? []) as Listing[];
    },
    staleTime: 5 * 60_000,
  });
  const history = useQuery({
    queryKey: ["wellness-pro-history", profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const [a, r] = await Promise.all([
        db.from("wellness_appointments").select("id,service_slug,starts_at,price_cents,effects_applied").eq("client_profile_id", profileId).order("starts_at", { ascending: false }).limit(10),
        db.from("wellness_professional_reviews").select("appointment_id").eq("client_profile_id", profileId),
      ]);
      if (a.error) throw a.error;
      const reviewed = new Set((r.data ?? []).map((x: any) => x.appointment_id));
      return (a.data ?? []).map((x: any) => ({ ...x, reviewed: reviewed.has(x.id) })) as Appointment[];
    },
  });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["wellness-pro-history", profileId] });
    void qc.invalidateQueries({ queryKey: ["wellness-pro-listings"] });
    void qc.invalidateQueries();
  };

  const lastBySlug = new Map<string, number>();
  (history.data ?? []).forEach((a) => { const t = new Date(a.starts_at).getTime(); if (!lastBySlug.has(a.service_slug)) lastBySlug.set(a.service_slug, t); });

  const book = async (l: Listing) => {
    if (!profileId) return;
    setBusy(l.id);
    const { data, error } = await db.rpc("book_wellness_professional", { p_profile_id: profileId, p_listing_id: l.id });
    setBusy(null);
    if (error) return toast.error(error.message);
    const parts = [data?.health ? `+${data.health} health` : null, data?.energy ? `+${data.energy} energy` : null].filter(Boolean).join(", ");
    toast.success(`${l.service_name} done`, { description: `Paid $${data?.cost}. ${parts}` });
    refresh();
  };
  const review = async (a: Appointment, rating: number) => {
    if (!profileId) return;
    const { error } = await db.rpc("review_wellness_appointment", { p_profile_id: profileId, p_appointment_id: a.id, p_rating: rating, p_comment: null });
    if (error) return toast.error(error.message);
    toast.success("Thanks for the review");
    refresh();
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base"><Stethoscope className="h-4 w-4 text-primary" /> Wellness professionals</CardTitle>
        <p className="text-xs text-muted-foreground">Book a session for an instant boost. Each service once every 3 days.</p>
      </CardHeader>
      <CardContent className="space-y-4 text-xs">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(listings.data ?? []).map((l) => {
            const last = lastBySlug.get(l.service_slug);
            const readyAt = last ? last + COOLDOWN_MS : 0;
            const cooling = readyAt > Date.now();
            return (
              <div key={l.id} className="space-y-1 rounded border p-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{l.service_name}</span>
                  <span className="ml-auto font-medium">${Math.ceil(l.price_cents / 100)}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">{l.provider?.display_name} · {label(l.provider?.role ?? "")}</p>
                <div className="flex flex-wrap items-center gap-1">
                  <Badge variant="outline" className="text-[10px]">{label(l.provider?.qualification_tier ?? "")}</Badge>
                  <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground"><Star className="h-3 w-3" />{((l.provider?.reputation_score ?? 0) / 20).toFixed(1)}</span>
                  <span className="text-[10px] text-muted-foreground">{l.duration_minutes} min</span>
                  {Object.entries(l.effects ?? {}).map(([k, v]) => <Badge key={k} variant="secondary" className="text-[10px]">+{v} {k}</Badge>)}
                </div>
                {l.description && <p className="text-[11px] text-muted-foreground">{l.description}</p>}
                <Button size="sm" className="h-7 w-full text-[11px]" disabled={!profileId || cooling || busy === l.id} onClick={() => void book(l)}>
                  {cooling ? `Available ${new Date(readyAt).toLocaleDateString()}` : busy === l.id ? "Booking…" : "Book session"}
                </Button>
              </div>
            );
          })}
        </div>

        <div className="space-y-1">
          <p className="font-medium">Your recent sessions</p>
          {(history.data ?? []).length === 0 && <p className="text-muted-foreground">No sessions yet.</p>}
          {(history.data ?? []).map((a) => (
            <div key={a.id} className="flex flex-wrap items-center gap-2">
              <span className="w-20 text-[10px] text-muted-foreground">{new Date(a.starts_at).toLocaleDateString()}</span>
              <span>{label(a.service_slug)}</span>
              <span className="text-muted-foreground">${Math.ceil(a.price_cents / 100)}</span>
              <span className="ml-auto flex items-center gap-0.5">
                {a.reviewed ? <span className="text-[10px] text-muted-foreground">Reviewed</span> : [1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" aria-label={`Rate ${n} stars`} className="text-muted-foreground hover:text-primary" onClick={() => void review(a, n)}>
                    <Star className="h-3.5 w-3.5" />
                  </button>
                ))}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
