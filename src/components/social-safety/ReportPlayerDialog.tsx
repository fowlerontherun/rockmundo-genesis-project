import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { submitPlayerReport } from "@/services/social-safety/PlayerReportService";
import { EMERGENCY_SAFETY_COPY, REPORT_CATEGORY_OPTIONS, type ReportCategory } from "@/services/social-safety/config";

export function ReportPlayerDialog({ targetProfileId, playerName, trigger }: { targetProfileId: string; playerName: string; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false); const [category, setCategory] = useState<ReportCategory | "">(""); const [description, setDescription] = useState(""); const [accurate, setAccurate] = useState(false); const [blockAfter, setBlockAfter] = useState(false);
  const qc = useQueryClient(); const { toast } = useToast();
  const selected = REPORT_CATEGORY_OPTIONS.find((o) => o.value === category);
  const mutation = useMutation({ mutationFn: () => submitPlayerReport({ reportedProfileId: targetProfileId, category: category as ReportCategory, description, blockAfterReport: blockAfter, context: { surface: "player_profile", submitted_from: window.location.pathname } }), onSuccess: () => { toast({ title: "Your report has been submitted for review." }); qc.invalidateQueries({ queryKey: ["my-reports"] }); qc.invalidateQueries({ queryKey: ["blocked-players"] }); setOpen(false); }, onError: (e: Error) => toast({ title: "Report submission failed", description: e.message, variant: "destructive" }) });
  const canSubmit = !!category && description.trim().length >= 10 && accurate;
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild>{trigger}</DialogTrigger><DialogContent><DialogHeader><DialogTitle>Report {playerName}</DialogTitle><DialogDescription>Reporting sends information to moderators. Blocking is optional and separate.</DialogDescription></DialogHeader><div className="space-y-3"><div><Label>Report category</Label><Select value={category} onValueChange={(v) => setCategory(v as ReportCategory)}><SelectTrigger><SelectValue placeholder="Choose a category" /></SelectTrigger><SelectContent>{REPORT_CATEGORY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></div>{selected?.emergency && <Alert><AlertDescription>{EMERGENCY_SAFETY_COPY}</AlertDescription></Alert>}<div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value.replace(/[<>]/g, ""))} maxLength={2000} aria-describedby="report-description-help" /><p id="report-description-help" className="text-xs text-muted-foreground">10–2,000 characters. Do not include unnecessary personal information.</p></div><label className="flex items-center gap-2 text-sm"><Checkbox checked={accurate} onCheckedChange={(v) => setAccurate(v === true)} /> I confirm this report is accurate.</label><label className="flex items-center gap-2 text-sm"><Checkbox checked={blockAfter} onCheckedChange={(v) => setBlockAfter(v === true)} /> Also block this player after reporting.</label></div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={() => mutation.mutate()} disabled={!canSubmit || mutation.isPending}>{mutation.isPending ? "Submitting…" : "Submit report"}</Button></DialogFooter></DialogContent></Dialog>;
}
