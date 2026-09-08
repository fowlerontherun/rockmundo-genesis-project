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
import { ArrowDownToLine, ArrowUpFromLine, Plus, Trash2 } from "lucide-react";

interface VariantManagerProps {
  merchandiseId: string | null;
  productName: string;
  basePrice: number;
  baseCost: number;
  parentStock?: number;
}

const SIZE_PRESETS = ["XS", "S", "M", "L", "XL", "XXL", "OS"];

export function VariantManager({ merchandiseId, productName, basePrice, baseCost, parentStock = 0 }: VariantManagerProps) {
  const { variants, isLoading, createVariant, updateVariant, deleteVariant, allocateStock, releaseStock, isCreating } = useMerchVariants(merchandiseId);
  const [draft, setDraft] = useState({ size: "M", color: "", sku: "", stock_quantity: 0, price: "", cost: "" });

  if (!merchandiseId) return <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Select a product to manage variants.</CardContent></Card>;

  const handleCreate = () => createVariant({
    size: draft.size || null,
    color: draft.color || null,
    sku: draft.sku || null,
    stock_quantity: Math.max(0, draft.stock_quantity || 0),
    selling_price_override: draft.price ? Math.round(Number(draft.price)) : null,
    cost_to_produce_override: draft.cost ? Math.round(Number(draft.cost)) : null,
  });

  const totalVariantStock = variants.reduce((sum, variant) => sum + variant.stock_quantity, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Variants for {productName}</CardTitle>
          <CardDescription>
            Sizes and colourways split already-manufactured inventory; they do not create new stock. {parentStock} unallocated parent units · {totalVariantStock} allocated to variants.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
            <div className="space-y-1"><Label className="text-xs">Size</Label><select className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={draft.size} onChange={(e) => setDraft({ ...draft, size: e.target.value })}>{SIZE_PRESETS.map((size) => <option key={size} value={size}>{size}</option>)}</select></div>
            <div className="space-y-1"><Label className="text-xs">Colour</Label><Input className="h-9 text-sm" placeholder="Black" value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">SKU</Label><Input className="h-9 text-sm" placeholder="auto" value={draft.sku} onChange={(e) => setDraft({ ...draft, sku: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">Initial allocation</Label><Input type="number" min={0} max={parentStock} className="h-9 text-sm" value={draft.stock_quantity} onChange={(e) => setDraft({ ...draft, stock_quantity: Number(e.target.value) })} /><p className="text-[11px] text-muted-foreground">From parent stock</p></div>
            <div className="space-y-1"><Label className="text-xs">Price override</Label><Input type="number" min={0} placeholder={`$${basePrice}`} className="h-9 text-sm" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">Cost override</Label><Input type="number" min={0} placeholder={`$${baseCost}`} className="h-9 text-sm" value={draft.cost} onChange={(e) => setDraft({ ...draft, cost: e.target.value })} /></div>
          </div>
          <Button onClick={handleCreate} disabled={isCreating || draft.stock_quantity > parentStock} size="sm"><Plus className="mr-1 h-4 w-4" />Create variant</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="py-12 text-center text-sm text-muted-foreground">Loading variants…</div> : variants.length === 0 ? <div className="py-12 text-center text-sm text-muted-foreground">No variants yet. Create a size/colour above and allocate manufactured units when needed.</div> : (
            <ResponsiveTable><Table><TableHeader><TableRow><TableHead>Variant</TableHead><TableHead className="text-right">Allocated stock</TableHead><TableHead className="text-right">Price</TableHead><TableHead className="text-right">Cost</TableHead><TableHead>Active</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>
              {variants.map((variant) => <VariantRow key={variant.id} variant={variant} basePrice={basePrice} baseCost={baseCost} parentStock={parentStock} onUpdate={(patch) => updateVariant({ id: variant.id, patch })} onDelete={() => deleteVariant(variant.id)} onAllocate={(amount) => allocateStock({ id: variant.id, amount })} onRelease={(amount) => releaseStock({ id: variant.id, amount })} />)}
            </TableBody></Table></ResponsiveTable>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function VariantRow({ variant, basePrice, baseCost, parentStock, onUpdate, onDelete, onAllocate, onRelease }: {
  variant: MerchVariant;
  basePrice: number;
  baseCost: number;
  parentStock: number;
  onUpdate: (patch: Partial<MerchVariant>) => void;
  onDelete: () => void;
  onAllocate: (amount: number) => void;
  onRelease: (amount: number) => void;
}) {
  const [amount, setAmount] = useState(10);
  const price = variant.selling_price_override ?? basePrice;
  const cost = variant.cost_to_produce_override ?? baseCost;
  const status = variant.stock_quantity <= 0 ? "sold_out" : variant.stock_quantity < 10 ? "low" : "ok";

  return (
    <TableRow>
      <TableCell><div className="flex flex-col"><span className="font-medium">{[variant.size, variant.color].filter(Boolean).join(" · ") || "Default"}</span>{variant.sku && <span className="text-xs text-muted-foreground">{variant.sku}</span>}</div></TableCell>
      <TableCell className="text-right"><Badge variant={status === "sold_out" ? "destructive" : status === "low" ? "secondary" : "outline"}>{variant.stock_quantity}</Badge></TableCell>
      <TableCell className="text-right">${price}</TableCell>
      <TableCell className="text-right text-muted-foreground">${cost}</TableCell>
      <TableCell><Switch checked={variant.is_active} onCheckedChange={(checked) => onUpdate({ is_active: checked })} /></TableCell>
      <TableCell className="text-right">
        <div className="inline-flex items-center gap-1">
          <Input type="number" min={1} value={amount} onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 1))} className="h-8 w-16 text-xs" />
          <Button size="icon" variant="ghost" className="h-8 w-8" title="Allocate from parent stock" disabled={parentStock < amount} onClick={() => onAllocate(amount)}><ArrowDownToLine className="h-3.5 w-3.5" /></Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" title="Return to parent stock" disabled={variant.stock_quantity < amount} onClick={() => onRelease(amount)}><ArrowUpFromLine className="h-3.5 w-3.5" /></Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" title="Delete and return remaining stock" onClick={() => { if (confirm("Delete this variant? Any unsold units will be returned to the parent product.")) onDelete(); }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
