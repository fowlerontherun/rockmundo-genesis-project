import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Trash2, Lock, Loader2 } from "lucide-react";
import { computeSalvageYields, type SalvageYield } from "@/utils/salvageYields";
import type { CraftingMaterial } from "@/hooks/useCraftingSystem";

interface SalvagePanelProps {
  equipment: any[];
  materialsCatalog: CraftingMaterial[];
  onSalvage: (equipmentId: string) => void;
  isSalvaging: boolean;
}

const rarityClass = (r?: string | null) => {
  switch ((r ?? "").toLowerCase()) {
    case "legendary": return "bg-amber-500/15 text-amber-500 border-amber-500/30";
    case "epic": return "bg-purple-500/15 text-purple-400 border-purple-500/30";
    case "rare": return "bg-blue-500/15 text-blue-400 border-blue-500/30";
    case "uncommon": return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
};

export const SalvagePanel = ({ equipment, materialsCatalog, onSalvage, isSalvaging }: SalvagePanelProps) => {
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const salvageable = useMemo(() => equipment ?? [], [equipment]);

  const confirmTarget = useMemo(
    () => salvageable.find((e: any) => e.id === confirmId) ?? null,
    [confirmId, salvageable],
  );

  const confirmYields: SalvageYield[] = useMemo(() => {
    if (!confirmTarget) return [];
    return computeSalvageYields(confirmTarget, materialsCatalog);
  }, [confirmTarget, materialsCatalog]);

  if (!salvageable || salvageable.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">No equipment available to salvage.</p>
        <p className="text-xs mt-1">Purchase or craft equipment first, then you can break it down for materials.</p>
      </div>
    );
  }

  if (materialsCatalog.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        Loading materials catalog…
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground mb-3">
        Salvage equipment to recover crafting materials. Higher rarity and better condition yield more. The item is destroyed.
      </p>
      {salvageable.map((item: any) => {
        const rarity = item.equipment?.rarity ?? "common";
        const condition = item.condition ?? 100;
        const equipped = Boolean(item.is_equipped);
        const yields = computeSalvageYields(item, materialsCatalog);
        return (
          <Card key={item.id} className="border-border/50">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {item.equipment?.name || item.name || "Unknown Item"}
                    </span>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${rarityClass(rarity)}`}>
                      {rarity}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                    <span>{item.equipment?.category || item.category || "gear"}</span>
                    <span>·</span>
                    <span>Condition {condition}%</span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setConfirmId(item.id)}
                  disabled={equipped || isSalvaging}
                  className="h-7 px-2"
                  title={equipped ? "Unequip before salvaging" : "Salvage"}
                >
                  {equipped ? (
                    <Lock className="w-3 h-3 mr-1" />
                  ) : (
                    <Trash2 className="w-3 h-3 mr-1" />
                  )}
                  {equipped ? "Equipped" : "Salvage"}
                </Button>
              </div>

              {yields.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  <span className="text-[10px] text-muted-foreground mr-1">Yields:</span>
                  {yields.map((y) => (
                    <Badge key={y.materialId} variant="secondary" className="text-[10px] px-1.5 py-0">
                      {y.quantity}× {y.material.name}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      <AlertDialog open={!!confirmId} onOpenChange={(open) => !open && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Salvage this item?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  <strong>{confirmTarget?.equipment?.name ?? "This item"}</strong> will be permanently destroyed and converted into the following materials:
                </p>
                {confirmYields.length > 0 ? (
                  <ul className="text-sm space-y-0.5">
                    {confirmYields.map((y) => (
                      <li key={y.materialId}>
                        • {y.quantity}× <span className="font-medium">{y.material.name}</span>
                        <span className="text-muted-foreground text-xs ml-1">({y.material.rarity})</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No yields available.</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSalvaging}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isSalvaging || confirmYields.length === 0}
              onClick={(e) => {
                e.preventDefault();
                if (confirmId) {
                  onSalvage(confirmId);
                  setConfirmId(null);
                }
              }}
            >
              {isSalvaging ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Salvage
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
