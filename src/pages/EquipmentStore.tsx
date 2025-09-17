import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Guitar,
  Mic,
  Headphones,
  DollarSign,
  ShoppingCart,
  Zap,
  Volume2,
  Music,
  Shirt,
  AlertCircle,
  Check,
  Loader2
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameData, type PlayerSkills } from "@/hooks/useGameData";

interface EquipmentItem {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  price: number;
  rarity: string;
  stock: number;
  stat_boosts: Record<string, number>;
  description: string;
  image_url?: string;
}

interface PlayerEquipment {
  id: string;
  equipment_id: string;
  is_equipped: boolean;
  purchased_at: string | null;
  equipped?: boolean;
  upgrade_level: number;
}

interface EquipmentUpgrade {
  id: string;
  equipment_id: string;
  tier: number;
  cost: number;
  stat_boosts: Record<string, number>;
  description?: string | null;
}

const normalizeStatBoosts = (boosts: unknown): Record<string, number> => {
  if (!boosts || typeof boosts !== "object" || Array.isArray(boosts)) {
    return {};
  }

  return Object.entries(boosts as Record<string, unknown>).reduce((acc, [stat, value]) => {
    const numericValue = typeof value === "number" ? value : Number(value);
    if (!Number.isNaN(numericValue)) {
      acc[stat] = numericValue;
    }
    return acc;
  }, {} as Record<string, number>);
};

const calculateTotalEquipmentBonus = (
  playerEquipmentList: PlayerEquipment[],
  equipmentList: EquipmentItem[],
  upgradeMap: Record<string, EquipmentUpgrade[]>
): Record<string, number> => {
  if (!playerEquipmentList.length || !equipmentList.length) {
    return {};
  }

  const equipmentLookup = new Map(equipmentList.map(item => [item.id, item]));
  const totalBonus: Record<string, number> = {};

  playerEquipmentList.forEach(playerItem => {
    const baseItem = equipmentLookup.get(playerItem.equipment_id);
    if (!baseItem) return;

    const isEquipped = Boolean(playerItem.is_equipped ?? playerItem.equipped);
    if (!isEquipped) return;

    Object.entries(baseItem.stat_boosts || {}).forEach(([stat, value]) => {
      totalBonus[stat] = (totalBonus[stat] || 0) + value;
    });

    const appliedUpgrades = upgradeMap[playerItem.equipment_id] || [];
    if (!appliedUpgrades.length) return;

    appliedUpgrades
      .filter(upgrade => upgrade.tier <= (playerItem.upgrade_level ?? 0))
      .forEach(upgrade => {
        Object.entries(upgrade.stat_boosts).forEach(([stat, value]) => {
          totalBonus[stat] = (totalBonus[stat] || 0) + value;
        });
      });
  });

  return totalBonus;
};

const EquipmentStore = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { profile, updateProfile, skills, updateSkills, addActivity } = useGameData();
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [playerEquipment, setPlayerEquipment] = useState<PlayerEquipment[]>([]);
  const [equipmentUpgrades, setEquipmentUpgrades] = useState<Record<string, EquipmentUpgrade[]>>({});
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState<string | null>(null);

  const loadEquipment = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('equipment_items')
        .select('*')
        .order('category, price');

      if (error) throw error;
      setEquipment((data || []).map(item => ({
        ...item,
        stat_boosts: normalizeStatBoosts(item.stat_boosts)
      })));
    } catch (error: unknown) {
      const fallbackMessage = "Failed to load equipment store";
      const errorMessage = error instanceof Error ? error.message : fallbackMessage;
      console.error('Error loading equipment:', errorMessage, error);
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage === fallbackMessage ? fallbackMessage : `${fallbackMessage}: ${errorMessage}`,
      });
    }
  }, [toast]);

  const loadEquipmentUpgrades = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('equipment_upgrades')
        .select('*')
        .order('tier', { ascending: true });

      if (error) throw error;

      const grouped = (data || []).reduce((acc, upgrade) => {
        const entry: EquipmentUpgrade = {
          id: upgrade.id,
          equipment_id: upgrade.equipment_id,
          tier: upgrade.tier,
          cost: upgrade.cost,
          stat_boosts: normalizeStatBoosts(upgrade.stat_boosts),
          description: upgrade.description ?? null
        };

        if (!acc[entry.equipment_id]) {
          acc[entry.equipment_id] = [];
        }

        acc[entry.equipment_id]!.push(entry);
        return acc;
      }, {} as Record<string, EquipmentUpgrade[]>);

      Object.keys(grouped).forEach(key => {
        grouped[key].sort((a, b) => a.tier - b.tier);
      });

      setEquipmentUpgrades(grouped);
    } catch (error: unknown) {
      const fallbackMessage = "Failed to load equipment upgrades";
      const errorMessage = error instanceof Error ? error.message : fallbackMessage;
      console.error('Error loading equipment upgrades:', errorMessage, error);
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage === fallbackMessage ? fallbackMessage : `${fallbackMessage}: ${errorMessage}`,
      });
    }
  }, [toast]);

  const loadPlayerEquipment = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('player_equipment')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;
      setPlayerEquipment((data || []).map(item => ({
        ...item,
        is_equipped: Boolean(item.is_equipped ?? item.equipped),
        equipped: 'equipped' in item ? Boolean(item.equipped ?? item.is_equipped) : undefined,
        upgrade_level: item.upgrade_level ?? 0
      })));
    } catch (error: unknown) {
      const fallbackMessage = 'Failed to load player equipment';
      const errorMessage = error instanceof Error ? error.message : fallbackMessage;
      console.error('Error loading player equipment:', errorMessage, error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadEquipment();
      loadPlayerEquipment();
      loadEquipmentUpgrades();
    }
  }, [user, loadEquipment, loadPlayerEquipment, loadEquipmentUpgrades]);

  const purchaseEquipment = async (item: EquipmentItem) => {
    if (purchasing) return;

    if (!user) {
      toast({
        variant: "destructive",
        title: "Authentication required",
        description: "Please sign in to purchase equipment.",
      });
      return;
    }

    if (!profile) {
      toast({
        variant: "destructive",
        title: "Profile unavailable",
        description: "We couldn't load your profile. Please try again.",
      });
      return;
    }

    if (item.stock <= 0) {
      toast({
        variant: "destructive",
        title: "Out of stock",
        description: `${item.name} is currently unavailable.`,
      });
      return;
    }

    if (profile.cash < item.price) {
      toast({
        variant: "destructive",
        title: "Insufficient funds",
        description: `You need $${item.price} but only have $${profile.cash}`,
      });
      return;
    }

    const alreadyOwned = playerEquipment.some(eq => eq.equipment_id === item.id);
    if (alreadyOwned) {
      toast({
        variant: "destructive",
        title: "Already owned",
        description: "You already own this equipment",
      });
      return;
    }

    setPurchasing(item.id);

    try {
      const { data, error } = await supabase
        .rpc('purchase_equipment_item', { p_equipment_id: item.id })
        .single();

      if (error) throw error;

      // Update local state
      const normalizedEquipment: PlayerEquipment = {
        ...data,
        is_equipped: Boolean(data.is_equipped ?? data.equipped),
        equipped: 'equipped' in data ? Boolean(data.equipped ?? data.is_equipped) : undefined,
        upgrade_level: data.upgrade_level ?? 0,
        purchased_at: data.purchased_at ?? null,
      };
      setPlayerEquipment(prev => [...prev, normalizedEquipment]);

      await addActivity('purchase', `Purchased ${item.name}`, -item.price);

      toast({
        title: 'Purchase successful!',
        description: `You bought ${item.name} for $${item.price}`,
      });

      await loadEquipment();
      await loadPlayerEquipment();
      await refetch?.();
    } catch (error: unknown) {
      const fallbackMessage = 'Failed to complete purchase';
      const errorMessage = error instanceof Error ? error.message : fallbackMessage;
      console.error('Error purchasing equipment:', errorMessage, error);
      toast({
        variant: 'destructive',
        title: 'Purchase failed',
        description: errorMessage === fallbackMessage ? fallbackMessage : `${fallbackMessage}: ${errorMessage}`,
      });
    } finally {
      setPurchasing(null);
    }
  };

  const toggleEquipment = async (equipment: PlayerEquipment) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('player_equipment')
        .update({ is_equipped: !equipment.is_equipped })
        .eq('id', equipment.id);

      if (error) throw error;

      // Update local state
      setPlayerEquipment(prev =>
        prev.map(eq =>
          eq.id === equipment.id
            ? { ...eq, is_equipped: !eq.is_equipped, equipped: !eq.is_equipped }
            : eq
        )
      );

      toast({
        title: equipment.is_equipped ? "Unequipped" : "Equipped",
        description: `Equipment ${equipment.is_equipped ? 'unequipped' : 'equipped'} successfully`,
      });
    } catch (error: unknown) {
      const fallbackMessage = "Failed to update equipment";
      const errorMessage = error instanceof Error ? error.message : fallbackMessage;
      console.error('Error toggling equipment:', errorMessage, error);
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage === fallbackMessage ? fallbackMessage : `${fallbackMessage}: ${errorMessage}`,
      });
    }
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case "common": return "bg-secondary text-secondary-foreground";
      case "rare": return "bg-primary text-primary-foreground";
      case "epic": return "bg-accent text-accent-foreground";
      case "legendary": return "bg-gradient-primary text-white";
      default: return "bg-secondary text-secondary-foreground";
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "guitar": return <Guitar className="h-6 w-6" />;
      case "microphone": return <Mic className="h-6 w-6" />;
      case "audio": return <Headphones className="h-6 w-6" />;
      case "clothing": return <Shirt className="h-6 w-6" />;
      default: return <Music className="h-6 w-6" />;
    }
  };

  const isOwned = (itemId: string) => {
    return playerEquipment.some(eq => eq.equipment_id === itemId);
  };

  const getOwnedEquipment = (itemId: string) => {
    return playerEquipment.find(eq => eq.equipment_id === itemId);
  };

  const getUpgradesForItem = (equipmentId: string) => {
    return equipmentUpgrades[equipmentId] || [];
  };

  const getNextUpgrade = (equipmentId: string, currentTier: number) => {
    return getUpgradesForItem(equipmentId).find(upgrade => upgrade.tier === currentTier + 1);
  };

  const getMaxUpgradeTier = (equipmentId: string) => {
    const upgrades = getUpgradesForItem(equipmentId);
    if (!upgrades.length) return 0;
    return upgrades[upgrades.length - 1].tier;
  };

  const getStatBoostDisplay = (boosts: Record<string, number>) => {
    return Object.entries(boosts).map(([stat, value]) => (
      <span key={stat} className="text-xs text-success">
        +{value} {stat}
      </span>
    ));
  };

  const upgradeEquipment = async (playerEq: PlayerEquipment) => {
    if (!user || !profile) return;

    const item = equipment.find(eq => eq.id === playerEq.equipment_id);
    if (!item) {
      toast({
        variant: "destructive",
        title: "Upgrade unavailable",
        description: "Unable to locate this equipment item."
      });
      return;
    }

    const currentTier = playerEq.upgrade_level ?? 0;
    const nextUpgrade = getNextUpgrade(playerEq.equipment_id, currentTier);

    if (!nextUpgrade) {
      toast({
        title: "Max level reached",
        description: `${item.name} is already fully upgraded.`,
      });
      return;
    }

    const currentCash = profile.cash || 0;
    if (currentCash < nextUpgrade.cost) {
      toast({
        variant: "destructive",
        title: "Insufficient funds",
        description: `Upgrading requires $${nextUpgrade.cost.toLocaleString()}, but you only have $${currentCash.toLocaleString()}.`
      });
      return;
    }

    const originalCash = currentCash;
    const newCash = originalCash - nextUpgrade.cost;
    const previousBonus = calculateTotalEquipmentBonus(playerEquipment, equipment, equipmentUpgrades);
    const updatedPlayerEquipment = playerEquipment.map(eq =>
      eq.id === playerEq.id
        ? { ...eq, upgrade_level: currentTier + 1 }
        : eq
    );

    setUpgrading(playerEq.id);

    let profileUpdated = false;

    try {
      await updateProfile({ cash: newCash });
      profileUpdated = true;

      const { error } = await supabase
        .from('player_equipment')
        .update({ upgrade_level: currentTier + 1 })
        .eq('id', playerEq.id);

      if (error) throw error;

      setPlayerEquipment(updatedPlayerEquipment);

      const newBonus = calculateTotalEquipmentBonus(updatedPlayerEquipment, equipment, equipmentUpgrades);
      const deltaStats: Record<string, number> = {};
      const affectedStats = new Set([
        ...Object.keys(previousBonus),
        ...Object.keys(newBonus)
      ]);

      affectedStats.forEach(stat => {
        const diff = (newBonus[stat] || 0) - (previousBonus[stat] || 0);
        if (diff !== 0) {
          deltaStats[stat] = diff;
        }
      });

      if (Object.keys(deltaStats).length > 0 && skills) {
        const skillUpdates: Partial<PlayerSkills> = {};

        Object.entries(deltaStats).forEach(([stat, diff]) => {
          if (stat in skills) {
            const key = stat as keyof PlayerSkills;
            const currentValue = skills[key] || 0;
            skillUpdates[key] = Math.max(0, currentValue + diff);
          }
        });

        if (Object.keys(skillUpdates).length > 0) {
          await updateSkills(skillUpdates);
        }
      }

      await addActivity(
        'upgrade',
        `Upgraded ${item.name} to Tier ${nextUpgrade.tier}`,
        -nextUpgrade.cost
      );

      toast({
        title: "Upgrade successful!",
        description: `${item.name} has reached Tier ${nextUpgrade.tier}.`
      });
    } catch (error: unknown) {
      const fallbackMessage = 'We couldn\'t apply that upgrade. Please try again.';
      const errorMessage = error instanceof Error ? error.message : fallbackMessage;
      console.error('Error upgrading equipment:', errorMessage, error);
      if (profileUpdated) {
        try {
          await updateProfile({ cash: originalCash });
        } catch (rollbackError) {
          console.error('Failed to revert cash after upgrade error:', rollbackError);
        }
      }

      toast({
        variant: "destructive",
        title: "Upgrade failed",
        description: errorMessage === fallbackMessage ? fallbackMessage : `${fallbackMessage} (${errorMessage})`
      });
    } finally {
      setUpgrading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-stage flex items-center justify-center p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg font-oswald">Loading equipment store...</p>
        </div>
      </div>
    );
  }

  const categories = ['guitar', 'microphone', 'audio', 'clothing'];
  const groupedEquipment = categories.reduce((acc, category) => {
    acc[category] = equipment.filter(item => item.category === category);
    return acc;
  }, {} as Record<string, EquipmentItem[]>);

  return (
    <div className="min-h-screen bg-gradient-stage p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Equipment Store
            </h1>
            <p className="text-muted-foreground">Upgrade your gear to boost your performance</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-card/80 backdrop-blur-sm border border-primary/20 rounded-lg px-4 py-2">
              <DollarSign className="h-5 w-5 text-success" />
              <span className="text-xl font-bold text-success">
                ${profile?.cash?.toLocaleString() || 0}
              </span>
            </div>
          </div>
        </div>

        <Tabs defaultValue="store" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="store">Store</TabsTrigger>
            <TabsTrigger value="inventory">My Equipment</TabsTrigger>
          </TabsList>

          <TabsContent value="store">
            <Tabs defaultValue="guitar" className="space-y-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="guitar" className="flex items-center gap-2">
                  <Guitar className="h-4 w-4" />
                  Guitars
                </TabsTrigger>
                <TabsTrigger value="microphone" className="flex items-center gap-2">
                  <Mic className="h-4 w-4" />
                  Microphones
                </TabsTrigger>
                <TabsTrigger value="audio" className="flex items-center gap-2">
                  <Headphones className="h-4 w-4" />
                  Audio
                </TabsTrigger>
                <TabsTrigger value="clothing" className="flex items-center gap-2">
                  <Shirt className="h-4 w-4" />
                  Style
                </TabsTrigger>
              </TabsList>

              {categories.map(category => (
                <TabsContent key={category} value={category}>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {groupedEquipment[category]?.map((item) => (
                      <Card key={item.id} className="bg-card/80 backdrop-blur-sm border-primary/20">
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              {getCategoryIcon(item.category)}
                              <div>
                                <CardTitle className="text-lg">{item.name}</CardTitle>
                                <Badge className={getRarityColor(item.rarity)} variant="outline">
                                  {item.rarity}
                                </Badge>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              {item.stock <= 0 && (
                                <Badge variant="destructive" className="flex items-center gap-1 text-xs">
                                  <Lock className="h-3 w-3" />
                                  Out of Stock
                                </Badge>
                              )}
                              {isOwned(item.id) && (
                                <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                                  <Check className="h-3 w-3" />
                                  Owned
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <CardDescription>{item.description}</CardDescription>
                          
                          <div className="flex flex-wrap gap-2">
                            {getStatBoostDisplay(item.stat_boosts)}
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <DollarSign className="h-4 w-4 text-success" />
                                <span className="text-xl font-bold">${item.price.toLocaleString()}</span>
                              </div>
                              <Badge
                                variant={item.stock > 0 ? "outline" : "destructive"}
                                className="w-fit text-xs flex items-center gap-1"
                              >
                                {item.stock > 0 ? (
                                  `${item.stock} in stock`
                                ) : (
                                  <>
                                    <Lock className="h-3 w-3" />
                                    Out of Stock
                                  </>
                                )}
                              </Badge>
                            </div>

                            <Button
                              onClick={() => purchaseEquipment(item)}
                              disabled={isOwned(item.id) || purchasing !== null || (profile?.cash || 0) < item.price || item.stock <= 0}
                              className="bg-gradient-primary hover:shadow-electric"
                            >
                              {purchasing === item.id ? (
                                "Purchasing..."
                              ) : isOwned(item.id) ? (
                                "Owned"
                              ) : item.stock <= 0 ? (
                                "Out of Stock"
                              ) : (profile?.cash || 0) < item.price ? (
                                "Can't Afford"
                              ) : (
                                <>
                                  <ShoppingCart className="h-4 w-4 mr-2" />
                                  Buy
                                </>
                              )}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </TabsContent>

          <TabsContent value="inventory">
            <div className="space-y-6">
              {playerEquipment.length === 0 ? (
                <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
                  <CardContent className="text-center py-12">
                    <ShoppingCart className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No Equipment Yet</h3>
                    <p className="text-muted-foreground">Visit the store to buy your first piece of equipment!</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {playerEquipment.map((playerEq) => {
                    const item = equipment.find(eq => eq.id === playerEq.equipment_id);
                    if (!item) return null;

                    const upgradesForItem = getUpgradesForItem(item.id);
                    const currentTier = playerEq.upgrade_level ?? 0;
                    const nextUpgrade = getNextUpgrade(item.id, currentTier);
                    const maxTier = getMaxUpgradeTier(item.id);
                    const isUpgrading = upgrading === playerEq.id;
                    const availableCash = profile?.cash ?? 0;
                    const upgradeDisabled = !nextUpgrade || isUpgrading || availableCash < nextUpgrade.cost;

                    return (
                      <Card key={playerEq.id} className="bg-card/80 backdrop-blur-sm border-primary/20">
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              {getCategoryIcon(item.category)}
                              <div>
                                <CardTitle className="text-lg">{item.name}</CardTitle>
                                <Badge className={getRarityColor(item.rarity)} variant="outline">
                                  {item.rarity}
                                </Badge>
                              </div>
                            </div>
                            {playerEq.is_equipped && (
                              <Badge variant="default" className="bg-success text-success-foreground">
                                Equipped
                              </Badge>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-5">
                          <CardDescription>{item.description}</CardDescription>

                          <div className="flex flex-wrap gap-2">
                            {getStatBoostDisplay(item.stat_boosts)}
                          </div>

                          <div className="space-y-3">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <Button
                                onClick={() => toggleEquipment(playerEq)}
                                variant={playerEq.is_equipped ? "outline" : "default"}
                                className="w-full sm:w-auto"
                              >
                                {playerEq.is_equipped ? "Unequip" : "Equip"}
                              </Button>

                              <Button
                                onClick={() => upgradeEquipment(playerEq)}
                                variant="secondary"
                                className="w-full sm:w-auto"
                                disabled={upgradeDisabled}
                              >
                                {isUpgrading ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Upgrading...
                                  </>
                                ) : nextUpgrade ? (
                                  <>
                                    <Zap className="h-4 w-4 mr-2" />
                                    Upgrade (${nextUpgrade.cost.toLocaleString()})
                                  </>
                                ) : (
                                  <>
                                    <Zap className="h-4 w-4 mr-2" />
                                    Max Tier
                                  </>
                                )}
                              </Button>
                            </div>

                            <div className="rounded-lg border border-primary/20 bg-card/60 px-3 py-2 space-y-2">
                              <div className="flex items-center justify-between text-sm font-medium">
                                <span>
                                  Current Tier: {currentTier}
                                  {maxTier ? ` / ${maxTier}` : ''}
                                </span>
                                {nextUpgrade && (
                                  <span className="flex items-center gap-1 text-success">
                                    <DollarSign className="h-3 w-3" />
                                    {nextUpgrade.cost.toLocaleString()}
                                  </span>
                                )}
                              </div>

                              {nextUpgrade ? (
                                <>
                                  <div className="flex flex-wrap gap-2">
                                    {getStatBoostDisplay(nextUpgrade.stat_boosts)}
                                  </div>
                                  {nextUpgrade.description && (
                                    <p className="text-xs text-muted-foreground">
                                      {nextUpgrade.description}
                                    </p>
                                  )}
                                </>
                              ) : upgradesForItem.length > 0 ? (
                                <p className="text-xs text-muted-foreground">
                                  Fully upgraded.
                                </p>
                              ) : (
                                <p className="text-xs text-muted-foreground">
                                  No upgrades available for this item yet.
                                </p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default EquipmentStore;