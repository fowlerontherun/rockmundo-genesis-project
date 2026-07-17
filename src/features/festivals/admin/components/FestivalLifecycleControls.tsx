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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { transitionAdminFestivalEdition } from "../service";
import { festivalAdminQueryKeys } from "../queryKeys";
import type { FestivalLifecycleState } from "../types";

const nextStates: Record<string, FestivalLifecycleState[]> = {
  concept: ["planning"],
  planning: ["applications_open", "booking"],
  applications_open: ["booking"],
  booking: ["announced"],
  announced: ["on_sale", "setup"],
  on_sale: ["setup"],
  setup: ["live"],
  live: ["settling"],
  settling: ["completed"],
};
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
  const mutation = useMutation({
    mutationFn: () =>
      transitionAdminFestivalEdition(
        editionId as string,
        target as FestivalLifecycleState,
        reason,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: festivalAdminQueryKeys.catalogue });
      if (editionId)
        qc.invalidateQueries({
          queryKey: festivalAdminQueryKeys.operations("admin", editionId),
        });
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
  const options = nextStates[status] ?? [];
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
                {options.map((state) => (
                  <SelectItem key={state} value={state}>
                    {state.replaceAll("_", " ")}
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
        {options.length === 0 && (
          <p className="text-sm text-muted-foreground">
            This edition has no standard forward transition from its current
            state.
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
