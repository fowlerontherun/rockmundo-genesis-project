import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Megaphone } from "lucide-react";
import { useNominateCandidate } from "@/hooks/useNominations";

interface Props {
  electionId: string;
  nomineeProfileId: string;
  nomineeName?: string;
}

export function NominateButton({ electionId, nomineeProfileId, nomineeName }: Props) {
  const nominate = useNominateCandidate();
  const [open, setOpen] = useState(false);
  const [slogan, setSlogan] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Megaphone className="h-4 w-4 mr-1" /> Nominate
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nominate {nomineeName ?? "this player"} for Mayor</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Your nomination will appear on the ballot once another player seconds it.
        </p>
        <div>
          <Label>Suggested campaign slogan (optional)</Label>
          <Textarea value={slogan} onChange={(e) => setSlogan(e.target.value)} maxLength={120} rows={2} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={() =>
              nominate.mutate(
                { election_id: electionId, nominee_profile_id: nomineeProfileId, campaign_slogan: slogan },
                { onSuccess: () => setOpen(false) }
              )
            }
            disabled={nominate.isPending}
          >
            {nominate.isPending ? "Submitting…" : "Submit Nomination"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
