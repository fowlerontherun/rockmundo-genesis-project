import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { 
  Search, ShoppingCart, MessageSquare, TrendingDown, 
  Clock, DollarSign, Wrench, AlertCircle
} from "lucide-react";
import { GearListing, useGearMarketplace } from "@/hooks/useGearMarketplace";
import { useGameData } from "@/hooks/useGameData";
import { cn } from "@/lib/utils";
import { getGearImage } from "@/utils/gearImages";

const rarityColors: Record<string, string> = {
  common: "bg-slate-500",
  uncommon: "bg-emerald-500",
  rare: "bg-blue-500",
  epic: "bg-purple-500",
  legendary: "bg-amber-500",
};

const conditionLabels: Record<string, { label: string; color: string }> = {
  excellent: { label: "Excellent", color: "text-emerald-500" },
  good: { label: "Good", color: "text-blue-500" },
  fair: { label: "Fair", color: "text-amber-500" },
  poor: { label: "Poor", color: "text-red-500" },
};

const getConditionLabel = (condition: number) => {
  if (condition >= 90) return conditionLabels.excellent;
  if (condition >= 70) return conditionLabels.good;
  if (condition >= 50) return conditionLabels.fair;
  return conditionLabels.poor;
};

export const GearMarketplaceBrowser = () => {
  const { profile } = useGameData();
  const userId = profile?.user_id;
  const { listings, isLoading, buyGear, makeOffer, isBuying, isMakingOffer } = useGearMarketplace(userId);

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [conditionFilter, setConditionFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [selectedListing, setSelectedListing] = useState<GearListing | null>(null);
  const [offerAmount, setOfferAmount] = useState("");
  const [offerMessage, setOfferMessage] = useState("");

  const categories = useMemo(() => {
    const cats = new Set(listings.map(l => l.equipment?.category).filter(Boolean));
    return ["all", ...Array.from(cats)];
  }, [listings]);

  const filteredListings = useMemo(() => {
    let filtered = listings.filter(listing => {
      if (listing.seller_user_id === userId) return false; // Hide own listings
      
      const matchesSearch = 
        listing.equipment?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        listing.equipment?.brand?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = categoryFilter === "all" || listing.equipment?.category === categoryFilter;
      
      const matchesCondition = conditionFilter === "all" || 
        (conditionFilter === "excellent" && listing.condition_at_listing >= 90) ||
        (conditionFilter === "good" && listing.condition_at_listing >= 70 && listing.condition_at_listing < 90) ||
        (conditionFilter === "fair" && listing.condition_at_listing >= 50 && listing.condition_at_listing < 70) ||
        (conditionFilter === "poor" && listing.condition_at_listing < 50);
      
      return matchesSearch && matchesCategory && matchesCondition;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case "price-low": return a.asking_price - b.asking_price;
        case "price-high": return b.asking_price - a.asking_price;
        case "condition": return b.condition_at_listing - a.condition_at_listing;
        case "savings": {
          const aSavings = (a.equipment?.base_price || 0) - a.asking_price;
          const bSavings = (b.equipment?.base_price || 0) - b.asking_price;
          return bSavings - aSavings;
        }
        default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    return filtered;
  }, [listings, searchQuery, categoryFilter, conditionFilter, sortBy, userId]);

  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const handleBuy = (listing: GearListing) => {
    if (!userId) return;
    buyGear({ listingId: listing.id, price: listing.asking_price });
  };

  const handleMakeOffer = () => {
    if (!selectedListing || !offerAmount) return;
    makeOffer({
      listingId: selectedListing.id,
      offerAmount: parseFloat(offerAmount),
      message: offerMessage || undefined,
    });
    setSelectedListing(null);
    setOfferAmount("");
    setOfferMessage("");
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Loading marketplace...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="md:col-span-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search gear..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div>
              <Label>Category</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat} className="capitalize">
                      {cat === "all" ? "All Categories" : cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Condition</Label>
              <Select value={conditionFilter} onValueChange={setConditionFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any Condition</SelectItem>
                  <SelectItem value="excellent">Excellent (90%+)</SelectItem>
                  <SelectItem value="good">Good (70-89%)</SelectItem>
                  <SelectItem value="fair">Fair (50-69%)</SelectItem>
                  <SelectItem value="poor">Poor (&lt;50%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sort By</Label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="price-low">Price: Low to High</SelectItem>
                  <SelectItem value="price-high">Price: High to Low</SelectItem>
                  <SelectItem value="condition">Best Condition</SelectItem>
                  <SelectItem value="savings">Biggest Savings</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results count */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{filteredListings.length} listings found</span>
        <span className="flex items-center gap-2">
          <DollarSign className="h-4 w-4" />
          Your balance: {formatCurrency(profile?.cash || 0)}
        </span>
      </div>

      {/* Listings Grid */}
      {filteredListings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No gear available matching your filters</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredListings.map((listing) => {
            const equipment = listing.equipment;
            const savings = (equipment?.base_price || 0) - listing.asking_price;
            const savingsPercent = Math.round((savings / (equipment?.base_price || 1)) * 100);
            const conditionInfo = getConditionLabel(listing.condition_at_listing);
            const canAfford = (profile?.cash || 0) >= listing.asking_price;

            return (
              <Card key={listing.id} className="relative overflow-hidden">
                {/* Gear Image */}
                <div className="w-full h-24 overflow-hidden bg-muted/30">
                  <img 
                    src={getGearImage(equipment?.category, equipment?.subcategory)} 
                    alt={equipment?.name || "Gear"}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Rarity indicator */}
                <div className={cn(
                  "absolute top-0 right-0 w-16 h-16 opacity-10",
                  rarityColors[equipment?.rarity?.toLowerCase() || "common"]
                )} style={{ clipPath: "polygon(100% 0, 0 0, 100% 100%)" }} />

                {/* Savings badge */}
                {savings > 0 && (
                  <Badge className="absolute top-2 left-2 bg-success text-success-foreground">
                    <TrendingDown className="h-3 w-3 mr-1" />
                    {savingsPercent}% off
                  </Badge>
                )}

                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-sm truncate">{equipment?.name}</CardTitle>
                      {equipment?.brand && (
                        <p className="text-xs text-muted-foreground font-medium">{equipment.brand}</p>
                      )}
                    </div>
                    <Badge className={cn("text-[10px]", rarityColors[equipment?.rarity?.toLowerCase() || "common"])}>
                      {equipment?.rarity}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {/* Condition */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1">
                        <Wrench className="h-3 w-3" />
                        Condition
                      </span>
                      <span className={cn("font-medium", conditionInfo.color)}>
                        {conditionInfo.label} ({listing.condition_at_listing}%)
                      </span>
                    </div>
                    <Progress value={listing.condition_at_listing} className="h-1.5" />
                  </div>

                  {/* Condition description */}
                  {listing.condition_description && (
                    <p className="text-[11px] text-muted-foreground italic line-clamp-2">
                      "{listing.condition_description}"
                    </p>
                  )}

                  {/* Pricing */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-primary">
                        {formatCurrency(listing.asking_price)}
                      </span>
                      {savings > 0 && (
                        <span className="text-xs text-muted-foreground line-through">
                          {formatCurrency(equipment?.base_price || 0)}
                        </span>
                      )}
                    </div>
                    {savings > 0 && (
                      <p className="text-xs text-emerald-500 font-medium">
                        You save {formatCurrency(savings)}
                      </p>
                    )}
                  </div>

                  {/* Expiry */}
                  {listing.expires_at && (
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      Expires {new Date(listing.expires_at).toLocaleDateString()}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => handleBuy(listing)}
                      disabled={!canAfford || isBuying}
                    >
                      <ShoppingCart className="h-3 w-3 mr-1" />
                      {canAfford ? "Buy Now" : "Can't Afford"}
                    </Button>
                    
                    {listing.allow_negotiation && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedListing(listing)}
                          >
                            <MessageSquare className="h-3 w-3" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Make an Offer</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <p className="font-medium">{equipment?.name}</p>
                              <p className="text-sm text-muted-foreground">
                                Asking price: {formatCurrency(listing.asking_price)}
                              </p>
                              {listing.min_acceptable_price && (
                                <p className="text-xs text-amber-500 flex items-center gap-1">
                                  <AlertCircle className="h-3 w-3" />
                                  Seller's minimum: {formatCurrency(listing.min_acceptable_price)}
                                </p>
                              )}
                            </div>
                            <div>
                              <Label>Your Offer</Label>
                              <Input
                                type="number"
                                placeholder="Enter amount..."
                                value={offerAmount}
                                onChange={(e) => setOfferAmount(e.target.value)}
                              />
                            </div>
                            <div>
                              <Label>Message (optional)</Label>
                              <Textarea
                                placeholder="Add a message to the seller..."
                                value={offerMessage}
                                onChange={(e) => setOfferMessage(e.target.value)}
                              />
                            </div>
                            <Button 
                              className="w-full" 
                              onClick={handleMakeOffer}
                              disabled={!offerAmount || isMakingOffer}
                            >
                              Submit Offer
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
