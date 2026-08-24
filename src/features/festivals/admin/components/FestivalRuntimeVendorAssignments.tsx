import { useMemo, useState } from "react";
import { AlertTriangle, Store } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useAssignFestivalRuntimeVendorSale,
  useFestivalCommerceAnalytics,
} from "../commerceB6";

const requestKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const money = (minor: number, currency: string) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency }).format((minor ?? 0) / 100);

export function FestivalRuntimeVendorAssignments({ editionId }: { editionId: string }) {
  const analytics = useFestivalCommerceAnalytics(editionId);
  const assignMutation = useAssignFestivalRuntimeVendorSale(editionId);
  const [selection, setSelection] = useState<Record<string, string>>({});
  const data = analytics.data;
  const stalls = data?.vendors?.stalls ?? [];
  const sales = data?.vendors?.sales ?? [];

  const stallsById = useMemo(
    () => new Map(stalls.map((stall) => [stall.id, stall])),
    [stalls],
  );

  if (!data?.linked || !data.runtimeSessionId) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Store className="h-4 w-4" /> Live vendor sale assignments
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {sales.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No runtime vendor sale rows exist yet. Configure stalls above; live sales can be linked once the runtime creates them.
          </p>
        ) : (
          sales.map((sale) => {
            const assigned = sale.vendorStallAssignmentId
              ? stallsById.get(sale.vendorStallAssignmentId)
              : undefined;
            const compatible = stalls.filter(
              (stall) => stall.active && stall.category === sale.category,
            );
            const selected = selection[sale.id] ?? sale.vendorStallAssignmentId ?? "";
            const canAssign = sale.status === "open" && compatible.length > 0;

            return (
              <div key={sale.id} className="space-y-3 rounded-lg border p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-medium">{sale.productName}</p>
                    <p className="text-xs text-muted-foreground">
                      {sale.category.replaceAll("_", " ")} · {sale.unitsSold} sold · {money(sale.grossRevenueMinor, sale.currencyCode)} gross
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline">{sale.status}</Badge>
                    {assigned && <Badge>{assigned.stallName}</Badge>}
                  </div>
                </div>

                {sale.status === "closed" && !assigned ? (
                  <div className="flex items-start gap-2 rounded-md border border-amber-500/30 p-2 text-xs text-muted-foreground">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      This sale closed without an external stall assignment, so it remains festival-operated. Closed sales cannot be retroactively assigned.
                    </span>
                  </div>
                ) : sale.status === "open" ? (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <select
                      className="h-10 flex-1 rounded-md border bg-background px-3 text-sm"
                      value={selected}
                      onChange={(event) =>
                        setSelection((current) => ({ ...current, [sale.id]: event.target.value }))
                      }
                    >
                      <option value="">Select compatible stall…</option>
                      {compatible.map((stall) => (
                        <option key={stall.id} value={stall.id}>
                          {stall.stallName} · {stall.vendorName} · {(stall.revenueShareBasisPoints / 100).toFixed(1)}%
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="outline"
                      disabled={!canAssign || !selected || assignMutation.isPending}
                      onClick={() =>
                        assignMutation.mutate({
                          vendorSalesId: sale.id,
                          vendorStallAssignmentId: selected,
                          expectedVersion: sale.version,
                          idempotencyKey: requestKey(),
                        })
                      }
                    >
                      {assignMutation.isPending ? "Assigning…" : assigned ? "Change stall" : "Assign stall"}
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
        {assignMutation.error instanceof Error && (
          <p className="text-sm text-destructive">{assignMutation.error.message}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Only open canonical runtime sales can be assigned. Once a sale closes, its vendor-share terms are snapshotted for Phase 9 settlement and cannot be changed.
        </p>
      </CardContent>
    </Card>
  );
}
