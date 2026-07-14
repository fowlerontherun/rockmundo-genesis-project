import { useState } from "react";
import { AlertTriangle, Ban, ShieldAlert, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { BLOCK_REASON_OPTIONS, REPORT_CATEGORIES, type BlockReasonCategory, type ReportCategory } from "@/services/socialSafety";
import { usePlayerBlockActions, useReportPlayer } from "@/hooks/useSocialSafety";

export function SafetyActions({ targetProfileId, targetName = "this player", isBlockedByViewer = false, compact = false }: { targetProfileId: string; targetName?: string; isBlockedByViewer?: boolean; compact?: boolean }) {
  const [blockOpen, setBlockOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState<BlockReasonCategory | "">("");
  const [note, setNote] = useState("");
  const [category, setCategory] = useState<ReportCategory | "">("");
  const [description, setDescription] = useState("");
  const [blockAfterReport, setBlockAfterReport] = useState(false);
  const actions = usePlayerBlockActions(targetProfileId);
  const report = useReportPlayer();
  const selectedCategory = REPORT_CATEGORIES.find((item) => item.value === category);
  const emergency = selectedCategory && "emergency" in selectedCategory ? selectedCategory.emergency : false;
  const submitReportDisabled = !category || description.trim().length < 10 || description.length > 2000 || report.isPending;

  return <>
    {isBlockedByViewer ? <Button size="sm" variant="outline" onClick={() => window.confirm("Unblock this player? Previous friendships and requests will not be restored.") && actions.unblock.mutate()} disabled={actions.unblock.isPending}><Undo2 className="mr-1 h-4 w-4" />Unblock player</Button> : <Button size="sm" variant={compact ? "outline" : "destructive"} onClick={() => setBlockOpen(true)} disabled={actions.block.isPending}><Ban className="mr-1 h-4 w-4" />Block player</Button>}
    <Button size="sm" variant="outline" onClick={() => setReportOpen(true)}><ShieldAlert className="mr-1 h-4 w-4" />Report</Button>
    <Dialog open={blockOpen} onOpenChange={setBlockOpen}><DialogContent aria-describedby="block-player-effects"><DialogHeader><DialogTitle>Block {targetName}?</DialogTitle><DialogDescription id="block-player-effects">Blocking removes any friendship, cancels pending requests, keeps both players out of social discovery, prevents direct social interaction, and does not notify the blocked player.</DialogDescription></DialogHeader><div className="space-y-3"><div className="space-y-1"><Label>Private reason (optional)</Label><Select value={reason} onValueChange={(value) => setReason(value as BlockReasonCategory)}><SelectTrigger><SelectValue placeholder="Choose a reason" /></SelectTrigger><SelectContent>{BLOCK_REASON_OPTIONS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1"><Label htmlFor="block-note">Private note (optional)</Label><Textarea id="block-note" maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Only you and authorised moderators can see this note." /></div></div><DialogFooter><Button variant="outline" onClick={() => setBlockOpen(false)}>Cancel</Button><Button variant="destructive" onClick={() => actions.block.mutate({ reasonCategory: reason || undefined, privateNote: note }, { onSuccess: () => setBlockOpen(false) })} disabled={actions.block.isPending}>Block player</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={reportOpen} onOpenChange={setReportOpen}><DialogContent aria-describedby="report-player-help"><DialogHeader><DialogTitle>Report {targetName}</DialogTitle><DialogDescription id="report-player-help">Reports are reviewed by moderation. Reporting is separate from blocking; the reported player is not told who reported them.</DialogDescription></DialogHeader><div className="space-y-3"><div className="space-y-1"><Label>Report category</Label><Select value={category} onValueChange={(value) => setCategory(value as ReportCategory)}><SelectTrigger><SelectValue placeholder="Choose a category" /></SelectTrigger><SelectContent>{REPORT_CATEGORIES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>{emergency && <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm"><AlertTriangle className="mr-2 inline h-4 w-4" />If anyone is in immediate danger, contact emergency services or local authorities. RockMundo moderation cannot provide emergency intervention.</div>}<div className="space-y-1"><Label htmlFor="report-description">Description</Label><Textarea id="report-description" minLength={10} maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe what happened. Do not include unnecessary sensitive personal information." /><p className="text-xs text-muted-foreground" aria-live="polite">{description.length}/2000 characters. Minimum 10.</p></div><label className="flex items-start gap-2 text-sm"><Checkbox checked={blockAfterReport} onCheckedChange={(checked) => setBlockAfterReport(Boolean(checked))} />Block this player after submitting the report.</label></div><DialogFooter><Button variant="outline" onClick={() => setReportOpen(false)}>Cancel</Button><Button onClick={() => report.mutate({ targetProfileId, category: category as ReportCategory, description, blockAfterReport, evidence: { targetName, capturedFrom: "player_profile" } }, { onSuccess: () => { setReportOpen(false); setDescription(""); setCategory(""); } })} disabled={submitReportDisabled}>Submit report</Button></DialogFooter></DialogContent></Dialog>
  </>;
}
