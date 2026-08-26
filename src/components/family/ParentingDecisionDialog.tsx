import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Check, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  useChildParentingDecisions,
  useProposeChildParentingDecision,
  useRespondChildParentingDecision,
  type ParentingDecisionType,
} from "@/hooks/useChildParentingDecisions";

const DECISIONS: Record<ParentingDecisionType, { label: string; options: string[] }> = {
  upbringing_focus: { label: "Upbringing focus", options: ["balanced", "artistic", "academic", "athletic", "social"] },
  schooling_focus: { label: "Schooling focus", options: ["balanced", "creative", "academic", "practical", "social"] },
  mentor_focus: { label: "Mentor focus", options: ["none", "music", "performance", "songwriting", "technical", "wellbeing"] },
  life_event_choice: { label: "Life-event approach", options: ["supportive", "structured", "independent", "protective"] },
};

interface Props {
  childId: string;
  childName: string;
  currentProfileId?: string | null;
}

export function ParentingDecisionDialog({ childId, childName, currentProfileId }: Props) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ParentingDecisionType>("upbringing_focus");
  const [value, setValue] = useState("balanced");
  const [note, setNote] = useState("");
  const { data = [], isLoading } = useChildParentingDecisions(open ? childId : undefined);
  const propose = useProposeChildParentingDecision(childId);
  const respond = useRespondChildParentingDecision(childId);

  const pendingForOtherParent = useMemo(
    () => data.filter((item) => item.status === "pending" && item.proposed_by_profile_id !== currentProfileId),
    [data, currentProfileId],
  );

  const options = DECISIONS[type].options;

  function chooseType(next: ParentingDecisionType) {
    setType(next);
    setValue(DECISIONS[next].options[0]);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" onClick={(event) => event.stopPropagation()}>
          <Users className="h-3.5 w-3.5 mr-1" /> Parenting
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg" onClick={(event) => event.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Parenting decisions · {childName}</DialogTitle>
          <DialogDescription>
            Shared choices require the other parent to agree before they affect guidance. Every response is retained in the family history.
          </DialogDescription>
        </DialogHeader>

        {pendingForOtherParent.length > 0 && (
          <div className="space-y-2 rounded-lg border p-3">
            <p className="text-sm font-semibold">Waiting for your response</p>
            {pendingForOtherParent.map((decision) => (
              <div key={decision.id} className="rounded-md bg-muted/40 p-2 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium">{DECISIONS[decision.decision_type]?.label ?? decision.decision_type}</span>
                  <Badge variant="outline" className="text-[10px]">Pending</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Proposed: {String((decision.proposal as any)?.value ?? "choice")}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" className="h-7" disabled={respond.isPending} onClick={() => respond.mutate({ decisionId: decision.id, accept: true })}>
                    <Check className="h-3.5 w-3.5 mr-1" /> Agree
                  </Button>
                  <Button size="sm" variant="outline" className="h-7" disabled={respond.isPending} onClick={() => respond.mutate({ decisionId: decision.id, accept: false })}>
                    <X className="h-3.5 w-3.5 mr-1" /> Decline
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Decision</Label>
            <Select value={type} onValueChange={(next) => chooseType(next as ParentingDecisionType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(DECISIONS).map(([key, config]) => <SelectItem key={key} value={key}>{config.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Choice</Label>
            <Select value={value} onValueChange={setValue}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{options.map((option) => <SelectItem key={option} value={option}>{option.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Context for your co-parent (optional)</Label>
            <Textarea value={note} maxLength={300} onChange={(event) => setNote(event.target.value)} placeholder="Why this choice suits your child…" />
          </div>
          <Button
            disabled={propose.isPending}
            onClick={() => propose.mutate({ decisionType: type, proposal: { value, note: note.trim() || null } }, { onSuccess: () => setNote("") })}
          >
            Propose shared decision
          </Button>
        </div>

        <div className="space-y-2 border-t pt-3">
          <p className="text-sm font-semibold">Decision history</p>
          {isLoading && <Skeleton className="h-12 w-full" />}
          {!isLoading && data.length === 0 && <p className="text-xs text-muted-foreground">No shared parenting decisions yet.</p>}
          <div className="max-h-40 overflow-y-auto space-y-1.5">
            {data.slice(0, 12).map((decision) => (
              <div key={decision.id} className="flex items-start justify-between gap-2 text-xs">
                <div>
                  <span className="font-medium">{DECISIONS[decision.decision_type]?.label ?? decision.decision_type}</span>
                  <span className="text-muted-foreground"> · {String((decision.proposal as any)?.value ?? "choice")}</span>
                  <div className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(decision.created_at), { addSuffix: true })}</div>
                </div>
                <Badge variant={decision.status === "applied" ? "secondary" : "outline"} className="text-[10px]">{decision.status}</Badge>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
