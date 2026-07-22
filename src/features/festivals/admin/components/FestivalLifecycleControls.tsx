import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { transitionAdminFestivalEdition } from "../service";
import { useAdminFestivalLifecycleOptions } from "../hooks";
import { festivalAdminQueryKeys } from "../queryKeys";
import type { FestivalLifecycleState, FestivalLifecycleTransitionOption } from "../types";

const newOperationKey = () => crypto.randomUUID();

export function FestivalLifecycleControls({
  editionId,
  status,
}: {
  editionId?: string;
  status?: FestivalLifecycleState | null;
}) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<FestivalLifecycleTransitionOption | null>(null);
  const [reason, setReason] = useState("");
  const [override, setOverride] = useState(false);
  const [typedConfirmation, setTypedConfirmation] = useState("");
  const [operationKey, setOperationKey] = useState(newOperationKey);
  const lifecycleOptions = useAdminFestivalLifecycleOptions(editionId);

  const resetAttempt = () => {
    setSelected(null);
    setReason("");
    setOverride(false);
    setTypedConfirmation("");
    setOperationKey(newOperationKey());
  };

  const mutation = useMutation({
    mutationFn: () =>
      transitionAdminFestivalEdition(
        editionId as string,
        selected?.targetState as FestivalLifecycleState,
        reason,
        override,
        operationKey,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: festivalAdminQueryKeys.catalogue });
      if (editionId) {
        qc.invalidateQueries({ queryKey: festivalAdminQueryKeys.operations("admin", editionId) });
        qc.invalidateQueries({ queryKey: festivalAdminQueryKeys.operations("owner", editionId) });
        qc.invalidateQueries({ queryKey: ["festivals", "admin", "lifecycle-options", editionId] });
      }
      resetAttempt();
    },
  });

  const options = lifecycleOptions.data?.transitions ?? [];
  const confirmationWord = selected?.targetState.replaceAll("_", " ") ?? "";
  const reasonNeeded = Boolean(selected?.reasonRequired || override);
  const destructiveConfirmed = selected?.severity !== "destructive" || typedConfirmation === confirmationWord;
  const canSubmit = Boolean(
    selected &&
      selected.available &&
      (!reasonNeeded || reason.trim()) &&
      (!override || selected.adminOverrideAllowed) &&
      destructiveConfirmed &&
      !mutation.isPending,
  );

  const selectedTitle = useMemo(
    () => selected?.targetState.replaceAll("_", " ") ?? "",
    [selected],
  );

  if (!editionId || !status)
    return (
      <Card>
        <CardHeader>
          <CardTitle>Lifecycle controls</CardTitle>
          <CardDescription>Select an edition to see available transitions.</CardDescription>
        </CardHeader>
      </Card>
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lifecycle controls</CardTitle>
        <CardDescription>
          Current status is {status}. Server-projected transitions, blockers,
          confirmations and overrides are shown before submission.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {lifecycleOptions.isLoading && <p className="text-sm text-muted-foreground">Loading server-projected lifecycle options…</p>}
        {lifecycleOptions.error && <p className="text-sm text-destructive">Lifecycle options could not be loaded from the server.</p>}
        <div className="grid gap-3 md:grid-cols-2">
          {options.map((option) => (
            <button
              key={option.targetState}
              type="button"
              disabled={!option.available}
              onClick={() => {
                setSelected(option);
                setReason("");
                setOverride(false);
                setTypedConfirmation("");
                setOperationKey(newOperationKey());
              }}
              className={`rounded border p-3 text-left ${option.available ? "hover:bg-muted" : "opacity-70"} ${option.severity === "destructive" ? "border-destructive" : option.severity === "warning" ? "border-amber-500" : ""}`}
            >
              <div className="font-medium capitalize">{option.targetState.replaceAll("_", " ")}</div>
              <p className="text-sm text-muted-foreground">{option.explanation}</p>
              {option.blockers.length > 0 && <p className="mt-2 text-sm text-destructive">Blockers: {option.blockers.join(", ")}</p>}
              {option.warnings.length > 0 && <p className="mt-2 text-sm text-amber-600">Warnings: {option.warnings.join(", ")}</p>}
              {option.confirmationRequired && <p className="mt-2 text-xs uppercase tracking-wide">Confirmation required</p>}
            </button>
          ))}
        </div>
        {mutation.error && <p className="text-sm text-destructive">The lifecycle transition could not be completed. No records were changed.</p>}
      </CardContent>
      <AlertDialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) resetAttempt(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Confirm lifecycle transition
            </AlertDialogTitle>
            <AlertDialogDescription>
              Move this edition from {status} to {selectedTitle}. {selected?.explanation}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 text-sm">
            {selected?.warnings.map((warning) => <p key={warning} className="text-amber-600">Warning: {warning}</p>)}
            {selected?.blockers.map((blocker) => <p key={blocker} className="text-destructive">Blocker: {blocker}</p>)}
            {selected?.adminOverrideAllowed && (
              <Label className="flex items-center gap-2">
                <Checkbox checked={override} onCheckedChange={(checked) => setOverride(Boolean(checked))} />
                Use administrator override
              </Label>
            )}
            {(reasonNeeded || selected?.confirmationRequired) && (
              <Label>
                Reason{reasonNeeded ? " (required)" : ""}
                <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain the lifecycle decision" />
              </Label>
            )}
            {selected?.severity === "destructive" && (
              <Label>
                Type “{confirmationWord}” to confirm
                <Input value={typedConfirmation} onChange={(event) => setTypedConfirmation(event.target.value)} />
              </Label>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={!canSubmit} onClick={(event) => { event.preventDefault(); mutation.mutate(); }}>
              {mutation.isPending ? "Updating…" : override ? "Confirm override" : "Confirm transition"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
