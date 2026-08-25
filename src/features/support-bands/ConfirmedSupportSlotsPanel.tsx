import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Calendar, Loader2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cancelConfirmedSupportSlot } from './tourManagementApi';

type ConfirmedSlot = {
  id: string;
  gig_id: string;
  support_band_id: string;
  gig: {
    scheduled_date: string;
    venue: { name: string } | null;
    headliner: { name: string } | null;
  } | null;
};

type CancelPreview = {
  supportSlotId: string;
  gigId: string;
  scheduledDate: string;
  hoursBeforeShow: number;
  reliabilityPenalty: number;
  reputationPenalty: number;
  relationshipPenalty: number;
  severity: 'low' | 'moderate' | 'high' | 'severe';
};

export function ConfirmedSupportSlotsPanel({ bandId }: { bandId: string }) {
  const { toast } = useToast();
  const [slots, setSlots] = useState<ConfirmedSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [preview, setPreview] = useState<CancelPreview | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('gig_support_slots')
      .select('id,gig_id,support_band_id,gig:gigs!gig_support_slots_gig_id_fkey(scheduled_date,venue:venues!gigs_venue_id_fkey(name),headliner:bands!gigs_band_id_fkey(name))')
      .eq('support_band_id', bandId)
      .eq('status', 'accepted')
      .gte('gig.scheduled_date', new Date().toISOString())
      .order('invited_at', { ascending: true });
    if (error) toast({ title: 'Could not load confirmed support slots', description: error.message, variant: 'destructive' });
    setSlots((data ?? []).filter((row: ConfirmedSlot) => row.gig) as ConfirmedSlot[]);
    setLoading(false);
  }, [bandId, toast]);

  useEffect(() => { void load(); }, [load]);

  const showPreview = async (slotId: string) => {
    setBusyId(slotId);
    const { data, error } = await (supabase as any).rpc('preview_support_band_cancellation', { p_support_slot_id: slotId });
    setBusyId(null);
    if (error) {
      toast({ title: 'Cancellation preview unavailable', description: error.message, variant: 'destructive' });
      return;
    }
    setPreview(data as CancelPreview);
  };

  const confirmCancel = async () => {
    if (!preview) return;
    setBusyId(preview.supportSlotId);
    try {
      await cancelConfirmedSupportSlot({ supportSlotId: preview.supportSlotId, reason: 'Cancelled by support band' });
      toast({ title: 'Support slot cancelled', description: 'The headliner has been notified and the date is available again.' });
      setPreview(null);
      await load();
    } catch (error: any) {
      toast({ title: 'Could not cancel support slot', description: error?.message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <Card><CardContent className="flex items-center gap-2 p-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading confirmed support slots…</CardContent></Card>;
  if (slots.length === 0) return null;

  return <Card className="border-primary/20">
    <CardHeader><CardTitle>Confirmed Support Slots</CardTitle><CardDescription>Accepted support shows are firm bookings. Cancelling can reduce your support reliability and reputation.</CardDescription></CardHeader>
    <CardContent className="space-y-3">
      {slots.map((slot) => <div key={slot.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
        <div><p className="font-medium">{slot.gig?.headliner?.name ?? 'Headliner'} · {slot.gig?.venue?.name ?? 'Venue'}</p><p className="flex items-center gap-1 text-sm text-muted-foreground"><Calendar className="h-3.5 w-3.5" />{slot.gig?.scheduled_date ? new Date(slot.gig.scheduled_date).toLocaleString() : 'Unknown date'}</p></div>
        <Button size="sm" variant="outline" disabled={busyId === slot.id} onClick={() => showPreview(slot.id)}><X className="mr-1 h-4 w-4" />Cancel slot</Button>
      </div>)}

      {preview && <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 space-y-3">
        <div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" /><p className="font-semibold">Cancellation penalty preview</p><Badge variant={preview.severity === 'severe' || preview.severity === 'high' ? 'destructive' : 'secondary'}>{preview.severity}</Badge></div>
        <div className="grid gap-2 text-sm sm:grid-cols-4"><span>{Math.round(preview.hoursBeforeShow)}h notice</span><span>Reliability impact: {preview.reliabilityPenalty}</span><span>Reputation: -{preview.reputationPenalty}</span><span>Relationship: -{preview.relationshipPenalty}</span></div>
        <p className="text-xs text-muted-foreground">The preview is calculated by the same server-side rules used when the cancellation is committed. The final transaction recalculates the penalty at cancellation time.</p>
        <div className="flex gap-2"><Button variant="destructive" disabled={busyId === preview.supportSlotId} onClick={confirmCancel}>Confirm cancellation</Button><Button variant="outline" onClick={() => setPreview(null)}>Keep booking</Button></div>
      </div>}
    </CardContent>
  </Card>;
}
