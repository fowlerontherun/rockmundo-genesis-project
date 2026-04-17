import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Banknote } from "lucide-react";
import { useProposeMotion, useMayorPaySettings, useMyMayorSeat } from "@/hooks/useParliament";

/**
 * Convenience action on the Mayor Pay tab: proposes a `mayor_pay` motion
 * with a single-input new salary.
 */
export function QuickPayProposal() {
  const { data: seat } = useMyMayorSeat();
  const { data: settings } = useMayorPaySettings();
  const propose = useProposeMotion();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  if (!seat?.id) return null;

  const min = (settings?.min_salary ?? 500_000) / 100;
  const max = (settings?.max_salary ?? 5_000_000) / 100;

  const handleSubmit = () => {
    const dollars = parseFloat(amount);
    if (!Number.isFinite(dollars) || dollars < min || dollars > max) return;
    propose.mutate(
      {
        title: `Set weekly mayor salary to $${dollars.toLocaleString()}`,
        body:
          reason.trim() ||
          `A motion to adjust the global weekly mayor salary to $${dollars.toLocaleString()}.`,
        motion_type: "mayor_pay",
        payload: { weekly_salary_cents: Math.round(dollars * 100) },
        voting_days: 3,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setAmount("");
          setReason("");
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Banknote className="h-4 w-4 mr-1" /> Propose New Salary
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Propose Mayor Pay Change</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Proposed weekly salary ($)</Label>
            <Input
              type="number"
              min={min}
              max={max}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Range: ${min.toLocaleString()} – ${max.toLocaleString()}
            </p>
          </div>
          <div>
            <Label>Justification (optional)</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this change needed?"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!amount || propose.isPending}>
            {propose.isPending ? "Tabling…" : "Table Motion"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
