import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useJoinParty } from "@/hooks/useParties";
import type { PoliticalParty } from "@/types/political-party";

interface Props {
  party: PoliticalParty | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function JoinPartyDialog({ party, open, onOpenChange }: Props) {
  const join = useJoinParty();
  if (!party) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: party.colour_hex }} />
            Join {party.name}?
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm">{party.description}</p>
        <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-5">
          {[party.belief_1, party.belief_2, party.belief_3, party.belief_4, party.belief_5]
            .filter(Boolean)
            .map((b, i) => (
              <li key={i}>{b}</li>
            ))}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => join.mutate(party.id, { onSuccess: () => onOpenChange(false) })}
            disabled={join.isPending}
          >
            {join.isPending ? "Joining…" : "Join Party"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
