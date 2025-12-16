import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Plus, Mic, Coffee, DoorOpen } from "lucide-react";

interface RiderItem {
  id: string;
  name: string;
  category: "technical" | "hospitality" | "backstage";
  base_cost: number;
  description?: string;
  tier_required?: string;
}

interface RiderItemCatalogProps {
  items: RiderItem[];
  onAddItem?: (item: RiderItem) => void;
  selectedItems?: string[];
  isLoading?: boolean;
}

const CATEGORY_ICONS = {
  technical: Mic,
  hospitality: Coffee,
  backstage: DoorOpen,
};

const CATEGORY_COLORS = {
  technical: "bg-blue-500/10 text-blue-600",
  hospitality: "bg-green-500/10 text-green-600",
  backstage: "bg-purple-500/10 text-purple-600",
};

export const RiderItemCatalog = ({
  items,
  onAddItem,
  selectedItems = [],
  isLoading,
}: RiderItemCatalogProps) => {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const filteredItems = items.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === "all" || item.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const technicalItems = items.filter((i) => i.category === "technical");
  const hospitalityItems = items.filter((i) => i.category === "hospitality");
  const backstageItems = items.filter((i) => i.category === "backstage");

  const renderItemCard = (item: RiderItem) => {
    const Icon = CATEGORY_ICONS[item.category];
    const isSelected = selectedItems.includes(item.id);

    return (
      <Card
        key={item.id}
        className={`transition-all ${isSelected ? "border-primary bg-primary/5" : ""}`}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${CATEGORY_COLORS[item.category]}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium">{item.name}</p>
                {item.description && (
                  <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-sm font-medium">${item.base_cost}</span>
                  {item.tier_required && (
                    <Badge variant="outline" className="text-xs">
                      {item.tier_required}+
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            {onAddItem && (
              <Button
                size="sm"
                variant={isSelected ? "secondary" : "outline"}
                onClick={() => onAddItem(item)}
                disabled={isSelected}
              >
                {isSelected ? "Added" : <Plus className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Tabs value={activeCategory} onValueChange={setActiveCategory}>
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="all">All ({items.length})</TabsTrigger>
          <TabsTrigger value="technical">
            <Mic className="h-4 w-4 mr-1 hidden sm:inline" />
            Technical ({technicalItems.length})
          </TabsTrigger>
          <TabsTrigger value="hospitality">
            <Coffee className="h-4 w-4 mr-1 hidden sm:inline" />
            Hospitality ({hospitalityItems.length})
          </TabsTrigger>
          <TabsTrigger value="backstage">
            <DoorOpen className="h-4 w-4 mr-1 hidden sm:inline" />
            Backstage ({backstageItems.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeCategory} className="mt-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading items...</div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No items found matching your criteria
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredItems.map(renderItemCard)}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
