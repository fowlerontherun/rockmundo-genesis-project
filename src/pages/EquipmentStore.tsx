import { useState, useEffect } from "react";
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
  Lock
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useGameData } from "@/hooks/useGameData";

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
  purchased_at: string;
}

const EquipmentStore = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { profile, refetch } = useGameData();
  
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [playerEquipment, setPlayerEquipment] = useState<PlayerEquipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadEquipment();
      loadPlayerEquipment();
    }
  }, [user]);

  const loadEquipment = async () => {
    try {
      const { data, error } = await supabase
        .from('equipment_items')
        .select('*')
        .order('category, price');

      if (error) throw error;
      setEquipment((data || []).map(item => ({
        ...item,
        stat_boosts: (item.stat_boosts as Record<string, number>) || {},
        stock: typeof item.stock === "number" ? item.stock : 0
      })));
    } catch (error: any) {
      console.error('Error loading equipment:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load equipment store",
      });
    }
  };

  const loadPlayerEquipment = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('player_equipment')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;
      setPlayerEquipment(data || []);
    } catch (error: any) {
      console.error('Error loading player equipment:', error);
    } finally {
      setLoading(false);
    }
  };

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

      if (error) {
        const message = error.message?.toLowerCase() ?? '';

        if (message.includes('out of stock')) {
          toast({
            variant: 'destructive',
            title: 'Out of stock',
            description: `${item.name} is currently unavailable.`,
          });
        } else if (message.includes('insufficient')) {
          toast({
            variant: 'destructive',
            title: 'Insufficient funds',
            description: `You need $${item.price} but only have $${profile.cash}`,
          });
        } else if (message.includes('already owned')) {
          toast({
            variant: 'destructive',
            title: 'Already owned',
            description: 'You already own this equipment',
          });
        } else {
          toast({
            variant: 'destructive',
            title: 'Purchase failed',
            description: 'Failed to complete purchase',
          });
        }

        return;
      }

      if (data) {
        setEquipment(prev => prev.map(eq =>
          eq.id === item.id
            ? { ...eq, stock: data.remaining_stock }
            : eq
        ));
      }

      toast({
        title: 'Purchase successful!',
        description: `You bought ${item.name} for $${item.price}`,
      });

      await loadEquipment();
      await loadPlayerEquipment();
      await refetch?.();
    } catch (error: any) {
      console.error('Error purchasing equipment:', error);
      toast({
        variant: 'destructive',
        title: 'Purchase failed',
        description: 'Failed to complete purchase',
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
            ? { ...eq, is_equipped: !eq.is_equipped }
            : eq
        )
      );

      toast({
        title: equipment.is_equipped ? "Unequipped" : "Equipped",
        description: `Equipment ${equipment.is_equipped ? 'unequipped' : 'equipped'} successfully`,
      });
    } catch (error: any) {
      console.error('Error toggling equipment:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update equipment",
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

  const getStatBoostDisplay = (boosts: Record<string, number>) => {
    return Object.entries(boosts).map(([stat, value]) => (
      <span key={stat} className="text-xs text-success">
        +{value} {stat}
      </span>
    ));
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
                        <CardContent className="space-y-4">
                          <CardDescription>{item.description}</CardDescription>
                          
                          <div className="flex flex-wrap gap-2">
                            {getStatBoostDisplay(item.stat_boosts)}
                          </div>

                          <Button
                            onClick={() => toggleEquipment(playerEq)}
                            variant={playerEq.is_equipped ? "outline" : "default"}
                            className="w-full"
                          >
                            {playerEq.is_equipped ? "Unequip" : "Equip"}
                          </Button>
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