import React, { useState, useEffect, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  Speaker, Lightbulb, Guitar, Utensils, Wine, Shirt, 
  DoorClosed, Sofa, Shield, Users, Plus, Minus, Save, 
  Trash2, Star, AlertCircle, CheckCircle, Info
} from 'lucide-react';
import { useBandRiders, useGroupedRiderCatalog, RIDER_TIERS, RiderCatalogItem, BandRiderItem } from '@/hooks/useBandRiders';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface RiderBuilderProps {
  bandId: string;
  bandFame: number;
  riderId?: string;
  onSave?: () => void;
  onCancel?: () => void;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  technical: <Speaker className="h-4 w-4" />,
  hospitality: <Utensils className="h-4 w-4" />,
  backstage: <DoorClosed className="h-4 w-4" />,
};

const SUBCATEGORY_ICONS: Record<string, React.ReactNode> = {
  sound: <Speaker className="h-4 w-4" />,
  lighting: <Lightbulb className="h-4 w-4" />,
  backline: <Guitar className="h-4 w-4" />,
  catering: <Utensils className="h-4 w-4" />,
  beverages: <Wine className="h-4 w-4" />,
  comfort: <Shirt className="h-4 w-4" />,
  dressing_room: <DoorClosed className="h-4 w-4" />,
  green_room: <Sofa className="h-4 w-4" />,
  security: <Shield className="h-4 w-4" />,
  production: <Users className="h-4 w-4" />,
};

const PRIORITY_CONFIG = {
  essential: { label: 'Essential', color: 'bg-destructive text-destructive-foreground' },
  important: { label: 'Important', color: 'bg-warning text-warning-foreground' },
  nice_to_have: { label: 'Nice to Have', color: 'bg-secondary text-secondary-foreground' },
  optional: { label: 'Optional', color: 'bg-muted text-muted-foreground' },
};

export function RiderBuilder({ bandId, bandFame, riderId, onSave, onCancel }: RiderBuilderProps) {
  const { toast } = useToast();
  const { catalog, createRider, updateRider, fetchRiderItems, addRiderItem, removeRiderItem } = useBandRiders(bandId);
  const { grouped } = useGroupedRiderCatalog();

  const [riderName, setRiderName] = useState('');
  const [riderDescription, setRiderDescription] = useState('');
  const [riderTier, setRiderTier] = useState('standard');
  const [selectedItems, setSelectedItems] = useState<Map<string, { quantity: number; priority: string; notes: string }>>(new Map());
  const [existingItemIds, setExistingItemIds] = useState<Map<string, string>>(new Map()); // catalog_item_id -> rider_item_id
  const [activeCategory, setActiveCategory] = useState('technical');
  const [isSaving, setIsSaving] = useState(false);

  // Load existing rider if editing
  useEffect(() => {
    if (riderId) {
      fetchRiderItems(riderId).then(items => {
        const itemMap = new Map<string, { quantity: number; priority: string; notes: string }>();
        const idMap = new Map<string, string>();
        
        items.forEach(item => {
          itemMap.set(item.catalog_item_id, {
            quantity: item.quantity,
            priority: item.priority,
            notes: item.custom_notes || '',
          });
          idMap.set(item.catalog_item_id, item.id);
        });
        
        setSelectedItems(itemMap);
        setExistingItemIds(idMap);
      });
    }
  }, [riderId, fetchRiderItems]);

  const tierConfig = RIDER_TIERS.find(t => t.id === riderTier) || RIDER_TIERS[1];

  const { totalCost, itemCount, performanceBonus, moraleBonus, categoryBreakdown } = useMemo(() => {
    let cost = 0;
    let count = 0;
    let perfBonus = 0;
    let moraleBonus = 0;
    const breakdown: Record<string, { count: number; cost: number }> = {
      technical: { count: 0, cost: 0 },
      hospitality: { count: 0, cost: 0 },
      backstage: { count: 0, cost: 0 },
    };

    selectedItems.forEach((item, catalogId) => {
      const catalogItem = catalog?.find(c => c.id === catalogId);
      if (catalogItem) {
        const itemCost = catalogItem.base_cost * item.quantity * tierConfig.costMultiplier;
        cost += itemCost;
        count += item.quantity;
        perfBonus += catalogItem.performance_impact * item.quantity;
        moraleBonus += catalogItem.morale_impact * item.quantity;
        
        breakdown[catalogItem.category].count += item.quantity;
        breakdown[catalogItem.category].cost += itemCost;
      }
    });

    return {
      totalCost: Math.round(cost),
      itemCount: count,
      performanceBonus: Math.round(perfBonus * 100),
      moraleBonus: Math.round(moraleBonus * 100),
      categoryBreakdown: breakdown,
    };
  }, [selectedItems, catalog, tierConfig]);

  const toggleItem = (catalogId: string, item: RiderCatalogItem) => {
    setSelectedItems(prev => {
      const newMap = new Map(prev);
      if (newMap.has(catalogId)) {
        newMap.delete(catalogId);
      } else {
        newMap.set(catalogId, {
          quantity: 1,
          priority: item.priority,
          notes: '',
        });
      }
      return newMap;
    });
  };

  const updateItemQuantity = (catalogId: string, delta: number) => {
    setSelectedItems(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(catalogId);
      if (current) {
        const newQty = Math.max(1, current.quantity + delta);
        newMap.set(catalogId, { ...current, quantity: newQty });
      }
      return newMap;
    });
  };

  const updateItemPriority = (catalogId: string, priority: string) => {
    setSelectedItems(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(catalogId);
      if (current) {
        newMap.set(catalogId, { ...current, priority });
      }
      return newMap;
    });
  };

  const handleSave = async () => {
    if (!riderName.trim()) {
      toast({ title: 'Name required', description: 'Please enter a name for your rider.', variant: 'destructive' });
      return;
    }

    setIsSaving(true);

    try {
      let targetRiderId = riderId;

      if (!riderId) {
        // Create new rider
        const result = await createRider.mutateAsync({
          band_id: bandId,
          name: riderName,
          description: riderDescription || null,
          tier: riderTier as any,
          is_default: false,
          total_cost_estimate: totalCost,
        });
        targetRiderId = result.id;
      } else {
        // Update existing rider
        await updateRider.mutateAsync({
          id: riderId,
          name: riderName,
          description: riderDescription || null,
          tier: riderTier as any,
          total_cost_estimate: totalCost,
        });

        // Remove items that are no longer selected
        for (const [catalogId, itemId] of existingItemIds) {
          if (!selectedItems.has(catalogId)) {
            await removeRiderItem.mutateAsync(itemId);
          }
        }
      }

      // Add/update items
      for (const [catalogId, itemData] of selectedItems) {
        if (!existingItemIds.has(catalogId)) {
          await addRiderItem.mutateAsync({
            rider_id: targetRiderId!,
            catalog_item_id: catalogId,
            quantity: itemData.quantity,
            priority: itemData.priority as any,
            custom_notes: itemData.notes || null,
          });
        }
      }

      toast({ title: 'Rider saved', description: 'Your rider has been saved successfully.' });
      onSave?.();
    } catch (error) {
      console.error('Save rider error:', error);
      toast({ title: 'Error', description: 'Failed to save rider.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const renderCatalogItems = (category: string) => {
    const subcategories = grouped?.[category] || {};

    return (
      <div className="space-y-6">
        {Object.entries(subcategories).map(([subcategory, items]) => (
          <div key={subcategory} className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              {SUBCATEGORY_ICONS[subcategory] || <Info className="h-4 w-4" />}
              <span className="capitalize">{subcategory.replace(/_/g, ' ')}</span>
            </div>
            
            <div className="grid gap-2">
              {items.map(item => {
                const isSelected = selectedItems.has(item.id);
                const selectionData = selectedItems.get(item.id);
                const isLocked = item.min_fame_required > bandFame;

                return (
                  <Card 
                    key={item.id} 
                    className={cn(
                      "transition-all cursor-pointer",
                      isSelected && "border-primary bg-primary/5",
                      isLocked && "opacity-50 cursor-not-allowed"
                    )}
                    onClick={() => !isLocked && toggleItem(item.id, item)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <Checkbox 
                            checked={isSelected} 
                            disabled={isLocked}
                            className="mt-1"
                          />
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{item.name}</span>
                              {item.is_premium && (
                                <Star className="h-3 w-3 text-warning" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">{item.description}</p>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="text-xs">
                                ${item.base_cost}
                              </Badge>
                              <Badge variant="secondary" className={cn("text-xs", PRIORITY_CONFIG[item.priority].color)}>
                                {PRIORITY_CONFIG[item.priority].label}
                              </Badge>
                              {item.performance_impact > 0 && (
                                <Badge variant="outline" className="text-xs text-green-600">
                                  +{Math.round(item.performance_impact * 100)}% perf
                                </Badge>
                              )}
                              {item.morale_impact > 0 && (
                                <Badge variant="outline" className="text-xs text-blue-600">
                                  +{Math.round(item.morale_impact * 100)}% morale
                                </Badge>
                              )}
                              {isLocked && (
                                <Badge variant="destructive" className="text-xs">
                                  Requires {item.min_fame_required} fame
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        {isSelected && selectionData && (
                          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-6 w-6"
                              onClick={() => updateItemQuantity(item.id, -1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-6 text-center text-sm font-medium">
                              {selectionData.quantity}
                            </span>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-6 w-6"
                              onClick={() => updateItemQuantity(item.id, 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="rider-name">Rider Name *</Label>
            <Input
              id="rider-name"
              value={riderName}
              onChange={(e) => setRiderName(e.target.value)}
              placeholder="e.g., Standard Tour Rider"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rider-tier">Tier</Label>
            <Select value={riderTier} onValueChange={setRiderTier}>
              <SelectTrigger id="rider-tier">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RIDER_TIERS.map(tier => (
                  <SelectItem key={tier.id} value={tier.id}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{tier.name}</span>
                      <span className="text-xs text-muted-foreground">- {tier.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="rider-description">Description</Label>
          <Textarea
            id="rider-description"
            value={riderDescription}
            onChange={(e) => setRiderDescription(e.target.value)}
            placeholder="Optional notes about this rider..."
            rows={2}
          />
        </div>
      </div>

      {/* Stats Overview */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="text-center">
              <p className="text-2xl font-bold">${totalCost.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Estimated Cost</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{itemCount}</p>
              <p className="text-xs text-muted-foreground">Total Items</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">+{performanceBonus}%</p>
              <p className="text-xs text-muted-foreground">Performance Bonus</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">+{moraleBonus}%</p>
              <p className="text-xs text-muted-foreground">Morale Bonus</p>
            </div>
          </div>

          <Separator className="my-4" />

          <div className="grid grid-cols-3 gap-4 text-sm">
            {Object.entries(categoryBreakdown).map(([cat, data]) => (
              <div key={cat} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="capitalize flex items-center gap-1">
                    {CATEGORY_ICONS[cat]}
                    {cat}
                  </span>
                  <span className="text-muted-foreground">{data.count} items</span>
                </div>
                <Progress value={data.count > 0 ? 100 : 0} className="h-1" />
                <p className="text-xs text-muted-foreground">${data.cost.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Item Selection */}
      <Tabs value={activeCategory} onValueChange={setActiveCategory}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="technical" className="flex items-center gap-2">
            <Speaker className="h-4 w-4" />
            <span className="hidden sm:inline">Technical</span>
          </TabsTrigger>
          <TabsTrigger value="hospitality" className="flex items-center gap-2">
            <Utensils className="h-4 w-4" />
            <span className="hidden sm:inline">Hospitality</span>
          </TabsTrigger>
          <TabsTrigger value="backstage" className="flex items-center gap-2">
            <DoorClosed className="h-4 w-4" />
            <span className="hidden sm:inline">Backstage</span>
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="h-[400px] mt-4">
          <TabsContent value="technical" className="mt-0">
            {renderCatalogItems('technical')}
          </TabsContent>
          <TabsContent value="hospitality" className="mt-0">
            {renderCatalogItems('hospitality')}
          </TabsContent>
          <TabsContent value="backstage" className="mt-0">
            {renderCatalogItems('backstage')}
          </TabsContent>
        </ScrollArea>
      </Tabs>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? 'Saving...' : 'Save Rider'}
        </Button>
      </div>
    </div>
  );
}
