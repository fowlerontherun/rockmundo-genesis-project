import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { termsChanged, type FestivalTerms } from "../bookingTypes";
import { useStableMutationIdempotencyKey } from "../useStableMutationIdempotencyKey";
export function CounterOfferDialog({
  open,
  onOpenChange,
  terms,
  revision,
  onSubmit,
  isPending = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  terms: FestivalTerms;
  revision: number;
  onSubmit: (terms: FestivalTerms, summary: string, key: string) => void;
  isPending?: boolean;
}) {
  const [draft, setDraft] = useState<FestivalTerms>(terms);
  const [summary, setSummary] = useState("");
  const idem = useStableMutationIdempotencyKey(
    "counter-offer",
    String(revision),
    JSON.stringify(draft),
  );
  const changed = termsChanged(terms, draft);
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) idem.cancel();
        onOpenChange(v);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Counter-offer revision {revision}</DialogTitle>
          <DialogDescription>
            Edit at least one material term. Your input is preserved if the
            server reports a stale revision.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Label>
            Guarantee cents
            <Input
              inputMode="numeric"
              value={draft.guarantee_fee_cents ?? 0}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  guarantee_fee_cents: Number(e.target.value),
                })
              }
            />
          </Label>
          <Label>
            Deposit cents
            <Input
              inputMode="numeric"
              value={draft.deposit_cents ?? 0}
              onChange={(e) =>
                setDraft({ ...draft, deposit_cents: Number(e.target.value) })
              }
            />
          </Label>
          <Label>
            Duration minutes
            <Input
              inputMode="numeric"
              value={draft.set_duration_minutes ?? 45}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  set_duration_minutes: Number(e.target.value),
                })
              }
            />
          </Label>
          <Label>
            Change summary
            <Textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </Label>
          {!changed ? (
            <p role="alert" className="text-sm text-destructive">
              Change at least one term before submitting a counter-offer.
            </p>
          ) : (
            <p className="text-sm text-emerald-600">
              Changed terms will be highlighted in revision history after
              submit.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!changed || isPending}
            onClick={() => onSubmit(draft, summary, idem.idempotencyKey)}
          >
            Submit counter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
