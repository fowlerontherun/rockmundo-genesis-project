import { useState } from "react";
import { useMerchVariants, type MerchVariant } from "@/hooks/useMerchVariants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, RefreshCw } from "lucide-react";

interface VariantManagerProps {
  merchandiseId: string | null;
  productName: string;
  basePrice: number;
  baseCost: number;
}

const SIZE_PRESETS = ["XS", "S", "M", "L", "XL", "XXL", "OS"];

export function VariantManager({ merchandiseId, productName, basePrice, baseCost }: VariantManagerProps) {
  const { variants, isLoading, createVariant, updateVariant, deleteVariant, restockVariant, isCreating } =
    useMerchVariants(merchandiseId);

  const [draft, setDraft] = useState({
    size: "M",
    color: "",
    sku: "",
    stock_quantity: 25,
    price: "",
    cost: "",
  });

  if (!merchandiseId) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Select a product to manage variants.
        </CardContent>
      </Card>
    );
  }

  const handleCreate = () => {
    createVariant({
      size: draft.size || null,
      color: draft.color || null,
      sku: draft.sku || null,
      stock_quantity: Math.max(0, draft.stock_quantity || 0),
      selling_price_override: draft.price ? Math.round(Number(draft.price)) : null,
      cost_to_produce_override: draft.cost ? Math.round(Number(draft.cost)) : null,
    });
  };

  const totalStock = variants.reduce((sum, v) => sum + v.stock_quantity, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Variants for {productName}</CardTitle>
          <CardDescription>
            Manage sizes, colorways, and SKUs. {variants.length} variants · {totalStock} total units
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Size</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={draft.size}
                onChange={(e) => setDraft({ ...draft, size: e.target.value })}
              >
                {SIZE_PRESETS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Color</Label>
              <Input
                className="h-9 text-sm"
                placeholder="Black"
                value={draft.color}
                onChange={(e) => setDraft({ ...draft, color: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">SKU</Label>
              <Input
                className="h-9 text-sm"
                placeholder="auto"
                value={draft.sku}
                onChange={(e) => setDraft({ ...draft, sku: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Stock</Label>
              <Input
                type="number"
                min={0}
                className="h-9 text-sm"
                value={draft.stock_quantity}
                onChange={(e) => setDraft({ ...draft, stock_quantity: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Price override</Label>
              <Input
                type="number"
                min={0}
                placeholder={`$${basePrice}`}
                className="h-9 text-sm"
                value={draft.price}
                onChange={(e) => setDraft({ ...draft, price: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cost override</Label>
              <Input
                type="number"
                min={0}
                placeholder={`$${baseCost}`}
                className="h-9 text-sm"
                value={draft.cost}
                onChange={(e) => setDraft({ ...draft, cost: e.target.value })}
              />
            </div>
          </div>
          <Button onClick={handleCreate} disabled={isCreating} size="sm" className="w-full md:w-auto">
            <Plus className="h-4 w-4 mr-1" /> Add variant
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Loading variants…</div>
          ) : variants.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No variants yet. Create one above to track sizes/colors separately.
            </div>
          ) : (
            <ResponsiveTable>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Variant</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {variants.map((v) => (
                    <VariantRow
                      key={v.id}
                      variant={v}
                      basePrice={basePrice}
                      baseCost={baseCost}
                      onUpdate={(patch) => updateVariant({ id: v.id, patch })}
                      onDelete={() => deleteVariant(v.id)}
                      onRestock={(amount) => restockVariant({ id: v.id, amount })}
                    />
                  ))}
                </TableBody>
              </Table>
            </ResponsiveTable>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function VariantRow({
  variant,
  basePrice,
  baseCost,
  onUpdate,
  onDelete,
  onRestock,
}: {
  variant: MerchVariant;
  basePrice: number;
  baseCost: number;
  onUpdate: (patch: Partial<MerchVariant>) => void;
  onDelete: () => void;
  onRestock: (amount: number) => void;
}) {
  const price = variant.selling_price_override ?? basePrice;
  const cost = variant.cost_to_produce_override ?? baseCost;
  const status =
    variant.stock_quantity <= 0 ? "sold_out" : variant.stock_quantity < 10 ? "low" : "ok";

  return (
    <TableRow>
      <TableCell>
        <div className="flex flex-col">
          <span className="font-medium">
            {[variant.size, variant.color].filter(Boolean).join(" · ") || "Default"}
          </span>
          {variant.sku && <span className="text-xs text-muted-foreground">{variant.sku}</span>}
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <Badge
            variant={status === "sold_out" ? "destructive" : status === "low" ? "secondary" : "outline"}
            className="text-[10px]"
          >
            {variant.stock_quantity}
          </Badge>
        </div>
      </TableCell>
      <TableCell className="text-right">${price}</TableCell>
      <TableCell className="text-right text-muted-foreground">${cost}</TableCell>
      <TableCell>
        <Switch
          checked={variant.is_active}
          onCheckedChange={(checked) => onUpdate({ is_active: checked })}
        />
      </TableCell>
      <TableCell className="text-right">
        <div className="inline-flex gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            title="Restock +25"
            onClick={() => onRestock(25)}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            title="Delete"
            onClick={() => {
              if (confirm("Delete this variant? Existing stock will be removed.")) onDelete();
            }}
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
