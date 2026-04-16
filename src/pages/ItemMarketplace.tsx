import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  ShoppingBag, Search, DollarSign, Tag, Package, Shirt,
  Book, Skull, Guitar, Loader2, Plus, X, MessageSquare,
  CheckCircle, XCircle, Clock, TrendingUp, History, ArrowRightLeft,
} from "lucide-react";
import { useItemMarket, type MarketListing, type MarketOffer, type ItemType } from "@/hooks/useItemMarket";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const ITEM_TYPE_CONFIG: Record<ItemType, { label: string; icon: typeof Guitar; color: string }> = {
  gear: { label: "Gear", icon: Guitar, color: "text-blue-500" },
  book: { label: "Books", icon: Book, color: "text-amber-500" },
  underworld: { label: "Underworld", icon: Skull, color: "text-purple-500" },
  clothing: { label: "Clothing", icon: Shirt, color: "text-pink-500" },
};

const RARITY_COLORS: Record<string, string> = {
  common: "bg-muted text-muted-foreground",
  uncommon: "bg-green-500/10 text-green-500 border-green-500/30",
  rare: "bg-blue-500/10 text-blue-500 border-blue-500/30",
  epic: "bg-purple-500/10 text-purple-500 border-purple-500/30",
  legendary: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
};

const ItemMarketplace = () => {
  const market = useItemMarket();
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  
  // Sell dialog
  const [sellDialogOpen, setSellDialogOpen] = useState(false);
  const [selectedSellItem, setSelectedSellItem] = useState<any>(null);
  const [sellPrice, setSellPrice] = useState("");
  const [sellNegotiable, setSellNegotiable] = useState(false);

  // Offer dialog
  const [offerDialogOpen, setOfferDialogOpen] = useState(false);
  const [offerListing, setOfferListing] = useState<MarketListing | null>(null);
  const [offerAmount, setOfferAmount] = useState("");
  const [offerMessage, setOfferMessage] = useState("");

  // Detail dialog
  const [detailListing, setDetailListing] = useState<MarketListing | null>(null);

  const filteredListings = (market.listings.data || [])
    .filter((l) => {
      if (l.seller_user_id === market.userId) return false; // Don't show own
      if (typeFilter !== "all" && l.item_type !== typeFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return l.item_name.toLowerCase().includes(q) || l.item_category?.toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "price-low") return a.asking_price - b.asking_price;
      if (sortBy === "price-high") return b.asking_price - a.asking_price;
      return new Date(b.listed_at).getTime() - new Date(a.listed_at).getTime();
    });

  const handleSell = () => {
    if (!selectedSellItem || !sellPrice) return;
    market.createListing.mutate({
      itemType: selectedSellItem.type,
      itemId: selectedSellItem.id,
      itemName: selectedSellItem.name,
      itemCategory: selectedSellItem.category,
      itemRarity: selectedSellItem.rarity,
      askingPrice: parseInt(sellPrice),
      isNegotiable: sellNegotiable,
    }, {
      onSuccess: () => {
        setSellDialogOpen(false);
        setSelectedSellItem(null);
        setSellPrice("");
      },
    });
  };

  const handleOffer = () => {
    if (!offerListing || !offerAmount) return;
    market.makeOffer.mutate({
      listingId: offerListing.id,
      amount: parseInt(offerAmount),
      message: offerMessage || undefined,
    }, {
      onSuccess: () => {
        setOfferDialogOpen(false);
        setOfferListing(null);
        setOfferAmount("");
        setOfferMessage("");
      },
    });
  };

  const ListingCard = ({ listing, showActions = true }: { listing: MarketListing; showActions?: boolean }) => {
    const config = ITEM_TYPE_CONFIG[listing.item_type as ItemType];
    const Icon = config?.icon || Package;
    const isMine = listing.seller_user_id === market.userId;

    return (
      <Card className="hover:border-primary/30 transition-colors">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className={cn("shrink-0", config?.color)}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">{listing.item_name}</p>
                <p className="text-xs text-muted-foreground">
                  by {listing.seller_name || "Unknown"}
                </p>
              </div>
            </div>
            <Badge variant="outline" className="shrink-0 text-[10px]">
              {config?.label || listing.item_type}
            </Badge>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {listing.item_rarity && (
              <Badge className={cn("text-[10px]", RARITY_COLORS[listing.item_rarity.toLowerCase()] || "")}>
                {listing.item_rarity}
              </Badge>
            )}
            {listing.item_category && (
              <Badge variant="secondary" className="text-[10px]">{listing.item_category}</Badge>
            )}
            {listing.is_negotiable && (
              <Badge variant="outline" className="text-[10px]">
                <MessageSquare className="h-2.5 w-2.5 mr-0.5" /> Negotiable
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-lg font-black tabular-nums text-green-500">
              ${listing.asking_price.toLocaleString()}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {format(new Date(listing.listed_at), "MMM d")}
            </p>
          </div>

          {showActions && !isMine && (
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1"
                onClick={() => {
                  if (confirm(`Buy "${listing.item_name}" for $${listing.asking_price.toLocaleString()}?`)) {
                    market.buyNow.mutate(listing);
                  }
                }}
                disabled={market.buyNow.isPending}
              >
                {market.buyNow.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <DollarSign className="h-3 w-3" />}
                Buy Now
              </Button>
              {listing.is_negotiable && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setOfferListing(listing);
                    setOfferAmount(Math.floor(listing.asking_price * 0.8).toString());
                    setOfferDialogOpen(true);
                  }}
                >
                  <MessageSquare className="h-3 w-3" />
                  Offer
                </Button>
              )}
            </div>
          )}

          {isMine && listing.status === "active" && (
            <Button
              size="sm"
              variant="destructive"
              className="w-full"
              onClick={() => market.cancelListing.mutate(listing.id)}
              disabled={market.cancelListing.isPending}
            >
              <X className="h-3 w-3 mr-1" /> Cancel Listing
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ShoppingBag className="h-8 w-8" />
            Item Marketplace
          </h1>
          <p className="text-muted-foreground">Trade gear, books, underworld items, and clothes with other players</p>
        </div>
        <Button onClick={() => setSellDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Sell Item
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <Package className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-2xl font-bold">{filteredListings.length}</p>
            <p className="text-[10px] text-muted-foreground">Active Listings</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <Tag className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-2xl font-bold">{(market.myListings.data || []).filter(l => l.status === 'active').length}</p>
            <p className="text-[10px] text-muted-foreground">My Listings</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <ArrowRightLeft className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-2xl font-bold">{(market.incomingOffers.data || []).length}</p>
            <p className="text-[10px] text-muted-foreground">Pending Offers</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <History className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-2xl font-bold">{(market.transactions.data || []).length}</p>
            <p className="text-[10px] text-muted-foreground">Transactions</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="browse" className="space-y-4">
        <div className="overflow-x-auto -mx-4 px-4 pb-2 scrollbar-hide">
          <TabsList className="inline-flex w-max gap-1">
            <TabsTrigger value="browse" className="whitespace-nowrap">Browse</TabsTrigger>
            <TabsTrigger value="my-listings" className="whitespace-nowrap">My Listings</TabsTrigger>
            <TabsTrigger value="offers" className="whitespace-nowrap">
              Offers
              {(market.incomingOffers.data || []).length > 0 && (
                <Badge variant="destructive" className="ml-1 text-[10px] px-1 py-0">
                  {(market.incomingOffers.data || []).length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history" className="whitespace-nowrap">History</TabsTrigger>
          </TabsList>
        </div>

        {/* Browse Tab */}
        <TabsContent value="browse" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex flex-wrap gap-3">
                <div className="flex-1 min-w-[180px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search items..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="gear">Gear</SelectItem>
                    <SelectItem value="book">Books</SelectItem>
                    <SelectItem value="underworld">Underworld</SelectItem>
                    <SelectItem value="clothing">Clothing</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest</SelectItem>
                    <SelectItem value="price-low">Price: Low</SelectItem>
                    <SelectItem value="price-high">Price: High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {market.listings.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredListings.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Listings Found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery || typeFilter !== "all"
                    ? "Try adjusting your filters."
                    : "Be the first to list an item!"}
                </p>
                <Button onClick={() => setSellDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" /> List an Item
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {filteredListings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* My Listings Tab */}
        <TabsContent value="my-listings" className="space-y-4">
          {(market.myListings.data || []).length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Tag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Listings Yet</h3>
                <p className="text-muted-foreground mb-4">
                  Sell your unwanted items to other players.
                </p>
                <Button onClick={() => setSellDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" /> Sell an Item
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {(market.myListings.data || []).map((listing) => (
                <ListingCard key={listing.id} listing={listing} showActions={listing.status === "active"} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Offers Tab */}
        <TabsContent value="offers" className="space-y-4">
          {(market.incomingOffers.data || []).length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <h3 className="font-semibold">No Pending Offers</h3>
                <p className="text-sm text-muted-foreground">Offers on your listings will appear here.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {(market.incomingOffers.data || []).map((offer) => (
                <Card key={offer.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-sm">{offer.buyer_name || "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">
                          Offered on {format(new Date(offer.created_at), "MMM d, h:mm a")}
                        </p>
                        {offer.message && (
                          <p className="text-xs mt-1 italic text-muted-foreground">"{offer.message}"</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black tabular-nums text-green-500">
                          ${offer.offer_amount.toLocaleString()}
                        </p>
                        <div className="flex gap-2 mt-2">
                          <Button
                            size="sm"
                            onClick={() => market.acceptOffer.mutate(offer)}
                            disabled={market.acceptOffer.isPending}
                          >
                            <CheckCircle className="h-3 w-3 mr-1" /> Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => market.rejectOffer.mutate(offer.id)}
                            disabled={market.rejectOffer.isPending}
                          >
                            <XCircle className="h-3 w-3 mr-1" /> Reject
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          {(market.transactions.data || []).length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <History className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <h3 className="font-semibold">No Transactions Yet</h3>
                <p className="text-sm text-muted-foreground">Your marketplace history will appear here.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {(market.transactions.data || []).map((tx) => {
                const isBuyer = tx.buyer_user_id === market.userId;
                return (
                  <Card key={tx.id}>
                    <CardContent className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold",
                          isBuyer ? "bg-blue-500/10 text-blue-500" : "bg-green-500/10 text-green-500"
                        )}>
                          {isBuyer ? "B" : "S"}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{tx.item_name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {isBuyer ? "Purchased" : "Sold"} • {format(new Date(tx.completed_at), "MMM d, yyyy")}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={cn("font-bold tabular-nums", isBuyer ? "text-destructive" : "text-green-500")}>
                          {isBuyer ? "-" : "+"}${(isBuyer ? tx.sale_price : tx.seller_proceeds).toLocaleString()}
                        </p>
                        {!isBuyer && tx.marketplace_fee > 0 && (
                          <p className="text-[10px] text-muted-foreground">
                            Fee: ${tx.marketplace_fee.toLocaleString()}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Sell Dialog */}
      <Dialog open={sellDialogOpen} onOpenChange={setSellDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>List Item for Sale</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4">
              <div>
                <Label>Select Item</Label>
                {market.sellableItems.isLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : (market.sellableItems.data || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">No sellable items found. Unequip gear first to sell it.</p>
                ) : (
                  <div className="space-y-2 mt-2 max-h-[200px] overflow-y-auto">
                    {(market.sellableItems.data || []).map((item) => {
                      const config = ITEM_TYPE_CONFIG[item.type];
                      const Icon = config?.icon || Package;
                      const isSelected = selectedSellItem?.id === item.id;
                      return (
                        <div
                          key={`${item.type}-${item.id}`}
                          className={cn(
                            "flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-colors",
                            isSelected ? "border-primary bg-primary/5" : "hover:border-primary/30"
                          )}
                          onClick={() => {
                            setSelectedSellItem(item);
                            if (!sellPrice) setSellPrice(item.suggestedPrice.toString());
                          }}
                        >
                          <Icon className={cn("h-4 w-4 shrink-0", config?.color)} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{item.name}</p>
                            <div className="flex items-center gap-1">
                              <Badge variant="outline" className="text-[10px]">{config?.label}</Badge>
                              {item.rarity && (
                                <Badge className={cn("text-[10px]", RARITY_COLORS[item.rarity.toLowerCase()] || "")}>
                                  {item.rarity}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">~${item.suggestedPrice.toLocaleString()}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {selectedSellItem && (
                <>
                  <Separator />
                  <div>
                    <Label>Asking Price ($)</Label>
                    <Input
                      type="number"
                      min="1"
                      value={sellPrice}
                      onChange={(e) => setSellPrice(e.target.value)}
                      placeholder="Enter price"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Suggested: ${selectedSellItem.suggestedPrice.toLocaleString()} • 5% marketplace fee applies
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="negotiable"
                      checked={sellNegotiable}
                      onCheckedChange={(c) => setSellNegotiable(!!c)}
                    />
                    <Label htmlFor="negotiable" className="text-sm">Allow offers (negotiable)</Label>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSellDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSell}
              disabled={!selectedSellItem || !sellPrice || parseInt(sellPrice) <= 0 || market.createListing.isPending}
            >
              {market.createListing.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Tag className="h-4 w-4 mr-2" />
              )}
              List for Sale
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Offer Dialog */}
      <Dialog open={offerDialogOpen} onOpenChange={setOfferDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Make an Offer</DialogTitle>
          </DialogHeader>
          {offerListing && (
            <div className="space-y-4">
              <div className="p-3 border rounded-lg bg-muted/30">
                <p className="font-semibold">{offerListing.item_name}</p>
                <p className="text-sm text-muted-foreground">
                  Listed by {offerListing.seller_name} for ${offerListing.asking_price.toLocaleString()}
                </p>
              </div>
              <div>
                <Label>Your Offer ($)</Label>
                <Input
                  type="number"
                  min="1"
                  value={offerAmount}
                  onChange={(e) => setOfferAmount(e.target.value)}
                />
              </div>
              <div>
                <Label>Message (optional)</Label>
                <Textarea
                  value={offerMessage}
                  onChange={(e) => setOfferMessage(e.target.value)}
                  placeholder="Add a message to the seller..."
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOfferDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleOffer}
              disabled={!offerAmount || parseInt(offerAmount) <= 0 || market.makeOffer.isPending}
            >
              {market.makeOffer.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <MessageSquare className="h-4 w-4 mr-2" />
              )}
              Send Offer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ItemMarketplace;
