import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Heart, Sparkles } from "lucide-react";
import { WEDDING_TIERS, calcWeddingCostCents, usePlanWedding } from "@/hooks/useWeddings";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  marriageId: string;
}

export function WeddingPlannerDialog({ open, onOpenChange, marriageId }: Props) {
  const [tier, setTier] = useState<string>("small");
  const [guests, setGuests] = useState(50);
  const [theme, setTheme] = useState("");
  const [venue, setVenue] = useState("");
  const [date, setDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10);
  });
  const plan = usePlanWedding();
  const cost = useMemo(() => calcWeddingCostCents(tier, guests), [tier, guests]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Heart className="h-5 w-5 text-social-love" /> Plan your wedding</DialogTitle>
          <DialogDescription>Pick venue, guests, and date. Cost is split 50/50 between partners.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Ceremony tier</Label>
            <Select value={tier} onValueChange={setTier}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {WEDDING_TIERS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label} (~${(t.baseCost / 100).toLocaleString()})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Guests</Label>
              <Input type="number" min={0} max={1000} value={guests} onChange={(e) => setGuests(Number(e.target.value || 0))} />
            </div>
            <div>
              <Label>Ceremony date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Venue name</Label>
            <Input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="e.g. Sunset Chapel" />
          </div>
          <div>
            <Label>Theme</Label>
            <Input value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="e.g. Rockstar Glam" />
          </div>
          <div className="text-sm flex items-center gap-2 p-3 rounded bg-muted">
            <Sparkles className="h-4 w-4 text-social-love" />
            Estimated cost: <span className="font-semibold">${(cost / 100).toLocaleString()}</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={plan.isPending}
            onClick={() => plan.mutate(
              { marriageId, tier, guestCount: guests, theme, venueName: venue, ceremonyAt: new Date(date).toISOString() },
              { onSuccess: () => onOpenChange(false) }
            )}
            className="bg-social-love hover:bg-social-love/90 text-white"
          >Book wedding</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
