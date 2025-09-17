import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { ShoppingCart, Guitar, Mic, Volume2, Star, TrendingUp, Coins, CheckCircle, Lock } from "lucide-react";

interface EquipmentItem {
  id: string;
  name: string;
  description: string;
  category: string;
  subcategory: string;
  price: number;
  rarity: string;
  stock: number;
  stat_boosts: {
    guitar?: number;
    vocals?: number;
    drums?: number;
    bass?: number;
    performance?: number;
    songwriting?: number;
  };
  image_url?: string;
}

interface PlayerEquipment {
  id: string;
  equipment_id: string;
  is_equipped: boolean;
  purchased_at: string;
  equipment_items: EquipmentItem;
}

const EquipmentStore = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [playerEquipment, setPlayerEquipment] = useState<PlayerEquipment[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [purchasingItemId, setPurchasingItemId] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");

  const categories = ["all", "instruments", "accessories", "studio", "stage"];
  
  const rarityColors = {
    common: "bg-gray-500",
    uncommon: "bg-green-500", 
    rare: "bg-blue-500",
    epic: "bg-purple-500",
    legendary: "bg-yellow-500"
  };

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      const [equipmentResponse, playerEquipmentResponse, profileResponse] = await Promise.all([
        supabase.from("equipment_items").select("*").order("price", { ascending: true }),
        supabase.from("player_equipment").select("*").eq("user_id", user?.id),
        supabase.from("profiles").select("*").eq("user_id", user?.id).single()
      ]);

      if (equipmentResponse.data) {
        // Transform the data to ensure stat_boosts is properly typed
        const transformedEquipment = equipmentResponse.data.map(item => ({
          ...item,
          stat_boosts: (item.stat_boosts as any) || {},
          stock: typeof item.stock === "number" ? item.stock : 0
        }));
        setEquipment(transformedEquipment);
      }
      
      if (playerEquipmentResponse.data) {
        // Fetch equipment details for player equipment
        const playerEquipmentWithDetails = await Promise.all(
          playerEquipmentResponse.data.map(async (playerItem) => {
            const { data: equipmentItem } = await supabase
              .from("equipment_items")
              .select("*")
              .eq("id", playerItem.equipment_id)
              .single();

            return {
              ...playerItem,
              equipment_items: equipmentItem ? {
                ...equipmentItem,
                stat_boosts: (equipmentItem.stat_boosts as any) || {}
              } : null
            };
          })
        );
        
        setPlayerEquipment(playerEquipmentWithDetails.filter(item => item.equipment_items) as PlayerEquipment[]);
      }
      
      if (profileResponse.data) setProfile(profileResponse.data);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const purchaseEquipment = async (item: EquipmentItem) => {
    if (purchasingItemId) return;

    if (!user) {
      toast({
        variant: "destructive",
        title: "Authentication Required",
        description: "Please sign in to purchase equipment."
      });
      return;
    }

    if (item.stock <= 0) {
      toast({
        variant: "destructive",
        title: "Out of Stock",
        description: `${item.name} is currently unavailable.`
      });
      return;
    }

    if ((profile?.cash || 0) < item.price) {
      toast({
        variant: "destructive",
        title: "Insufficient Funds",
        description: `You need $${item.price} to purchase this equipment.`
      });
      return;
    }

    setPurchasingItemId(item.id);

    try {
      const { data, error } = await supabase
        .rpc("purchase_equipment_item", { p_equipment_id: item.id })
        .single();

      if (error) {
        const message = error.message?.toLowerCase() ?? "";

        if (message.includes("out of stock")) {
          toast({
            variant: "destructive",
            title: "Out of Stock",
            description: `${item.name} is currently unavailable.`
          });
        } else if (message.includes("insufficient")) {
          toast({
            variant: "destructive",
            title: "Insufficient Funds",
            description: `You need $${item.price} to purchase this equipment.`
          });
        } else if (message.includes("already owned")) {
          toast({
            variant: "destructive",
            title: "Already Owned",
            description: `You already own ${item.name}.`
          });
        } else {
          toast({
            variant: "destructive",
            title: "Purchase Failed",
            description: "Failed to purchase equipment. Please try again."
          });
        }

        return;
      }

      if (data) {
        setProfile(prev => prev ? { ...prev, cash: data.new_cash } : prev);
        setEquipment(prev => prev.map(eq =>
          eq.id === item.id
            ? { ...eq, stock: data.remaining_stock }
            : eq
        ));
      }

      toast({
        title: "Purchase Successful!",
        description: `You've acquired the ${item.name}. Check your inventory to equip it.`
      });

      await fetchData();
    } catch (error) {
      console.error("Error purchasing equipment:", error);
      toast({
        variant: "destructive",
        title: "Purchase Failed",
        description: "Failed to purchase equipment. Please try again."
      });
    } finally {
      setPurchasingItemId(null);
    }
  };

  const equipItem = async (playerEquipmentId: string, equipmentId: string) => {
    try {
      // First, unequip any item of the same category
      const item = equipment.find(e => e.id === equipmentId);
      if (!item) return;

      // Get all equipment IDs of the same category
      const sameCategoryIds = equipment.filter(e => e.category === item.category).map(e => e.id);
      
      // Unequip items of same category
      const { error: unequipError } = await supabase
        .from("player_equipment")
        .update({ is_equipped: false })
        .eq("user_id", user?.id)
        .in("equipment_id", sameCategoryIds);

      if (unequipError) throw unequipError;

      // Then equip the selected item
      const { error } = await supabase
        .from("player_equipment")
        .update({ is_equipped: true })
        .eq("id", playerEquipmentId);

      if (error) throw error;

      toast({
        title: "Equipment Equipped!",
        description: `${item.name} is now equipped and boosting your stats.`
      });

      fetchData(); // Refresh data

    } catch (error) {
      console.error("Error equipping item:", error);
      toast({
        variant: "destructive",
        title: "Equip Failed",
        description: "Failed to equip item. Please try again."
      });
    }
  };

  const unequipItem = async (playerEquipmentId: string) => {
    try {
      const { error } = await supabase
        .from("player_equipment")
        .update({ is_equipped: false })
        .eq("id", playerEquipmentId);

      if (error) throw error;

      toast({
        title: "Equipment Unequipped",
        description: "The item has been unequipped."
      });

      fetchData(); // Refresh data

    } catch (error) {
      console.error("Error unequipping item:", error);
      toast({
        variant: "destructive",
        title: "Unequip Failed",
        description: "Failed to unequip item. Please try again."
      });
    }
  };

  const isOwned = (itemId: string) => {
    return playerEquipment.some(pe => pe.equipment_id === itemId);
  };

  const getEquippedItem = (itemId: string) => {
    return playerEquipment.find(pe => pe.equipment_id === itemId && pe.is_equipped);
  };

  const filteredEquipment = filter === "all" 
    ? equipment 
    : equipment.filter(item => item.category === filter);

  const getStatIcon = (stat: string) => {
    switch (stat) {
      case "guitar": return <Guitar className="h-3 w-3" />;
      case "vocals": return <Mic className="h-3 w-3" />;
      case "bass": return <Volume2 className="h-3 w-3" />;
      case "drums": return <Star className="h-3 w-3" />;
      case "performance": return <TrendingUp className="h-3 w-3" />;
      case "songwriting": return <Star className="h-3 w-3" />;
      default: return <Star className="h-3 w-3" />;
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg font-oswald">Loading equipment store...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bebas tracking-wider">EQUIPMENT STORE</h1>
        <p className="text-lg text-muted-foreground font-oswald">
          Upgrade your gear and boost your musical abilities
        </p>
        <div className="flex items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-yellow-400" />
            <span className="font-oswald">${profile?.cash?.toLocaleString() || 0}</span>
          </div>
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-blue-400" />
            <span className="font-oswald">{playerEquipment.length} Items Owned</span>
          </div>
        </div>
      </div>

      <Tabs defaultValue="store" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="store">Equipment Store</TabsTrigger>
          <TabsTrigger value="inventory">My Inventory</TabsTrigger>
        </TabsList>

        <TabsContent value="store" className="space-y-6">
          <div className="flex flex-wrap gap-2 justify-center">
            {categories.map(category => (
              <Button
                key={category}
                variant={filter === category ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(category)}
                className="capitalize"
              >
                {category === "all" ? "All Equipment" : category}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEquipment.map((item) => {
              const owned = isOwned(item.id);
              const equipped = getEquippedItem(item.id);

              return (
                <Card key={item.id} className="relative overflow-hidden">
                  <div className={`absolute top-0 right-0 w-0 h-0 border-l-[40px] border-l-transparent border-t-[40px] ${rarityColors[item.rarity as keyof typeof rarityColors]}`} />
                  
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="font-oswald text-lg">{item.name}</CardTitle>
                        <CardDescription>{item.category} • {item.subcategory}</CardDescription>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant="outline" className="capitalize text-xs">
                          {item.rarity}
                        </Badge>
                        {item.stock <= 0 && (
                          <Badge variant="destructive" className="text-xs flex items-center gap-1">
                            <Lock className="h-3 w-3" />
                            Out of Stock
                          </Badge>
                        )}
                        {owned && (
                          <Badge variant="secondary" className="text-xs">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Owned
                          </Badge>
                        )}
                        {equipped && (
                          <Badge variant="default" className="text-xs">
                            Equipped
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">{item.description}</p>

                    {Object.keys(item.stat_boosts).length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">Stat Boosts:</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries(item.stat_boosts).map(([stat, boost]) => (
                            <div key={stat} className="flex items-center gap-2 text-sm">
                              {getStatIcon(stat)}
                              <span className="capitalize">{stat}</span>
                              <span className="text-green-400 font-mono">+{boost}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Coins className="h-4 w-4 text-yellow-400" />
                          <span className="font-mono text-lg">${item.price.toLocaleString()}</span>
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

                      {owned ? (
                        <Badge variant="secondary">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Owned
                        </Badge>
                      ) : (
                        <Button
                          onClick={() => purchaseEquipment(item)}
                          disabled={!!purchasingItemId || (profile?.cash || 0) < item.price || item.stock <= 0}
                          size="sm"
                        >
                          {purchasingItemId === item.id
                            ? "Buying..."
                            : item.stock <= 0
                              ? "Out of Stock"
                              : (profile?.cash || 0) < item.price
                                ? "Can't Afford"
                                : "Buy"}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {filteredEquipment.length === 0 && (
            <Card>
              <CardContent className="text-center py-12">
                <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Equipment Available</h3>
                <p className="text-muted-foreground">Check back later for new equipment!</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="inventory" className="space-y-4">
          {playerEquipment.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {playerEquipment.map((playerItem) => {
                const item = playerItem.equipment_items;
                
                return (
                  <Card key={playerItem.id} className="relative overflow-hidden">
                    <div className={`absolute top-0 right-0 w-0 h-0 border-l-[40px] border-l-transparent border-t-[40px] ${rarityColors[item.rarity as keyof typeof rarityColors]}`} />
                    
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="font-oswald text-lg">{item.name}</CardTitle>
                          <CardDescription>{item.category} • {item.subcategory}</CardDescription>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant="outline" className="capitalize text-xs">
                            {item.rarity}
                          </Badge>
                          {playerItem.is_equipped && (
                            <Badge variant="default" className="text-xs">
                              Equipped
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground">{item.description}</p>

                      {Object.keys(item.stat_boosts).length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium">Stat Boosts:</h4>
                          <div className="grid grid-cols-2 gap-2">
                            {Object.entries(item.stat_boosts).map(([stat, boost]) => (
                              <div key={stat} className="flex items-center gap-2 text-sm">
                                {getStatIcon(stat)}
                                <span className="capitalize">{stat}</span>
                                <span className="text-green-400 font-mono">+{boost}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="text-xs text-muted-foreground">
                        Purchased: {new Date(playerItem.purchased_at).toLocaleDateString()}
                      </div>

                      <Button
                        onClick={() => playerItem.is_equipped 
                          ? unequipItem(playerItem.id)
                          : equipItem(playerItem.id, item.id)
                        }
                        className="w-full"
                        variant={playerItem.is_equipped ? "outline" : "default"}
                      >
                        {playerItem.is_equipped ? "Unequip" : "Equip"}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Equipment Owned</h3>
                <p className="text-muted-foreground">Visit the store to purchase your first piece of equipment!</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EquipmentStore;