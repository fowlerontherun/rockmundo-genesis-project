import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  calculateTotalDuration,
  mapBookingError,
  validateFestivalSetlist,
  type FestivalSetlistItemInput,
} from "../bookingTypes";
import { useFestivalSetlist } from "../hooks";
import type { FestivalContractRecord } from "../domainTypes";
import { useStableMutationIdempotencyKey } from "../useStableMutationIdempotencyKey";
export function FestivalSetlistEditorCanonical({
  contract,
  organiser = false,
}: {
  contract: FestivalContractRecord;
  organiser?: boolean;
}) {
  const { saveDraft, submitSetlist, reviewSetlist, lockSetlist } =
    useFestivalSetlist(contract.id);
  const current = contract.current_setlist ??
    contract.setlist ?? {
      id: contract.setlist_id,
      status: "draft" as const,
      version: 0,
      items: [],
    };
  const [items, setItems] = useState<FestivalSetlistItemInput[]>(
    current.items ?? [],
  );
  const [reason, setReason] = useState("");
  const maxSeconds =
    Number(contract.terms_snapshot?.set_duration_minutes ?? 45) * 60;
  const validation = validateFestivalSetlist(items, maxSeconds);
  const readOnly = [
    "submitted",
    "approved",
    "locked",
    "performed",
    "cancelled",
  ].includes(current.status);
  const fp = JSON.stringify(items);
  const saveKey = useStableMutationIdempotencyKey(
    "save-setlist",
    contract.id,
    fp,
  );
  const submitKey = useStableMutationIdempotencyKey(
    "submit-setlist",
    current.id ?? "new",
  );
  const approveKey = useStableMutationIdempotencyKey(
    "approve-setlist",
    current.id ?? "new",
  );
  const changesKey = useStableMutationIdempotencyKey(
    "changes-setlist",
    current.id ?? "new",
    reason,
  );
  const lockKey = useStableMutationIdempotencyKey(
    "lock-setlist",
    current.id ?? "new",
  );
  const move = (i: number, d: number) => {
    const next = [...items];
    const [it] = next.splice(i, 1);
    next.splice(i + d, 0, it);
    setItems(next);
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Festival setlist</CardTitle>
        <CardDescription>
          Status {current.status} · version {current.version ?? 0} · total{" "}
          {Math.round(calculateTotalDuration(items) / 60)} min /{" "}
          {Math.round(maxSeconds / 60)} min
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          {items.map((item, index) => (
            <div
              key={`${item.song_id}-${index}`}
              className="grid gap-2 rounded border p-2 sm:grid-cols-[1fr_8rem_1fr_auto]"
            >
              <Input
                disabled={readOnly}
                value={item.song_id}
                onChange={(e) =>
                  setItems(
                    items.map((it, i) =>
                      i === index ? { ...it, song_id: e.target.value } : it,
                    ),
                  )
                }
                placeholder="Select song (UUID until repertoire selector is connected)"
              />
              <Input
                disabled={readOnly}
                inputMode="numeric"
                value={item.planned_duration_seconds}
                onChange={(e) =>
                  setItems(
                    items.map((it, i) =>
                      i === index
                        ? {
                            ...it,
                            planned_duration_seconds: Number(e.target.value),
                          }
                        : it,
                    ),
                  )
                }
              />
              <Input
                disabled={readOnly}
                value={item.performance_notes ?? ""}
                onChange={(e) =>
                  setItems(
                    items.map((it, i) =>
                      i === index
                        ? { ...it, performance_notes: e.target.value }
                        : it,
                    ),
                  )
                }
                placeholder="Notes"
              />
              <div className="flex gap-1">
                <Button
                  aria-label="Move song up"
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={readOnly || index === 0}
                  onClick={() => move(index, -1)}
                >
                  ↑
                </Button>
                <Button
                  aria-label="Move song down"
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={readOnly || index === items.length - 1}
                  onClick={() => move(index, 1)}
                >
                  ↓
                </Button>
              </div>
            </div>
          ))}
        </div>
        {!readOnly ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setItems([
                ...items,
                {
                  song_id: "",
                  planned_duration_seconds: 180,
                  is_encore: false,
                },
              ])
            }
          >
            Add song
          </Button>
        ) : null}
        {validation.warnings.map((w) => (
          <p role="alert" key={w} className="text-sm text-amber-600">
            {w}
          </p>
        ))}
        {current.change_reason ? (
          <p className="text-sm text-amber-600">
            Changes requested: {current.change_reason}
          </p>
        ) : null}
        <div className="sticky bottom-0 flex flex-wrap gap-2 bg-background pt-3">
          {!organiser && !readOnly ? (
            <Button
              size="sm"
              disabled={!validation.valid || saveDraft.isPending}
              onClick={() =>
                saveDraft.mutate(
                  {
                    contractId: contract.id,
                    expectedVersion: current.version ?? 0,
                    items,
                    idempotencyKey: saveKey.idempotencyKey,
                  },
                  {
                    onSuccess: () => {
                      saveKey.markSucceeded();
                      toast.success("Draft saved");
                    },
                    onError: (e) => toast.error(mapBookingError(e).message),
                  },
                )
              }
            >
              Save draft
            </Button>
          ) : null}
          {!organiser &&
          ["draft", "changes_requested"].includes(current.status) ? (
            <Button
              size="sm"
              disabled={!validation.valid || contract.status !== "active"}
              onClick={() =>
                submitSetlist.mutate({
                  setlistId: current.id ?? "",
                  idempotencyKey: submitKey.idempotencyKey,
                })
              }
            >
              Submit for review
            </Button>
          ) : null}
          {organiser && current.status === "submitted" ? (
            <>
              <Input
                className="max-w-sm"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for requested changes"
              />
              <Button
                size="sm"
                onClick={() =>
                  reviewSetlist.mutate({
                    setlistId: current.id ?? "",
                    action: "approve",
                    idempotencyKey: approveKey.idempotencyKey,
                  })
                }
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!reason}
                onClick={() =>
                  reviewSetlist.mutate({
                    setlistId: current.id ?? "",
                    action: "request_changes",
                    reason,
                    idempotencyKey: changesKey.idempotencyKey,
                  })
                }
              >
                Request changes
              </Button>
            </>
          ) : null}
          {organiser && current.status === "approved" ? (
            <Button
              size="sm"
              onClick={() =>
                lockSetlist.mutate({
                  setlistId: current.id ?? "",
                  idempotencyKey: lockKey.idempotencyKey,
                })
              }
            >
              Lock approved setlist
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
