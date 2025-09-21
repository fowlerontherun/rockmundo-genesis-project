import { useCallback, useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil, RefreshCcw, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";

import { AdminRoute } from "@/components/AdminRoute";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

import {
  DEFAULT_UNDERWORLD_PRICE_CURRENCY,
  UNDERWORLD_AVAILABILITY_BADGE_VARIANTS,
  UNDERWORLD_AVAILABILITY_LABELS,
  UNDERWORLD_RARITY_BADGE_STYLES,
  UNDERWORLD_RARITY_LABELS,
  UNDERWORLD_STORE_FORM_DEFAULTS,
  UnderworldStoreItemFormValues,
  UnderworldStoreItemInsert,
  UnderworldStoreItemRow,
  UnderworldStoreItemUpdate,
  availabilityOptions,
  formatUnderworldStorePrice,
  mapUnderworldStoreRowToFormValues,
  rarityOptions,
  underworldStoreItemSchema,
} from "./underworldStore.helpers";

const normalizeOptionalText = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

export default function UnderworldStore() {
  const { toast } = useToast();
  const [items, setItems] = useState<UnderworldStoreItemRow[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingItem, setEditingItem] = useState<UnderworldStoreItemRow | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);

  const itemForm = useForm<UnderworldStoreItemFormValues>({
    resolver: zodResolver(underworldStoreItemSchema),
    defaultValues: UNDERWORLD_STORE_FORM_DEFAULTS,
  });

  const resetForm = useCallback(() => {
    setEditingItem(null);
    itemForm.reset(UNDERWORLD_STORE_FORM_DEFAULTS);
  }, [itemForm]);
  const handleFetchItems = useCallback(async () => {
    setIsLoadingItems(true);
    try {
      const { data, error } = await supabase
        .from("underworld_store_items")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });

      if (error) throw error;

      setItems((data as UnderworldStoreItemRow[] | null) ?? []);
    } catch (error) {
      console.error("Failed to load Underworld store items", error);
      toast({
        variant: "destructive",
        title: "Unable to load store items",
        description: "We couldn't retrieve the Underworld catalog. Please try again later.",
      });
    } finally {
      setIsLoadingItems(false);
    }
  }, [toast]);

  useEffect(() => {
    void handleFetchItems();
  }, [handleFetchItems]);

  const handleSubmitItem = useCallback(
    async (values: UnderworldStoreItemFormValues) => {
      setIsSubmitting(true);
      const payload: UnderworldStoreItemInsert = {
        name: values.name,
        category: values.category,
        rarity: values.rarity,
        price_amount: values.priceAmount,
        price_currency: values.priceCurrency || DEFAULT_UNDERWORLD_PRICE_CURRENCY,
        availability: values.availability,
        description: normalizeOptionalText(values.description),
        image_url: normalizeOptionalText(values.imageUrl),
        sort_order: values.sortOrder,
        is_active: values.isActive,
      };

      try {
        if (editingItem) {
          const updatePayload: UnderworldStoreItemUpdate = { ...payload };
          const { error } = await supabase
            .from("underworld_store_items")
            .update(updatePayload)
            .eq("id", editingItem.id);

          if (error) throw error;

          toast({
            title: "Store item updated",
            description: `${values.name} has been saved.`,
          });
        } else {
          const { error } = await supabase.from("underworld_store_items").insert(payload);

          if (error) throw error;

          toast({
            title: "Store item created",
            description: `${values.name} is now available in the Underworld.`,
          });
        }

        resetForm();
        await handleFetchItems();
      } catch (error) {
        console.error("Failed to save Underworld store item", error);
        toast({
          variant: "destructive",
          title: "Save failed",
          description: "We couldn't save the store item. Please try again.",
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [editingItem, handleFetchItems, resetForm, toast],
  );

  const handleEditItem = useCallback(
    (item: UnderworldStoreItemRow) => {
      setEditingItem(item);
      const values = mapUnderworldStoreRowToFormValues(item);
      itemForm.reset(values);
    },
    [itemForm],
  );

  const handleDeleteItem = useCallback(
    async (item: UnderworldStoreItemRow) => {
      setDeletingItemId(item.id);
      try {
        const { error } = await supabase.from("underworld_store_items").delete().eq("id", item.id);

        if (error) throw error;

        setItems((previous) => previous.filter((existing) => existing.id !== item.id));
        if (editingItem?.id === item.id) {
          resetForm();
        }

        toast({
          title: "Store item deleted",
          description: `${item.name} has been removed from the catalog.`,
        });
      } catch (error) {
        console.error("Failed to delete Underworld store item", error);
        toast({
          variant: "destructive",
          title: "Delete failed",
          description: "We couldn't remove the store item. Please try again.",
        });
      } finally {
        setDeletingItemId(null);
      }
    },
    [editingItem?.id, resetForm, toast],
  );

  const formTitle = editingItem ? "Update Underworld Item" : "Create Underworld Item";
  const formDescription = editingItem
    ? "Adjust the selected artifact's details or availability."
    : "Add a new artifact to the Underworld store catalog.";

  const hasItems = items.length > 0;
  const itemCountLabel = useMemo(() => {
    if (!hasItems) {
      return "No items yet";
    }

    return `${items.length} item${items.length === 1 ? "" : "s"}`;
  }, [hasItems, items.length]);
  return (
    <AdminRoute>
      <div className="container mx-auto max-w-6xl space-y-6 p-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Underworld Store</h1>
          <p className="text-muted-foreground">
            Curate the rare equipment and artifacts available to players inside the Underworld Nexus.
          </p>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-xl">
              {formTitle}
              {editingItem ? <Badge variant="secondary">Editing</Badge> : null}
            </CardTitle>
            <CardDescription>{formDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...itemForm}>
              <form className="space-y-6" onSubmit={itemForm.handleSubmit(handleSubmitItem)}>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={itemForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Item name</FormLabel>
                        <FormControl>
                          <Input placeholder="Phantom Cloak" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={itemForm.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <FormControl>
                          <Input placeholder="Apparel" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={itemForm.control}
                    name="rarity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rarity</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select rarity" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {rarityOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={itemForm.control}
                    name="availability"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Availability</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select availability" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {availabilityOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <FormField
                    control={itemForm.control}
                    name="priceAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Price amount</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            step={10}
                            value={Number.isFinite(field.value) ? field.value : ""}
                            onChange={(event) => field.onChange(event.target.valueAsNumber)}
                          />
                        </FormControl>
                        <FormDescription>Numerical value without currency formatting.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={itemForm.control}
                    name="priceCurrency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Currency</FormLabel>
                        <FormControl>
                          <Input placeholder={DEFAULT_UNDERWORLD_PRICE_CURRENCY} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={itemForm.control}
                    name="sortOrder"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sort order</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            value={Number.isFinite(field.value) ? field.value : ""}
                            onChange={(event) => field.onChange(event.target.valueAsNumber)}
                          />
                        </FormControl>
                        <FormDescription>Lower numbers appear first in listings.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={itemForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea rows={3} placeholder="Optional flavor text shown to players" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={itemForm.control}
                  name="imageUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Image URL</FormLabel>
                      <FormControl>
                        <Input placeholder="https://..." {...field} />
                      </FormControl>
                      <FormDescription>Optional image used to visually represent the artifact.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={itemForm.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-md border p-4">
                      <div className="space-y-0.5">
                        <FormLabel>Active</FormLabel>
                        <FormDescription>Inactive items remain hidden from the public Underworld page.</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex gap-3">
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving
                        </>
                      ) : editingItem ? (
                        "Save changes"
                      ) : (
                        "Create item"
                      )}
                    </Button>
                    {editingItem ? (
                      <Button type="button" variant="outline" onClick={resetForm} disabled={isSubmitting}>
                        Cancel edit
                      </Button>
                    ) : null}
                  </div>
                  <Button type="button" variant="ghost" onClick={resetForm} disabled={isSubmitting}>
                    Reset form
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xl">Underworld catalog</CardTitle>
              <CardDescription>{itemCountLabel}</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => void handleFetchItems()} disabled={isLoadingItems}>
              {isLoadingItems ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Refreshing
                </>
              ) : (
                <>
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Refresh
                </>
              )}
            </Button>
          </CardHeader>
          <CardContent>
            {isLoadingItems ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
              </div>
            ) : !hasItems ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No store items configured yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead className="hidden xl:table-cell">Category</TableHead>
                      <TableHead>Rarity</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Availability</TableHead>
                      <TableHead className="hidden sm:table-cell">Status</TableHead>
                      <TableHead className="hidden md:table-cell">Sort</TableHead>
                      <TableHead className="w-[120px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => {
                      const rarityLabel = UNDERWORLD_RARITY_LABELS[item.rarity];
                      const availabilityLabel = UNDERWORLD_AVAILABILITY_LABELS[item.availability];
                      const availabilityVariant = UNDERWORLD_AVAILABILITY_BADGE_VARIANTS[item.availability];
                      const rarityStyles = UNDERWORLD_RARITY_BADGE_STYLES[item.rarity];
                      const priceLabel = formatUnderworldStorePrice(item.price_amount, item.price_currency);
                      const isDeleting = deletingItemId === item.id;
                      const isEditing = editingItem?.id === item.id;

                      return (
                        <TableRow key={item.id} className={isEditing ? "bg-muted/50" : undefined}>
                          <TableCell className="font-medium">
                            <div className="flex flex-col">
                              <span>{item.name}</span>
                              <span className="text-xs text-muted-foreground xl:hidden">{item.category}</span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden xl:table-cell text-muted-foreground">{item.category}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={rarityStyles}>
                              {rarityLabel}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{priceLabel}</TableCell>
                          <TableCell>
                            <Badge variant={availabilityVariant}>{availabilityLabel}</Badge>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {item.is_active ? (
                              <Badge variant="secondary">Active</Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground">Hidden</Badge>
                            )}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">{item.sort_order}</TableCell>
                          <TableCell className="flex items-center justify-end gap-2">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => handleEditItem(item)}
                              aria-label={`Edit ${item.name}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => void handleDeleteItem(item)}
                              aria-label={`Delete ${item.name}`}
                              disabled={isDeleting}
                            >
                              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminRoute>
  );
}
