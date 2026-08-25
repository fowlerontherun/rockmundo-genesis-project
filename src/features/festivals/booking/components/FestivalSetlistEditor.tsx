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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  calculateTotalDuration,
  mapBookingError,
  validateFestivalSetlist,
  type FestivalSetlistItemInput,
} from "../bookingTypes";
import {
  useFestivalContractRepertoire,
  useFestivalSetlist,
  useFestivalSetlistPreflight,
} from "../hooks";
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
  const repertoire = useFestivalContractRepertoire(contract.id);
  const preflight = useFestivalSetlistPreflight(contract.id, items);
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
  const preflightBlocked = preflight.data?.outcome === "blocked";
  const canPersist = validation.valid && !preflightBlocked && !preflight.isError;
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

  const remove = (index: number) =>
    setItems(items.filter((_, itemIndex) => itemIndex !== index));

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
        {repertoire.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading band repertoire…</p>
        ) : repertoire.isError ? (
          <p role="alert" className="text-sm text-destructive">
            The band repertoire could not be loaded. Setlist changes are disabled
            until it is available.
          </p>
        ) : null}

        <div className="space-y-2">
          {items.map((item, index) => {
            const selectedSong = (repertoire.data ?? []).find(
              (song) => song.songId === item.song_id,
            );
            return (
              <div
                key={`${item.song_id}-${index}`}
                className="grid gap-2 rounded border p-2 sm:grid-cols-[minmax(0,1fr)_7rem_minmax(0,1fr)_auto]"
              >
                <Select
                  disabled={readOnly || repertoire.isLoading || repertoire.isError}
                  value={item.song_id || undefined}
                  onValueChange={(songId) => {
                    const song = (repertoire.data ?? []).find(
                      (candidate) => candidate.songId === songId,
                    );
                    setItems(
                      items.map((it, i) =>
                        i === index
                          ? {
                              ...it,
                              song_id: songId,
                              planned_duration_seconds:
                                song?.durationSeconds ??
                                it.planned_duration_seconds,
                            }
                          : it,
                      ),
                    );
                  }}
                >
                  <SelectTrigger aria-label={`Song ${index + 1}`}>
                    <SelectValue placeholder="Select a repertoire song" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedSong ? null : item.song_id ? (
                      <SelectItem value={item.song_id} disabled>
                        Existing song ({item.song_id.slice(0, 8)}…)
                      </SelectItem>
                    ) : null}
                    {(repertoire.data ?? []).map((song) => (
                      <SelectItem
                        key={song.songId}
                        value={song.songId}
                        disabled={Boolean(song.unavailableReason)}
                      >
                        {song.title}
                        {song.genre ? ` · ${song.genre}` : ""}
                        {song.durationSeconds
                          ? ` · ${Math.round(song.durationSeconds / 60)} min`
                          : ""}
                        {song.unavailableReason
                          ? ` · unavailable: ${song.unavailableReason}`
                          : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  aria-label={`Planned duration for song ${index + 1}`}
                  disabled={readOnly}
                  inputMode="numeric"
                  min={1}
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
                  aria-label={`Performance notes for song ${index + 1}`}
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
                  <Button
                    aria-label="Remove song"
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={readOnly}
                    onClick={() => remove(index)}
                  >
                    ×
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {!readOnly ? (
          <Button
            variant="outline"
            size="sm"
            disabled={repertoire.isLoading || repertoire.isError}
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
            Add repertoire song
          </Button>
        ) : null}

        {validation.warnings.map((warning) => (
          <p role="alert" key={warning} className="text-sm text-amber-600">
            {warning}
          </p>
        ))}
        {preflight.isFetching ? (
          <p className="text-sm text-muted-foreground">
            Checking repertoire, duration and availability…
          </p>
        ) : null}
        {preflight.isError ? (
          <p role="alert" className="text-sm text-destructive">
            The authoritative setlist preflight could not be loaded. Saving is
            disabled until the check succeeds.
          </p>
        ) : null}
        {(preflight.data?.blockingReasons ?? []).map((blocker) => (
          <p role="alert" key={blocker} className="text-sm text-destructive">
            {blocker}
          </p>
        ))}
        {(preflight.data?.warnings ?? []).map((warning) => (
          <p role="alert" key={warning} className="text-sm text-amber-600">
            {warning}
          </p>
        ))}
        {(preflight.data?.readinessWarnings ?? []).map((warning) => (
          <p role="alert" key={warning} className="text-sm text-amber-600">
            {warning}
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
              disabled={!canPersist || saveDraft.isPending}
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
              disabled={!canPersist || contract.status !== "active"}
              onClick={() =>
                submitSetlist.mutate(
                  {
                    setlistId: current.id ?? "",
                    idempotencyKey: submitKey.idempotencyKey,
                  },
                  {
                    onSuccess: () => submitKey.markSucceeded(),
                    onError: (e) => toast.error(mapBookingError(e).message),
                  },
                )
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
