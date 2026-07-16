import { useMemo, useState } from "react";
import { toast } from "sonner";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useFestivalApplicationActions,
  useFestivalApplications,
} from "../hooks";
import { mapBookingError } from "../bookingTypes";
import type {
  PublicFestivalEdition,
  RepresentedBandOption,
} from "../domainTypes";
import { editionCurrency } from "../formatting";
import { useStableMutationIdempotencyKey } from "../useStableMutationIdempotencyKey";
export function FestivalApplicationDialog({
  edition,
  bandId,
  bands,
  open,
  onOpenChange,
}: {
  edition: PublicFestivalEdition | null;
  bandId?: string;
  bands?: RepresentedBandOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const eligible = bands?.filter((b) => b.canApply) ?? [];
  const initialBand = bandId ?? (eligible.length === 1 ? eligible[0].id : "");
  const [selectedBand, setSelectedBand] = useState(initialBand);
  const [message, setMessage] = useState("");
  const [fee, setFee] = useState("");
  const [duration, setDuration] = useState("45");
  const [slot, setSlot] = useState("main");
  const currency = editionCurrency(edition ?? undefined);
  const fingerprint = JSON.stringify({
    selectedBand,
    message,
    fee,
    duration,
    slot,
    currency,
  });
  const idem = useStableMutationIdempotencyKey(
    "festival-application",
    edition?.id ?? "new",
    fingerprint,
  );
  const { data: applications = [] } = useFestivalApplications(
    selectedBand,
    edition?.id,
  );
  const { submitApplication } = useFestivalApplicationActions(
    selectedBand,
    edition?.id,
  );
  const existing = applications.find(
    (a) => !["withdrawn", "rejected", "expired"].includes(a.status),
  );
  const errors = useMemo(() => {
    const e: string[] = [];
    if (!selectedBand) e.push("Choose a band.");
    if (message.length > 1000)
      e.push("Message must be 1000 characters or fewer.");
    if (Number(fee) < 0) e.push("Requested fee cannot be negative.");
    if (!currency || currency === "XXX")
      e.push("No supported currency is configured for this edition.");
    if (Number(duration) < 15 || Number(duration) > 180)
      e.push("Set duration must be between 15 and 180 minutes.");
    if (existing)
      e.push(
        `This band already has an active application (${existing.status}).`,
      );
    if (
      edition &&
      !["accepting_applications", "booking", "announced", "on_sale"].includes(
        edition.status ?? "",
      )
    )
      e.push("The application window is not open.");
    return e;
  }, [currency, duration, edition, existing, message.length, selectedBand]);
  const submit = async () => {
    if (!edition || errors.length) return;
    try {
      await submitApplication.mutateAsync({
        editionId: edition.id,
        bandId: selectedBand,
        idempotencyKey: idem.idempotencyKey,
        details: {
          message,
          guarantee_fee_cents: Math.round(Number(fee || 0) * 100),
          currency_code: currency,
          set_duration_minutes: Number(duration),
          proposed_slot_type: slot,
        },
      });
      toast.success("Application submitted");
      idem.markSucceeded();
      setMessage("");
      setFee("");
      setDuration("45");
      setSlot("main");
      onOpenChange(false);
    } catch (e) {
      const mapped = mapBookingError(e);
      console.error(mapped.code, e);
      toast.error(mapped.message);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) idem.cancel();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Apply to {edition?.title ?? "festival"}</DialogTitle>
          <DialogDescription>
            Canonical applications do not confirm a schedule until an offer is
            accepted and a contract is signed.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Label>
            Band
            <select
              className="mt-1 w-full rounded-md border bg-background p-2"
              value={selectedBand}
              onChange={(e) => setSelectedBand(e.target.value)}
            >
              {!selectedBand ? <option value="">Choose band</option> : null}
              {(bands?.length
                ? bands
                : [
                    {
                      id: selectedBand,
                      name: selectedBand || "Selected band",
                      role: "member",
                      canApply: Boolean(selectedBand),
                    },
                  ]
              ).map((b) => (
                <option key={b.id} value={b.id} disabled={!b.canApply}>
                  {b.name} — {b.role}
                  {b.existingApplicationStatus
                    ? ` — ${b.existingApplicationStatus}`
                    : ""}
                </option>
              ))}
            </select>
          </Label>
          <Label>
            Message
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </Label>
          <div className="grid gap-3 sm:grid-cols-2">
            <Label>
              Requested fee ({currency})
              <Input
                inputMode="decimal"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
              />
            </Label>
            <Label>
              Set duration (minutes)
              <Input
                inputMode="numeric"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </Label>
          </div>
          <Label>
            Preferred slot
            <Input value={slot} onChange={(e) => setSlot(e.target.value)} />
          </Label>
          {errors.length ? (
            <div
              role="alert"
              className="rounded border border-destructive/40 p-2 text-sm"
            >
              {errors.map((e) => (
                <p key={e}>{e}</p>
              ))}
            </div>
          ) : (
            <p className="text-sm text-emerald-600">
              Server-backed eligibility will be checked when submitted.
            </p>
          )}
        </div>
        <DialogFooter className="sticky bottom-0 bg-background pt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={errors.length > 0 || submitApplication.isPending}
            onClick={submit}
          >
            {submitApplication.isPending ? "Submitting…" : "Submit application"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
