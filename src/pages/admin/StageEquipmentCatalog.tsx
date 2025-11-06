import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { AdminRoute } from "@/components/AdminRoute";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ADMIN_FORM_DEFAULTS,
  AdminEquipmentFormValues,
  CONDITION_ORDER,
  equipmentLabelMap as labelMap,
  EQUIPMENT_TYPES,
  formatEquipmentCurrency as formatCurrency,
  generateEquipmentCatalogId,
  RARITY_OPTIONS,
  SIZE_OPTIONS,
  WEIGHT_OPTIONS,
} from "@/features/stage-equipment/catalog";
import { useStageEquipmentCatalog } from "@/features/stage-equipment/catalog-context";

const StageEquipmentCatalogAdmin = () => {
  const { catalog, setCatalog } = useStageEquipmentCatalog();
  const adminForm = useForm<AdminEquipmentFormValues>({
    defaultValues: ADMIN_FORM_DEFAULTS,
  });
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const sortedCatalog = useMemo(
    () =>
      [...catalog].sort((a, b) => {
        const typeCompare = a.type.localeCompare(b.type);
        if (typeCompare !== 0) return typeCompare;
        return a.name.localeCompare(b.name);
      }),
    [catalog],
  );

  const totalItems = catalog.length;
  const totalStock = useMemo(
    () => catalog.reduce((sum, item) => sum + (Number.isFinite(item.amountAvailable) ? item.amountAvailable : 0), 0),
    [catalog],
  );
  const uniqueTypes = useMemo(() => new Set(catalog.map((item) => item.type)).size, [catalog]);

  const beginEdit = (itemId: string) => {
    const item = catalog.find((entry) => entry.id === itemId);
    if (!item) return;
    setEditingItemId(item.id);
    adminForm.reset({
      name: item.name,
      type: item.type,
      cost: item.cost,
      liveImpact: item.liveImpact,
      weight: item.weight,
      size: item.size,
      condition: item.baseCondition,
      amountAvailable: item.amountAvailable,
      rarity: item.rarity,
      description: item.description ?? "",
    });
  };

  const cancelEdit = () => {
    setEditingItemId(null);
    adminForm.reset(ADMIN_FORM_DEFAULTS);
  };

  const handleRemove = (itemId: string) => {
    const item = catalog.find((entry) => entry.id === itemId);
    if (!item) return;

    const confirmed =
      typeof window === "undefined"
        ? true
        : window.confirm(`Remove ${item.name} from the catalog? Bands will no longer be able to purchase it.`);

    if (!confirmed) return;

    setCatalog((prev) => prev.filter((entry) => entry.id !== itemId));
    toast.success(`${item.name} removed from the catalog`);
    if (editingItemId === itemId) {
      cancelEdit();
    }
  };

  const handleSubmit = adminForm.handleSubmit((values) => {
    const baseItem = {
      id: editingItemId ?? generateEquipmentCatalogId(),
      name: values.name.trim(),
      type: values.type,
      cost: Number(values.cost) || 0,
      liveImpact: values.liveImpact.trim(),
      weight: values.weight,
      size: values.size,
      baseCondition: values.condition,
      amountAvailable: Number(values.amountAvailable) || 0,
      rarity: values.rarity,
      description: values.description?.trim() || undefined,
    };

    if (editingItemId) {
      setCatalog((prev) => prev.map((item) => (item.id === editingItemId ? baseItem : item)));
      toast.success(`${baseItem.name} updated`);
      cancelEdit();
    } else {
      setCatalog((prev) => [...prev, baseItem]);
      toast.success(`${baseItem.name} added to the catalog`);
      adminForm.reset(ADMIN_FORM_DEFAULTS);
    }
  });

  return (
    <AdminRoute>
      <div className="container mx-auto max-w-5xl space-y-6 p-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Stage Equipment Catalog</h1>
          <p className="text-muted-foreground">
            Curate the gear bands can purchase before tours. Tune attributes, availability, and impact to match balancing goals.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Catalog overview</CardTitle>
            <CardDescription>Quick snapshot of the current live equipment roster.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Catalog entries</p>
              <p className="text-2xl font-semibold text-foreground">{totalItems}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Unique equipment types</p>
              <p className="text-2xl font-semibold text-foreground">{uniqueTypes}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total stock across items</p>
              <p className="text-2xl font-semibold text-foreground">{totalStock}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{editingItemId ? "Edit equipment" : "Add new equipment"}</CardTitle>
            <CardDescription>
              Define how new equipment behaves before players discover it in the market.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="catalog-name">Equipment name</Label>
                <Input id="catalog-name" placeholder="Enter equipment name" {...adminForm.register("name", { required: true })} />
              </div>
              <div className="space-y-2">
                <Label>Equipment type</Label>
                <Controller
                  control={adminForm.control}
                  name="type"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {EQUIPMENT_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="catalog-cost">Cost</Label>
                <Input id="catalog-cost" type="number" min={0} step={100} {...adminForm.register("cost", { valueAsNumber: true })} />
              </div>
              <div className="space-y-2">
                <Label>Live performance impact</Label>
                <Textarea
                  placeholder="Describe how this gear influences a live show"
                  className="min-h-[80px]"
                  {...adminForm.register("liveImpact")}
                />
              </div>
              <div className="space-y-2">
                <Label>Weight</Label>
                <Controller
                  control={adminForm.control}
                  name="weight"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select weight" />
                      </SelectTrigger>
                      <SelectContent>
                        {WEIGHT_OPTIONS.map((weight) => (
                          <SelectItem key={weight} value={weight}>
                            {labelMap[weight]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label>Size</Label>
                <Controller
                  control={adminForm.control}
                  name="size"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select size" />
                      </SelectTrigger>
                      <SelectContent>
                        {SIZE_OPTIONS.map((size) => (
                          <SelectItem key={size} value={size}>
                            {labelMap[size]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label>Condition</Label>
                <Controller
                  control={adminForm.control}
                  name="condition"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select condition" />
                      </SelectTrigger>
                      <SelectContent>
                        {CONDITION_ORDER.slice().reverse().map((condition) => (
                          <SelectItem key={condition} value={condition}>
                            {labelMap[condition]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="catalog-stock">Amount available</Label>
                <Input
                  id="catalog-stock"
                  type="number"
                  min={0}
                  {...adminForm.register("amountAvailable", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-2">
                <Label>Rarity</Label>
                <Controller
                  control={adminForm.control}
                  name="rarity"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select rarity" />
                      </SelectTrigger>
                      <SelectContent>
                        {RARITY_OPTIONS.map((rarity) => (
                          <SelectItem key={rarity} value={rarity}>
                            {labelMap[rarity]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="md:col-span-2 flex flex-wrap items-center gap-2">
                <Button type="submit" className="w-full md:w-auto">
                  {editingItemId ? "Update equipment" : "Add equipment to catalog"}
                </Button>
                {editingItemId && (
                  <Button type="button" variant="outline" onClick={cancelEdit}>
                    Cancel edit
                  </Button>
                )}
              </div>
            </form>

            <div className="space-y-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Catalog inventory</h2>
                <p className="text-sm text-muted-foreground">Manage existing entries available to players.</p>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Live impact</TableHead>
                      <TableHead>Attributes</TableHead>
                      <TableHead className="text-right">Price & Stock</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedCatalog.map((item) => (
                      <TableRow key={item.id} className={editingItemId === item.id ? "bg-muted/50" : undefined}>
                        <TableCell>
                          <div className="font-medium text-foreground">{item.name}</div>
                          <div className="text-xs text-muted-foreground">{item.type}</div>
                          {item.description && (
                            <div className="mt-1 text-xs text-muted-foreground">{item.description}</div>
                          )}
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <p className="text-sm text-muted-foreground">{item.liveImpact}</p>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 text-xs">
                            <Badge variant="outline">{labelMap[item.weight]}</Badge>
                            <Badge variant="outline">{labelMap[item.size]}</Badge>
                            <Badge variant="outline">{labelMap[item.baseCondition]}</Badge>
                            <Badge variant="outline">{labelMap[item.rarity]}</Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          <div className="font-semibold text-foreground">{formatCurrency(item.cost)}</div>
                          <div className="text-muted-foreground">{item.amountAvailable} available</div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => beginEdit(item.id)}>
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleRemove(item.id)}
                            >
                              Remove
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {sortedCatalog.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                          No equipment in the catalog yet. Add entries to make them available for purchase.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminRoute>
  );
};

export default StageEquipmentCatalogAdmin;
