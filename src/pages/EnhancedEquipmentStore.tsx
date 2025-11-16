import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useEquipmentStore } from "@/hooks/useEquipmentStore";
import { ShoppingCart, Package, Wrench } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const EnhancedEquipmentStore = () => {
  const [user, setUser] = useState<any>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });
  }, []);

  const { catalog, inventory, isLoading, purchaseEquipment, maintainEquipment, isPurchasing, isMaintaining } =
    useEquipmentStore(user?.id);

  const filteredCatalog = catalog.filter((item) =>
    categoryFilter === "all" || item.category === categoryFilter
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Equipment Store</h1>
        <p className="text-muted-foreground">Browse professional music equipment</p>
      </div>

      <Tabs defaultValue="store">
        <TabsList>
          <TabsTrigger value="store">Store</TabsTrigger>
          <TabsTrigger value="inventory">Inventory ({inventory.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="store" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="instrument">Instruments</SelectItem>
                  <SelectItem value="amplifier">Amplifiers</SelectItem>
                  <SelectItem value="effects">Effects</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {isLoading ? (
            <Card>
              <CardContent className="p-6">Loading...</CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {filteredCatalog.map((item) => (
                <Card key={item.id}>
                  <CardHeader>
                    <CardTitle className="text-base">{item.name}</CardTitle>
                    <CardDescription>{item.brand}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold">${item.base_price.toLocaleString()}</span>
                      <Button size="sm" onClick={() => purchaseEquipment(item.id)} disabled={isPurchasing}>
                        <ShoppingCart className="h-4 w-4 mr-1" />
                        Buy
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="inventory">
          {inventory.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No equipment yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {inventory.map((item) => (
                <Card key={item.id}>
                  <CardHeader>
                    <CardTitle className="text-base">{item.equipment.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Condition</span>
                        <span>{item.condition}%</span>
                      </div>
                      <Progress value={item.condition} />
                    </div>
                    {item.condition < 100 && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => maintainEquipment(item.id)}
                        disabled={isMaintaining}
                      >
                        <Wrench className="h-4 w-4 mr-1" />
                        Maintain
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EnhancedEquipmentStore;
