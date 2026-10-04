import { AlertCircle, CheckCircle2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  LUTHIERY_PART_LABELS,
  LUTHIERY_PART_ORDER,
  createLuthieryBuildPreviewSpec,
  getLuthieryBuildReadiness,
  getMaterialOption,
  getShapeForSelection,
  type LuthieryBuildPreviewSpec,
  type LuthieryBuildSelection,
} from "@/data/luthieryWorkbench";
import type { CraftingMaterial, PlayerCraftingMaterial } from "@/hooks/useCraftingSystem";
import type { SkillProgressRecord } from "@/hooks/useSkillSystem.types";

interface LuthieryBuildReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selection: LuthieryBuildSelection;
  materialsCatalog: CraftingMaterial[];
  playerMaterials: PlayerCraftingMaterial[];
  progress: SkillProgressRecord[];
  onConfirm: (spec: LuthieryBuildPreviewSpec) => void;
}

export const LuthieryBuildReviewDialog = ({
  open,
  onOpenChange,
  selection,
  materialsCatalog,
  playerMaterials,
  progress,
  onConfirm,
}: LuthieryBuildReviewDialogProps) => {
  const readiness = getLuthieryBuildReadiness(selection, materialsCatalog, playerMaterials, progress);
  const shape = getShapeForSelection(selection);
  const finish = getMaterialOption(selection.finishId);
  const owned = (materialId: string) =>
    playerMaterials.find((item) => item.material_id === materialId)?.quantity ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review instrument build</DialogTitle>
          <DialogDescription>
            Check the five parts, finish, artwork and material stock before confirming this Phase 3 design.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 text-sm">
            <div className="rounded-md border border-border/60 p-3">
              <p className="text-xs text-muted-foreground">Instrument name</p>
              <p className="font-semibold">{selection.instrumentName.trim() || "Not named"}</p>
            </div>
            <div className="rounded-md border border-border/60 p-3">
              <p className="text-xs text-muted-foreground">Type / shape</p>
              <p className="font-semibold">
                {selection.instrumentKind === "electric_bass" ? "Electric Bass" : "Electric Guitar"} · {shape.name}
              </p>
            </div>
            <div className="rounded-md border border-border/60 p-3">
              <p className="text-xs text-muted-foreground">Finish</p>
              <p className="font-semibold">{finish?.label ?? "Unknown"}</p>
            </div>
            <div className="rounded-md border border-border/60 p-3">
              <p className="text-xs text-muted-foreground">Artwork</p>
              <p className="font-semibold capitalize">{selection.decal.id.replace(/-/g, " ")}</p>
            </div>
          </div>

          <div className="rounded-md border border-border/60">
            <div className="border-b border-border/60 px-3 py-2 text-xs font-semibold">Five-part specification</div>
            <div className="divide-y divide-border/60">
              {LUTHIERY_PART_ORDER.map((slot) => {
                const option = getMaterialOption(selection.parts[slot]);
                return (
                  <div key={slot} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span className="text-muted-foreground">{LUTHIERY_PART_LABELS[slot]}</span>
                    <span className="font-medium">{option?.label ?? "Invalid selection"}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-md border border-border/60">
            <div className="border-b border-border/60 px-3 py-2 text-xs font-semibold">Material check</div>
            <div className="divide-y divide-border/60">
              {readiness.requirements.map((requirement) => {
                const quantity = owned(requirement.material.id);
                const enough = quantity >= requirement.quantity;
                return (
                  <div key={requirement.material.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                    <div>
                      <p className="font-medium">{requirement.material.name}</p>
                      <p className="text-muted-foreground">{requirement.sources.join(" + ")}</p>
                    </div>
                    <Badge variant={enough ? "secondary" : "destructive"}>
                      {quantity} / {requirement.quantity}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>

          {readiness.blockers.length > 0 ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3" role="alert">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-destructive">
                <AlertCircle className="h-4 w-4" />
                Build is not ready
              </p>
              <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                {readiness.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
              </ul>
            </div>
          ) : (
            <div className="rounded-md border border-green-500/40 bg-green-500/10 p-3 text-sm" role="status">
              <p className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Design ready for crafting
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Confirming Phase 3 locks the reviewed design in the UI only. Material consumption and equipment creation remain server-authoritative Phase 4 work.
              </p>
            </div>
          )}

          {readiness.warnings.length > 0 && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-muted-foreground">
              {readiness.warnings.map((warning) => <p key={warning}>{warning}</p>)}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Back to workbench</Button>
          <Button
            type="button"
            disabled={!readiness.ready}
            onClick={() => {
              onConfirm(createLuthieryBuildPreviewSpec(selection, materialsCatalog, progress));
              onOpenChange(false);
            }}
          >
            Confirm design
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
