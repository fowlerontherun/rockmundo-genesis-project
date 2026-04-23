import { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Rocket } from "lucide-react";
import { PROMOTE_TIERS, useTwaaterPromote } from "@/hooks/useTwaaterPromote";

interface PromoteTwaatDialogProps {
  twaatId: string;
  trigger?: React.ReactNode;
}

export const PromoteTwaatDialog = ({ twaatId, trigger }: PromoteTwaatDialogProps) => {
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState<1 | 6 | 24>(6);
  const promote = useTwaaterPromote();

  const handlePromote = () => {
    promote.mutate(
      { twaatId, hours },
      { onSuccess: () => setOpen(false) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="sm" className="hover:text-amber-500">
            <Rocket className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-amber-500" />
            Promote this Twaat
          </DialogTitle>
          <DialogDescription>
            Boosted twaats appear in more feeds and rank higher in Trending until the boost expires.
          </DialogDescription>
        </DialogHeader>
        <RadioGroup
          value={String(hours)}
          onValueChange={(v) => setHours(Number(v) as 1 | 6 | 24)}
          className="space-y-2"
        >
          {PROMOTE_TIERS.map((tier) => (
            <Label
              key={tier.hours}
              htmlFor={`tier-${tier.hours}`}
              className="flex items-center justify-between border rounded-md p-3 cursor-pointer hover:bg-accent"
            >
              <div className="flex items-center gap-3">
                <RadioGroupItem value={String(tier.hours)} id={`tier-${tier.hours}`} />
                <div>
                  <div className="font-medium">{tier.label}</div>
                  <div className="text-xs text-muted-foreground">
                    Boosted visibility window
                  </div>
                </div>
              </div>
              <div className="font-semibold">${tier.cost.toLocaleString()}</div>
            </Label>
          ))}
        </RadioGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={handlePromote}
            disabled={promote.isPending}
            style={{ backgroundColor: "hsl(var(--twaater-purple))" }}
          >
            {promote.isPending ? "Promoting..." : "Promote"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
