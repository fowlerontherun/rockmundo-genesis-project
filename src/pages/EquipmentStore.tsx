import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Guitar, 
  Mic, 
  Headphones,
  DollarSign,
  ShoppingCart,
  Zap,
  Volume2,
  Music
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const EquipmentStore = () => {
  const { toast } = useToast();
  const [playerCash] = useState(15420);
  const [ownedEquipment, setOwnedEquipment] = useState<string[]>([]);

  const equipment = {
    guitars: [
      { id: "acoustic-basic", name: "Acoustic Guitar", price: 300, boost: "+5 Acoustic Performance", icon: <Guitar className="h-6 w-6" />, rarity: "common" },
      { id: "electric-starter", name: "Electric Guitar Starter", price: 800, boost: "+8 Rock Performance", icon: <Zap className="h-6 w-6" />, rarity: "common" },
      { id: "gibson-les-paul", name: "Gibson Les Paul", price: 2500, boost: "+15 Rock Performance", icon: <Guitar className="h-6 w-6" />, rarity: "rare" },
      { id: "fender-stratocaster", name: "Fender Stratocaster", price: 3200, boost: "+18 Lead Guitar", icon: <Zap className="h-6 w-6" />, rarity: "epic" }
    ],
    microphones: [
      { id: "sm58", name: "Shure SM58", price: 120, boost: "+6 Vocal Clarity", icon: <Mic className="h-6 w-6" />, rarity: "common" },
      { id: "condenser-pro", name: "Condenser Mic Pro", price: 450, boost: "+12 Studio Recording", icon: <Mic className="h-6 w-6" />, rarity: "rare" },
      { id: "neumann-u87", name: "Neumann U87", price: 1800, boost: "+20 Studio Quality", icon: <Mic className="h-6 w-6" />, rarity: "legendary" }
    ],
    audio: [
      { id: "headphones-basic", name: "Studio Headphones", price: 80, boost: "+4 Mix Quality", icon: <Headphones className="h-6 w-6" />, rarity: "common" },
      { id: "monitor-speakers", name: "Studio Monitors", price: 600, boost: "+10 Production", icon: <Volume2 className="h-6 w-6" />, rarity: "rare" },
      { id: "interface-pro", name: "Audio Interface Pro", price: 1200, boost: "+15 Recording Quality", icon: <Music className="h-6 w-6" />, rarity: "epic" }
    ]
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

  const handlePurchase = (item: any) => {
    if (playerCash >= item.price) {
      setOwnedEquipment([...ownedEquipment, item.id]);
      toast({
        title: "Equipment Purchased!",
        description: `You bought ${item.name} for $${item.price}`,
      });
    } else {
      toast({
        title: "Not Enough Cash",
        description: `You need $${item.price - playerCash} more to buy this item`,
        variant: "destructive"
      });
    }
  };

  const renderEquipmentGrid = (items: any[]) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((item) => (
        <Card key={item.id} className="bg-card/80 backdrop-blur-sm border-primary/20 hover:border-primary/40 transition-all">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="text-primary">{item.icon}</div>
                <div>
                  <CardTitle className="text-lg">{item.name}</CardTitle>
                  <Badge className={`text-xs mt-1 ${getRarityColor(item.rarity)}`}>
                    {item.rarity}
                  </Badge>
                </div>
              </div>
            </div>
            <CardDescription>{item.boost}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-success font-bold">
                <DollarSign className="h-4 w-4" />
                {item.price.toLocaleString()}
              </div>
              <Button 
                onClick={() => handlePurchase(item)}
                disabled={ownedEquipment.includes(item.id) || playerCash < item.price}
                className="bg-gradient-primary hover:shadow-electric"
              >
                {ownedEquipment.includes(item.id) ? (
                  "Owned"
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
  );

  return (
    <div className="min-h-screen bg-gradient-stage p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Equipment Store
            </h1>
            <p className="text-muted-foreground">Upgrade your gear to boost your performance</p>
          </div>
          <Card className="bg-card/80 backdrop-blur-sm border-success/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-success font-bold">
                <DollarSign className="h-5 w-5" />
                ${playerCash.toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="guitars" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-secondary/50">
            <TabsTrigger value="guitars" className="flex items-center gap-2">
              <Guitar className="h-4 w-4" />
              Guitars
            </TabsTrigger>
            <TabsTrigger value="microphones" className="flex items-center gap-2">
              <Mic className="h-4 w-4" />
              Microphones
            </TabsTrigger>
            <TabsTrigger value="audio" className="flex items-center gap-2">
              <Headphones className="h-4 w-4" />
              Audio Gear
            </TabsTrigger>
          </TabsList>

          <TabsContent value="guitars" className="mt-6">
            {renderEquipmentGrid(equipment.guitars)}
          </TabsContent>

          <TabsContent value="microphones" className="mt-6">
            {renderEquipmentGrid(equipment.microphones)}
          </TabsContent>

          <TabsContent value="audio" className="mt-6">
            {renderEquipmentGrid(equipment.audio)}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default EquipmentStore;