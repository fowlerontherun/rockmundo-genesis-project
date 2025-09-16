import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useGameData } from "@/hooks/useGameData";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Package, Wrench, Star, Zap, TrendingUp, Shield } from "lucide-react";

interface InventoryItem {
  id: string;
  equipment_id: string;
  user_id: string;
  is_equipped: boolean;
  equipped?: boolean;
  condition: number;
  created_at: string;
  purchased_at: string;
  equipment: {
    id: string;
    name: string;
    category: string;
    rarity: string;
    price: number;
    stat_boosts: any; // Use any to handle JSON type from Supabase
    description: string;
  };
}

const InventoryManager = () => {
  const { user } = useAuth();
  const { profile, updateProfile } = useGameData();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = [
    { value: 'all', label: 'All Items' },
    { value: 'instruments', label: 'Instruments' },
    { value: 'amplifiers', label: 'Amplifiers' },
    { value: 'accessories', label: 'Accessories' },
    { value: 'recording', label: 'Recording' },
  ];

  useEffect(() => {
    if (user) {
      fetchInventory();
    }
  }, [user]);

  const fetchInventory = async () => {
    try {
      const { data, error } = await supabase
        .from('player_equipment')
        .select(`
          *,
          equipment:equipment_items!player_equipment_equipment_id_fkey (
            id,
            name,
            category,
            rarity,
            price,
            stat_boosts,
            description
          )
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInventory(data || []);
    } catch (error: any) {
      console.error('Error fetching inventory:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load inventory"
      });
    } finally {
      setLoading(false);
    }
  };

  const equipItem = async (item: InventoryItem) => {
    try {
      const { error } = await supabase
        .from('player_equipment')
        .update({ equipped: true })
        .eq('id', item.id);

      if (error) throw error;

      setInventory(prev => prev.map(invItem => ({
        ...invItem,
        equipped: invItem.equipment.category === item.equipment.category 
          ? invItem.id === item.id 
          : false
      })));

      toast({
        title: "Equipment Updated",
        description: `${item.equipment.name} has been equipped!`
      });
    } catch (error: any) {
      console.error('Error equipping item:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to equip item"
      });
    }
  };

  const unequipItem = async (item: InventoryItem) => {
    try {
      const { error } = await supabase
        .from('player_equipment')
        .update({ equipped: false })
        .eq('id', item.id);

      if (error) throw error;

      setInventory(prev => prev.map(invItem => 
        invItem.id === item.id 
          ? { ...invItem, equipped: false }
          : invItem
      ));

      toast({
        title: "Equipment Updated",
        description: `${item.equipment.name} has been unequipped!`
      });
    } catch (error: any) {
      console.error('Error unequipping item:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to unequip item"
      });
    }
  };

  const repairItem = async (item: InventoryItem) => {
    const repairCost = Math.floor(item.equipment.price * 0.1);
    
    if (!profile || profile.cash < repairCost) {
      toast({
        variant: "destructive",
        title: "Insufficient Funds",
        description: `Repair costs $${repairCost}. You need more cash!`
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('player_equipment')
        .update({ condition: 100 })
        .eq('id', item.id);

      if (error) throw error;

      await updateProfile({ cash: profile.cash - repairCost });

      setInventory(prev => prev.map(invItem => 
        invItem.id === item.id 
          ? { ...invItem, condition: 100 }
          : invItem
      ));

      toast({
        title: "Item Repaired",
        description: `${item.equipment.name} has been fully repaired!`
      });
    } catch (error: any) {
      console.error('Error repairing item:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to repair item"
      });
    }
  };

  const sellItem = async (item: InventoryItem) => {
    const sellPrice = Math.floor(
      item.equipment.price * 0.6 * (item.condition / 100)
    );

    try {
      const { error } = await supabase
        .from('player_equipment')
        .delete()
        .eq('id', item.id);

      if (error) throw error;

      await updateProfile({ 
        cash: (profile?.cash || 0) + sellPrice 
      });

      setInventory(prev => prev.filter(invItem => invItem.id !== item.id));

      toast({
        title: "Item Sold",
        description: `Sold ${item.equipment.name} for $${sellPrice}!`
      });
    } catch (error: any) {
      console.error('Error selling item:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to sell item"
      });
    }
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity.toLowerCase()) {
      case 'common': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100';
      case 'uncommon': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100';
      case 'rare': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100';
      case 'epic': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100';
      case 'legendary': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getConditionColor = (condition: number) => {
    if (condition >= 80) return 'text-green-600';
    if (condition >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatIcon = (stat: string) => {
    switch (stat.toLowerCase()) {
      case 'performance': return <Star className="h-4 w-4" />;
      case 'creativity': return <Zap className="h-4 w-4" />;
      case 'technical': return <TrendingUp className="h-4 w-4" />;
      case 'charisma': return <Shield className="h-4 w-4" />;
      default: return <Star className="h-4 w-4" />;
    }
  };

  const filteredInventory = selectedCategory === 'all' 
    ? inventory 
    : inventory.filter(item => item.equipment.category === selectedCategory);

  const equippedItems = inventory.filter(item => item.equipped || item.is_equipped);
  const totalValue = inventory.reduce((sum, item) => 
    sum + Math.floor(item.equipment.price * (item.condition / 100)), 0
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-stage flex items-center justify-center p-6">
        <div className="text-center">
          <Package className="h-12 w-12 mx-auto mb-4 text-primary animate-pulse" />
          <p className="text-lg text-foreground">Loading inventory...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-stage p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Inventory Manager
          </h1>
          <p className="text-lg text-muted-foreground">
            Manage your equipment collection and optimize your setup
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <Package className="h-8 w-8 mx-auto mb-2 text-primary" />
              <div className="text-2xl font-bold">{inventory.length}</div>
              <div className="text-sm text-muted-foreground">Total Items</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <Zap className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
              <div className="text-2xl font-bold">{equippedItems.length}</div>
              <div className="text-sm text-muted-foreground">Equipped</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <TrendingUp className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <div className="text-2xl font-bold">${totalValue.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Total Value</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <Wrench className="h-8 w-8 mx-auto mb-2 text-blue-500" />
              <div className="text-2xl font-bold">
                {Math.round(inventory.reduce((sum, item) => sum + item.condition, 0) / Math.max(inventory.length, 1))}%
              </div>
              <div className="text-sm text-muted-foreground">Avg Condition</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
          <TabsList className="grid w-full grid-cols-5">
            {categories.map((category) => (
              <TabsTrigger key={category.value} value={category.value}>
                {category.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={selectedCategory}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredInventory.map((item) => (
                <Card key={item.id} className={`hover:shadow-lg transition-shadow ${(item.equipped || item.is_equipped) ? 'ring-2 ring-primary' : ''}`}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">{item.equipment.name}</CardTitle>
                        <CardDescription className="capitalize">{item.equipment.category}</CardDescription>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Badge className={getRarityColor(item.equipment.rarity)}>
                          {item.equipment.rarity}
                        </Badge>
                        {(item.equipped || item.is_equipped) && (
                          <Badge variant="outline" className="text-primary border-primary">
                            Equipped
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">{item.equipment.description}</p>
                    
                    {/* Condition */}
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Condition</span>
                        <span className={getConditionColor(item.condition)}>
                          {item.condition}%
                        </span>
                      </div>
                      <Progress value={item.condition} className="h-2" />
                    </div>

                    {/* Stat Boosts */}
                    {Object.keys(item.equipment.stat_boosts).length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold mb-2">Stat Boosts</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries(item.equipment.stat_boosts || {}).map(([stat, boost]) => (
                            <div key={stat} className="flex items-center gap-1 text-sm">
                              {getStatIcon(stat)}
                              <span className="capitalize">{stat}</span>
                              <span className="text-green-600">+{String(boost)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Value */}
                    <div className="text-sm">
                      <div className="flex justify-between">
                        <span>Value:</span>
                        <span>${Math.floor(item.equipment.price * (item.condition / 100)).toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 flex-wrap">
                      {!(item.equipped || item.is_equipped) ? (
                        <Button
                          size="sm"
                          onClick={() => equipItem(item)}
                        >
                          Equip
                        </Button>
                      ) : (
                        <Button 
                          size="sm"
                          variant="outline"
                          onClick={() => unequipItem(item)}
                        >
                          Unequip
                        </Button>
                      )}
                      
                      {item.condition < 100 && (
                        <Button 
                          size="sm"
                          variant="outline"
                          onClick={() => repairItem(item)}
                        >
                          <Wrench className="h-4 w-4 mr-1" />
                          Repair (${Math.floor(item.equipment.price * 0.1)})
                        </Button>
                      )}
                      
                      <Button 
                        size="sm"
                        variant="destructive"
                        onClick={() => sellItem(item)}
                      >
                        Sell
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredInventory.length === 0 && (
              <Card className="text-center py-12">
                <CardContent>
                  <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-xl font-semibold mb-2">No Items Found</h3>
                  <p className="text-muted-foreground">
                    {selectedCategory === 'all' 
                      ? "Your inventory is empty. Visit the equipment store to buy some gear!"
                      : `No ${selectedCategory} found in your inventory.`
                    }
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default InventoryManager;