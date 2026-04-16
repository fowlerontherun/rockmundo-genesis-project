import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Shield, Zap, X, ChevronDown, ChevronUp } from "lucide-react";
import { useEnchantmentSystem, type Enchantment, type EquipmentEnchantment } from "@/hooks/useEnchantmentSystem";
import { usePlayerEquipment, type PlayerEquipmentWithItem } from "@/hooks/usePlayerEquipment";

const RARITY_COLORS: Record<string, string> = {
  common: "bg-muted text-muted-foreground",
  uncommon: "bg-green-500/20 text-green-400 border-green-500/30",
  rare: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  epic: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  legendary: "bg-amber-500/20 text-amber-300 border-amber-500/30",
};

const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
  tone: { label: "Tone", icon: "🎵" },
  durability: { label: "Durability", icon: "🛡️" },
  stage_presence: { label: "Stage Presence", icon: "✨" },
  fame: { label: "Fame", icon: "⭐" },
  luck: { label: "Luck", icon: "🍀" },
  versatility: { label: "Versatility", icon: "🎚️" },
};

export const EnchantmentPanel = () => {
  const {
    catalog,
    appliedEnchantments,
    isLoading,
    applyEnchantment,
    isApplying,
    removeEnchantment,
    isRemoving,
    getEnchantmentsForEquipment,
  } = useEnchantmentSystem();

  const { data: equipmentData } = usePlayerEquipment();
  const equipment = equipmentData?.items || [];

  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-8 bg-muted rounded w-48" />
        <div className="h-32 bg-muted rounded" />
      </div>
    );
  }

  const selectedItem = equipment.find((e) => e.id === selectedEquipment);
  const selectedEnchantments = selectedEquipment
    ? getEnchantmentsForEquipment(selectedEquipment)
    : [];

  const categories = Object.keys(CATEGORY_LABELS);

  const formatStatMods = (mods: Record<string, number>) =>
    Object.entries(mods)
      .map(([key, val]) => `${key.replace(/_/g, " ")}: ${val > 0 ? "+" : ""}${val}`)
      .join(", ");

  return (
    <div className="space-y-4">
      {/* Step 1: Select Equipment */}
      <div>
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
          <Shield className="w-4 h-4" /> Select Equipment to Enchant
        </h3>
        {equipment.length === 0 ? (
          <p className="text-xs text-muted-foreground">No equipment owned. Buy or craft gear first!</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {equipment.map((item) => {
              const enchCount = getEnchantmentsForEquipment(item.id).length;
              const isSelected = selectedEquipment === item.id;
              return (
                <Card
                  key={item.id}
                  className={`cursor-pointer transition-colors border ${
                    isSelected ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"
                  }`}
                  onClick={() => setSelectedEquipment(isSelected ? null : item.id)}
                >
                  <CardContent className="p-3 flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium truncate block">
                        {item.equipment?.name || "Unknown"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {item.equipment?.category || "gear"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {enchCount > 0 && (
                        <Badge variant="secondary" className="text-[10px] h-5">
                          <Sparkles className="w-3 h-3 mr-0.5" />
                          {enchCount}
                        </Badge>
                      )}
                      {item.equipment?.rarity && (
                        <Badge
                          className={RARITY_COLORS[item.equipment.rarity] || RARITY_COLORS.common}
                          variant="outline"
                        >
                          {item.equipment.rarity}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Active enchantments on selected item */}
      {selectedEquipment && selectedEnchantments.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
            <Zap className="w-4 h-4" /> Active Enchantments
          </h3>
          <div className="space-y-1.5">
            {selectedEnchantments.map((ae) => (
              <Card key={ae.id} className="border-primary/30 bg-primary/5">
                <CardContent className="p-2.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base">{ae.enchantment?.icon || "✨"}</span>
                    <div className="min-w-0">
                      <span className="text-sm font-medium truncate block">
                        {ae.enchantment?.name}
                        {ae.stack_count > 1 && (
                          <span className="text-muted-foreground ml-1">×{ae.stack_count}</span>
                        )}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {ae.enchantment?.stat_modifier
                          ? formatStatMods(ae.enchantment.stat_modifier)
                          : ""}
                      </span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                    onClick={() => removeEnchantment(ae.id)}
                    disabled={isRemoving}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Browse & Apply Enchantments */}
      {selectedEquipment && (
        <div>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" /> Available Enchantments
          </h3>
          <div className="space-y-2">
            {categories.map((cat) => {
              const catEnchantments = catalog.filter((e) => e.category === cat);
              if (catEnchantments.length === 0) return null;
              const isExpanded = expandedCategory === cat;
              const info = CATEGORY_LABELS[cat];

              return (
                <div key={cat}>
                  <button
                    className="w-full flex items-center justify-between text-sm font-medium py-1.5 px-2 rounded hover:bg-muted/50 transition-colors"
                    onClick={() => setExpandedCategory(isExpanded ? null : cat)}
                  >
                    <span>
                      {info.icon} {info.label}{" "}
                      <span className="text-muted-foreground text-xs">({catEnchantments.length})</span>
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="space-y-1.5 mt-1">
                      {catEnchantments.map((ench) => {
                        const existing = selectedEnchantments.filter(
                          (ae) => ae.enchantment_id === ench.id
                        );
                        const currentStacks = existing.reduce(
                          (s, e) => s + e.stack_count,
                          0
                        );
                        const maxed = currentStacks >= ench.max_stacks;

                        return (
                          <Card key={ench.id} className="border-border/50">
                            <CardContent className="p-3 space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-lg">{ench.icon || "✨"}</span>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-sm font-medium">{ench.name}</span>
                                      <Badge
                                        className={RARITY_COLORS[ench.rarity] || RARITY_COLORS.common}
                                        variant="outline"
                                      >
                                        T{ench.tier}
                                      </Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                      {ench.description}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span className="text-green-400">
                                  {formatStatMods(ench.stat_modifier)}
                                </span>
                                <span>
                                  {currentStacks}/{ench.max_stacks} stacks
                                </span>
                              </div>

                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">
                                  ${ench.cash_cost} · Lv.{ench.min_skill_level}+
                                </span>
                                <Button
                                  size="sm"
                                  className="h-7 px-3"
                                  disabled={isApplying || maxed}
                                  onClick={() =>
                                    applyEnchantment({
                                      playerEquipmentId: selectedEquipment!,
                                      enchantmentId: ench.id,
                                    })
                                  }
                                >
                                  <Sparkles className="w-3 h-3 mr-1" />
                                  {maxed ? "Maxed" : "Apply"}
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!selectedEquipment && equipment.length > 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">
          Select a piece of equipment above to browse and apply enchantments.
        </p>
      )}
    </div>
  );
};
