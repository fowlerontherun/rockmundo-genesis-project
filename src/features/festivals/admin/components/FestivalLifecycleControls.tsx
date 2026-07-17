import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { transitionAdminFestivalEdition } from "../service";
import { useAdminFestivalLifecycleOptions } from "../hooks";
import { festivalAdminQueryKeys } from "../queryKeys";
import type { FestivalLifecycleState } from "../types";

export function FestivalLifecycleControls({
  editionId,
  status,
}: {
  editionId?: string;
  status?: FestivalLifecycleState | null;
}) {
  const qc = useQueryClient();
  const [target, setTarget] = useState<FestivalLifecycleState | "">("");
  const [reason, setReason] = useState("");
  const lifecycleOptions = useAdminFestivalLifecycleOptions(editionId);
  const transitionKey = useMemo(() => target ? `lifecycle:${editionId}:${target}` : "", [editionId, target]);
  const mutation = useMutation({
    mutationFn: () =>
      transitionAdminFestivalEdition(
        editionId as string,
        target as FestivalLifecycleState,
        reason,
        false,
        transitionKey,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: festivalAdminQueryKeys.catalogue });
      if (editionId) {
        qc.invalidateQueries({
          queryKey: festivalAdminQueryKeys.operations("admin", editionId),
        });
        qc.invalidateQueries({
          queryKey: ["festivals", "admin", "lifecycle-options", editionId],
        });
      }
      setReason("");
      setTarget("");
    },
  });
  if (!editionId || !status)
    return (
      <Card>
        <CardHeader>
          <CardTitle>Lifecycle controls</CardTitle>
          <CardDescription>
            Select an edition to see available transitions.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  const options = (lifecycleOptions.data?.transitions ?? []).filter((option) => option.available);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Lifecycle controls</CardTitle>
        <CardDescription>
          Current status is {status}. Transitions are submitted through the
          canonical server transition service.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <Label>
            Next status
            <Select
              value={target}
              onValueChange={(v) => setTarget(v as FestivalLifecycleState)}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    options.length
                      ? "Choose next status"
                      : "No standard transition available"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {options.map((option) => (
                  <SelectItem key={option.targetState} value={option.targetState}>
                    {option.targetState.replaceAll("_", " ")}
                    {option.confirmationRequired ? " (confirmation required)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Label>
          <Label>
            Administrator reason
            <Input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Reason required for audit history"
            />
          </Label>
        </div>
        {lifecycleOptions.isLoading && (
          <p className="text-sm text-muted-foreground">Loading server-projected lifecycle options…</p>
        )}
        {lifecycleOptions.error && (
          <p className="text-sm text-destructive">Lifecycle options could not be loaded from the server.</p>
        )}
        {options.length === 0 && !lifecycleOptions.isLoading && (
          <p className="text-sm text-muted-foreground">
            The server currently exposes no standard forward transition from this state.
          </p>
        )}
        {mutation.error && (
          <p className="text-sm text-destructive">
            The lifecycle transition could not be completed. No records were
            changed.
          </p>
        )}
        <Button
          disabled={!target || !reason.trim() || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "Updating…" : "Apply lifecycle transition"}
        </Button>
      </CardContent>
    </Card>
  );
}
