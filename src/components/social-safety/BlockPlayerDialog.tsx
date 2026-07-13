import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { blockPlayer } from "@/services/social-safety/PlayerBlockService";
import { BLOCK_CONFIRMATION_COPY, BLOCK_REASON_OPTIONS, type BlockReasonCategory } from "@/services/social-safety/config";

export function BlockPlayerDialog({ targetProfileId, playerName, trigger }: { targetProfileId: string; playerName: string; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<BlockReasonCategory | "">("");
  const [note, setNote] = useState("");
  const qc = useQueryClient();
  const { toast } = useToast();
  const mutation = useMutation({
    mutationFn: () => blockPlayer({ targetProfileId, reasonCategory: reason || null, privateNote: note }),
    onSuccess: () => {
      toast({ title: "Player blocked", description: "Direct social interaction is now restricted." });
      qc.invalidateQueries({ queryKey: ["friendship-status"] });
      qc.invalidateQueries({ queryKey: ["player-search"] });
      qc.invalidateQueries({ queryKey: ["social-permission", targetProfileId] });
      qc.invalidateQueries({ queryKey: ["blocked-players"] });
      setOpen(false);
    },
    onError: (e: Error) => toast({ title: "Block failed", description: e.message, variant: "destructive" }),
  });
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild>{trigger}</DialogTrigger><DialogContent aria-describedby="block-player-description"><DialogHeader><DialogTitle>Block {playerName}?</DialogTitle><DialogDescription id="block-player-description">{BLOCK_CONFIRMATION_COPY}</DialogDescription></DialogHeader><div className="space-y-3"><div><Label>Private reason (optional)</Label><Select value={reason} onValueChange={(v) => setReason(v as BlockReasonCategory)}><SelectTrigger><SelectValue placeholder="Select a reason" /></SelectTrigger><SelectContent>{BLOCK_REASON_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></div><div><Label>Private note (optional)</Label><Textarea maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Only you and authorised moderators can see this." /></div></div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button variant="destructive" onClick={() => mutation.mutate()} disabled={mutation.isPending}>{mutation.isPending ? "Blocking…" : "Block player"}</Button></DialogFooter></DialogContent></Dialog>;
}
