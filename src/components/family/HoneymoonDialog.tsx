import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plane } from "lucide-react";
import { HONEYMOON_TIERS, usePlanHoneymoon } from "@/hooks/useHoneymoons";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  marriageId: string;
}

export function HoneymoonDialog({ open, onOpenChange, marriageId }: Props) {
  const [tier, setTier] = useState<string>("standard");
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10);
  });
  const plan = usePlanHoneymoon();
  const cfg = HONEYMOON_TIERS.find((t) => t.value === tier)!;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Plane className="h-5 w-5 text-social-love" /> Book honeymoon</DialogTitle>
          <DialogDescription>Pick a destination and package. Blocks other activities for the duration.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Package</Label>
            <Select value={tier} onValueChange={setTier}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {HONEYMOON_TIERS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label} — {t.days}d, ${(t.baseCost / 100).toLocaleString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Destination</Label>
            <Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="e.g. Maldives" />
          </div>
          <div>
            <Label>Departure date</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="text-xs text-muted-foreground">
            Returns in {cfg.days} days. Cost ${(cfg.baseCost / 100).toLocaleString()}.
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={plan.isPending}
            onClick={() => plan.mutate(
              { marriageId, tier, destinationName: destination, startsAt: new Date(startDate).toISOString() },
              { onSuccess: () => onOpenChange(false) }
            )}
            className="bg-social-love hover:bg-social-love/90 text-white"
          >Book honeymoon</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
