import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Plus, X, Eye, DollarSign, Clock, MessageSquare, 
  AlertCircle, Package, Wrench
} from "lucide-react";
import { useGearMarketplace, GearListing, GearOffer } from "@/hooks/useGearMarketplace";
import { useEquipmentStore, PlayerEquipment } from "@/hooks/useEquipmentStore";
import { useGameData } from "@/hooks/useGameData";
import { cn } from "@/lib/utils";

const rarityColors: Record<string, string> = {
  common: "bg-slate-500",
  uncommon: "bg-emerald-500",
  rare: "bg-blue-500",
  epic: "bg-purple-500",
  legendary: "bg-amber-500",
};

const statusColors: Record<string, string> = {
  active: "bg-emerald-500",
  sold: "bg-blue-500",
  cancelled: "bg-slate-500",
  expired: "bg-amber-500",
};

export const GearMarketplaceListings = () => {
  const { profile } = useGameData();
  const userId = profile?.user_id;
  const { inventory } = useEquipmentStore(userId);
  const { 
    myListings, receivedOffers, isLoading, 
    createListing, cancelListing, respondToOffer,
    isCreatingListing, isCancellingListing, calculateSuggestedPrice 
  } = useGearMarketplace(userId);

  const [showNewListing, setShowNewListing] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<PlayerEquipment | null>(null);
  const [askingPrice, setAskingPrice] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [allowNegotiation, setAllowNegotiation] = useState(true);
  const [conditionDesc, setConditionDesc] = useState("");
  const [description, setDescription] = useState("");

  // Get equipment that's not already listed
  const availableEquipment = inventory.filter(item => {
    const isListed = myListings.some(
      l => l.player_equipment_id === item.id && l.listing_status === "active"
    );
    return !isListed && !item.is_equipped;
  });

  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const handleSelectEquipment = (equipmentId: string) => {
    const equipment = availableEquipment.find(e => e.id === equipmentId);
    if (equipment) {
      setSelectedEquipment(equipment);
      const suggested = calculateSuggestedPrice(
        equipment.equipment.base_price,
        equipment.condition || 100,
        equipment.equipment.rarity || "common"
      );
      setAskingPrice(suggested.toString());
      setMinPrice(Math.round(suggested * 0.8).toString());
    }
  };

  const handleCreateListing = () => {
    if (!selectedEquipment || !askingPrice) return;

    createListing({
      playerEquipmentId: selectedEquipment.id,
      equipmentId: selectedEquipment.equipment_id,
      askingPrice: parseFloat(askingPrice),
      minAcceptablePrice: minPrice ? parseFloat(minPrice) : undefined,
      allowNegotiation,
      condition: selectedEquipment.condition || 100,
      conditionDescription: conditionDesc || undefined,
      description: description || undefined,
    });

    // Reset form
    setShowNewListing(false);
    setSelectedEquipment(null);
    setAskingPrice("");
    setMinPrice("");
    setConditionDesc("");
    setDescription("");
  };

  const handleCancelListing = (listingId: string) => {
    cancelListing(listingId);
  };

  const handleAcceptOffer = (offer: GearOffer) => {
    respondToOffer({ offerId: offer.id, accept: true });
  };

  const handleRejectOffer = (offer: GearOffer) => {
    respondToOffer({ offerId: offer.id, accept: false });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Loading your listings...
        </CardContent>
      </Card>
    );
  }

  const activeListings = myListings.filter(l => l.listing_status === "active");
  const soldListings = myListings.filter(l => l.listing_status === "sold");

  return (
    <div className="space-y-6">
      {/* Header with New Listing Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">My Listings</h3>
          <p className="text-sm text-muted-foreground">
            {activeListings.length} active · {soldListings.length} sold
          </p>
        </div>
        <Dialog open={showNewListing} onOpenChange={setShowNewListing}>
          <DialogTrigger asChild>
            <Button disabled={availableEquipment.length === 0}>
              <Plus className="h-4 w-4 mr-2" />
              List Gear
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>List Gear for Sale</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Select Equipment */}
              <div>
                <Label>Select Equipment</Label>
                <Select onValueChange={handleSelectEquipment}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose gear to sell..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableEquipment.map(item => (
                      <SelectItem key={item.id} value={item.id}>
                        <span className="flex items-center gap-2">
                          {item.equipment.name}
                          <Badge variant="outline" className="text-[10px]">
                            {item.condition || 100}%
                          </Badge>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedEquipment && (
                <>
                  {/* Equipment Preview */}
                  <Card className="bg-muted/50">
                    <CardContent className="pt-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{selectedEquipment.equipment.name}</span>
                        <Badge className={rarityColors[selectedEquipment.equipment.rarity?.toLowerCase() || "common"]}>
                          {selectedEquipment.equipment.rarity}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-muted-foreground">
                          Original: {formatCurrency(selectedEquipment.equipment.base_price)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Wrench className="h-3 w-3" />
                          {selectedEquipment.condition || 100}% condition
                        </span>
                      </div>
                      <Progress value={selectedEquipment.condition || 100} className="h-1.5" />
                    </CardContent>
                  </Card>

                  {/* Pricing */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Asking Price</Label>
                      <Input
                        type="number"
                        value={askingPrice}
                        onChange={(e) => setAskingPrice(e.target.value)}
                        placeholder="0.00"
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Suggested: {formatCurrency(calculateSuggestedPrice(
                          selectedEquipment.equipment.base_price,
                          selectedEquipment.condition || 100,
                          selectedEquipment.equipment.rarity || "common"
                        ))}
                      </p>
                    </div>
                    <div>
                      <Label>Minimum Acceptable</Label>
                      <Input
                        type="number"
                        value={minPrice}
                        onChange={(e) => setMinPrice(e.target.value)}
                        placeholder="Optional"
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Hidden from buyers
                      </p>
                    </div>
                  </div>

                  {/* Options */}
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Allow Offers</Label>
                      <p className="text-xs text-muted-foreground">Buyers can negotiate</p>
                    </div>
                    <Switch 
                      checked={allowNegotiation} 
                      onCheckedChange={setAllowNegotiation} 
                    />
                  </div>

                  {/* Descriptions */}
                  <div>
                    <Label>Condition Notes</Label>
                    <Input
                      value={conditionDesc}
                      onChange={(e) => setConditionDesc(e.target.value)}
                      placeholder="e.g., Minor scratches on body, plays great"
                    />
                  </div>

                  <div>
                    <Label>Description (optional)</Label>
                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Add any additional details..."
                    />
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewListing(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreateListing} 
                disabled={!selectedEquipment || !askingPrice || isCreatingListing}
              >
                List for Sale
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* No equipment available */}
      {availableEquipment.length === 0 && activeListings.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No unequipped gear available to sell</p>
            <p className="text-sm">Unequip items to list them on the marketplace</p>
          </CardContent>
        </Card>
      )}

      {/* Pending Offers */}
      {receivedOffers.length > 0 && (
        <Card className="border-primary/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Pending Offers ({receivedOffers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {receivedOffers.map(offer => {
              const listing = myListings.find(l => l.id === offer.listing_id);
              return (
                <div key={offer.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{listing?.equipment?.name}</p>
                    <p className="text-sm">
                      <span className="text-muted-foreground">Offer:</span>{" "}
                      <span className="font-semibold text-primary">{formatCurrency(offer.offer_amount)}</span>
                      <span className="text-muted-foreground ml-2">
                        (asking: {formatCurrency(listing?.asking_price || 0)})
                      </span>
                    </p>
                    {offer.message && (
                      <p className="text-xs text-muted-foreground italic">"{offer.message}"</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleAcceptOffer(offer)}>
                      Accept
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleRejectOffer(offer)}>
                      Decline
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Active Listings */}
      {activeListings.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium">Active Listings</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeListings.map(listing => (
              <Card key={listing.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-sm truncate">{listing.equipment?.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">{listing.equipment?.brand}</p>
                    </div>
                    <Badge className={statusColors[listing.listing_status]}>
                      {listing.listing_status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-lg font-bold text-primary">
                      {formatCurrency(listing.asking_price)}
                    </span>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Eye className="h-3 w-3" />
                      {listing.view_count}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    Expires {listing.expires_at ? new Date(listing.expires_at).toLocaleDateString() : "Never"}
                  </div>

                  <Button
                    size="sm"
                    variant="destructive"
                    className="w-full"
                    onClick={() => handleCancelListing(listing.id)}
                    disabled={isCancellingListing}
                  >
                    <X className="h-3 w-3 mr-1" />
                    Cancel Listing
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Sold Listings */}
      {soldListings.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium text-muted-foreground">Recently Sold</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {soldListings.slice(0, 8).map(listing => (
              <Card key={listing.id} className="bg-muted/30">
                <CardContent className="pt-4">
                  <p className="text-sm font-medium truncate">{listing.equipment?.name}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-sm text-emerald-500 font-semibold">
                      {formatCurrency(listing.asking_price)}
                    </span>
                    <Badge variant="outline" className="text-[10px]">Sold</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
