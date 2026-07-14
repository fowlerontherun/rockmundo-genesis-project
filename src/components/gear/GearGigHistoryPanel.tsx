import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth-context";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { History, Plus, MapPin } from "lucide-react";
import { Link } from "react-router-dom";

export type GearKind = "band_stage" | "personal" | "player_equipment";

interface Props {
  gearKind: GearKind;
  gearId: string;
  gearName?: string;
  canManuallyLog?: boolean;
  compact?: boolean;
}

interface Row {
  id: string;
  gig_id: string | null;
  band_name: string | null;
  venue_name: string | null;
  performed_at: string;
  entry_source: string;
  notes: string | null;
}

export function GearGigHistoryPanel({ gearKind, gearId, gearName, canManuallyLog = false, compact }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [gigId, setGigId] = useState("");
  const [performedAt, setPerformedAt] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("gear_gig_history")
      .select("id, gig_id, band_name, venue_name, performed_at, entry_source, notes")
      .eq("gear_kind", gearKind)
      .eq("gear_id", gearId)
      .order("performed_at", { ascending: false })
      .limit(500);
    setRows((data as Row[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gearKind, gearId]);

  const submit = async () => {
    setSaving(true);
    const { error } = await (supabase as any).rpc("log_gear_gig_manual", {
      p_gear_kind: gearKind,
      p_gear_id: gearId,
      p_gig_id: gigId || null,
      p_notes: notes || null,
      p_performed_at: performedAt ? new Date(performedAt).toISOString() : null,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Could not log entry", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Gig logged", description: "Added to gear history." });
    setOpen(false);
    setGigId(""); setNotes(""); setPerformedAt("");
    load();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" />
          Gig History {gearName ? `— ${gearName}` : ""}
          <Badge variant="secondary" className="ml-1">{rows.length}</Badge>
        </CardTitle>
        {canManuallyLog && user && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline"><Plus className="h-3 w-3 mr-1" />Log gig</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Log a gig manually</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground">Gig ID (optional)</label>
                  <Input value={gigId} onChange={(e) => setGigId(e.target.value)} placeholder="uuid of the gig" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Performed at</label>
                  <Input type="datetime-local" value={performedAt} onChange={(e) => setPerformedAt(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Notes</label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. First show with this rig" />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={submit} disabled={saving}>{saving ? "Saving..." : "Log gig"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent className={compact ? "max-h-64 overflow-y-auto" : ""}>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading history…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No gigs logged yet. History accrues automatically when gigs are completed.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.id} className="flex items-start justify-between border-b border-border/40 pb-2 last:border-0">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {r.band_name || "Solo"} {r.venue_name ? <span className="text-muted-foreground">· <MapPin className="inline h-3 w-3" /> {r.venue_name}</span> : null}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(r.performed_at), "PP")} · {r.entry_source === "manual" ? "manual" : "auto"}
                    {r.gig_id && (
                      <> · <Link to={`/gigs/${r.gig_id}`} className="underline">gig</Link></>
                    )}
                  </div>
                  {r.notes && <div className="text-xs mt-0.5 italic text-muted-foreground">"{r.notes}"</div>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default GearGigHistoryPanel;
