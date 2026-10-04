import { FormEvent, useMemo, useState } from "react";
import {
  BadgeDollarSign,
  Building2,
  Guitar,
  History,
  MapPin,
  PackageCheck,
  ShieldCheck,
  Star,
  Store,
  Tag,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { LuthieryShop, LuthieryShopListing, useLuthieryShops } from "@/hooks/useLuthieryShops";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount || 0);

const materialNames = (listing: LuthieryShopListing) => {
  const materials = listing.provenance_snapshot?.materialSnapshot;
  if (!Array.isArray(materials)) return [];
  return materials
    .map((entry: any) => entry?.materialName)
    .filter((name: unknown): name is string => typeof name === "string");
};

const reputationLabel = (value: number) => {
  if (value >= 90) return "Legendary";
  if (value >= 75) return "Excellent";
  if (value >= 60) return "Trusted";
  if (value >= 40) return "Established";
  return "Developing";
};

const ShopSettingsForm = ({
  shop,
  currentCityName,
  isBusy,
  onSave,
}: {
  shop: LuthieryShop;
  currentCityName?: string;
  isBusy: boolean;
  onSave: (input: {
    name: string;
    brandTagline?: string;
    brandColour: string;
    brandLogoUrl?: string;
    commissionRate: number;
    isOpen: boolean;
    moveToCurrentCity?: boolean;
  }) => Promise<unknown>;
}) => {
  const [name, setName] = useState(shop.name);
  const [tagline, setTagline] = useState(shop.brand_tagline ?? "");
  const [colour, setColour] = useState(shop.brand_colour);
  const [logoUrl, setLogoUrl] = useState(shop.brand_logo_url ?? "");
  const [commissionRate, setCommissionRate] = useState(String(shop.commission_rate));
  const [isOpen, setIsOpen] = useState(shop.is_open);
  const [moveToCurrentCity, setMoveToCurrentCity] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await onSave({
      name,
      brandTagline: tagline,
      brandColour: colour,
      brandLogoUrl: logoUrl,
      commissionRate: Math.max(0, Math.min(15, Number(commissionRate) || 0)),
      isOpen,
      moveToCurrentCity,
    });
    setMoveToCurrentCity(false);
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="luthiery-shop-name">Shop name</Label>
          <Input
            id="luthiery-shop-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            minLength={3}
            maxLength={50}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="luthiery-shop-tagline">Brand tagline</Label>
          <Input
            id="luthiery-shop-tagline"
            value={tagline}
            onChange={(event) => setTagline(event.target.value)}
            maxLength={120}
            placeholder="Hand-built for the stage"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="luthiery-shop-colour">Brand colour</Label>
          <div className="flex gap-2">
            <Input
              id="luthiery-shop-colour"
              type="color"
              value={colour}
              onChange={(event) => setColour(event.target.value)}
              className="w-16 p-1"
            />
            <Input value={colour} onChange={(event) => setColour(event.target.value)} maxLength={7} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="luthiery-shop-logo">Logo image URL (optional)</Label>
          <Input
            id="luthiery-shop-logo"
            value={logoUrl}
            onChange={(event) => setLogoUrl(event.target.value)}
            maxLength={500}
            placeholder="https://..."
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="luthiery-shop-commission">Original-maker resale commission (%)</Label>
          <Input
            id="luthiery-shop-commission"
            type="number"
            min={0}
            max={15}
            step={0.5}
            value={commissionRate}
            onChange={(event) => setCommissionRate(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Paid to the original Luthier when another player resells their instrument through this shop.
          </p>
        </div>
        <div className="space-y-3 rounded-lg border p-3">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="luthiery-shop-open">Open to customers</Label>
            <Switch id="luthiery-shop-open" checked={isOpen} onCheckedChange={setIsOpen} />
          </div>
          {currentCityName && currentCityName !== shop.city?.name && (
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label htmlFor="luthiery-shop-move">Move shop to {currentCityName}</Label>
                <p className="text-xs text-muted-foreground">Relocation takes effect immediately.</p>
              </div>
              <Switch id="luthiery-shop-move" checked={moveToCurrentCity} onCheckedChange={setMoveToCurrentCity} />
            </div>
          )}
        </div>
      </div>
      <Button type="submit" disabled={isBusy || name.trim().length < 3}>
        {isBusy ? "Saving..." : "Save shop settings"}
      </Button>
    </form>
  );
};

export const LuthieryShopPanel = () => {
  const {
    profile,
    levels,
    isQualified,
    listings,
    myShop,
    myListings,
    salesHistory,
    availableInstruments,
    isLoading,
    openShop,
    updateShop,
    createListing,
    cancelListing,
    purchaseListing,
    isOpeningShop,
    isUpdatingShop,
    isCreatingListing,
    isCancellingListing,
    isPurchasing,
  } = useLuthieryShops();

  const [openName, setOpenName] = useState("");
  const [openTagline, setOpenTagline] = useState("");
  const [openColour, setOpenColour] = useState("#b8892f");
  const [openLogo, setOpenLogo] = useState("");
  const [openCommission, setOpenCommission] = useState("5");
  const [instrumentId, setInstrumentId] = useState("");
  const [askingPrice, setAskingPrice] = useState("");
  const [listingDescription, setListingDescription] = useState("");

  const activeMyListings = useMemo(
    () => myListings.filter((listing) => listing.status === "active" || listing.status === "processing"),
    [myListings]
  );

  const handleOpenShop = async (event: FormEvent) => {
    event.preventDefault();
    await openShop({
      name: openName,
      brandTagline: openTagline,
      brandColour: openColour,
      brandLogoUrl: openLogo,
      commissionRate: Math.max(0, Math.min(15, Number(openCommission) || 0)),
    });
  };

  const handleCreateListing = async (event: FormEvent) => {
    event.preventDefault();
    if (!instrumentId || !askingPrice) return;
    await createListing({
      playerEquipmentId: instrumentId,
      askingPrice: Number(askingPrice),
      description: listingDescription,
    });
    setInstrumentId("");
    setAskingPrice("");
    setListingDescription("");
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Loading player instrument shops...
        </CardContent>
      </Card>
    );
  }

  return (
    <Tabs defaultValue="browse" className="space-y-4">
      <TabsList>
        <TabsTrigger value="browse">
          <Store className="mr-1.5 h-4 w-4" />
          Browse instruments
        </TabsTrigger>
        <TabsTrigger value="manage">
          <Building2 className="mr-1.5 h-4 w-4" />
          My instrument shop
        </TabsTrigger>
      </TabsList>

      <TabsContent value="browse" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
          <div>
            <h3 className="font-semibold">Player-built instruments</h3>
            <p className="text-sm text-muted-foreground">
              Every listing keeps the original maker and immutable build specification through resale.
            </p>
          </div>
          <Badge variant="secondary">
            <BadgeDollarSign className="mr-1 h-3.5 w-3.5" />
            Balance {formatCurrency(profile?.cash ?? 0)}
          </Badge>
        </div>

        {listings.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              <Guitar className="mx-auto mb-3 h-10 w-10 opacity-50" />
              No player-built instruments are listed right now.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {listings.map((listing) => {
              const ownListing = listing.seller_profile_id === profile?.id;
              const canAfford = (profile?.cash ?? 0) >= listing.asking_price;
              const materials = materialNames(listing);
              const shop = listing.shop;

              return (
                <Card key={listing.id} className="overflow-hidden">
                  <div className="h-1.5" style={{ backgroundColor: shop?.brand_colour ?? "#b8892f" }} />
                  <CardHeader className="space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-lg">{listing.instrument_name}</CardTitle>
                        <CardDescription>
                          Built by {listing.maker_name} · {listing.instrument_kind === "electric_bass" ? "Electric bass" : "Electric guitar"}
                        </CardDescription>
                      </div>
                      <Badge className="capitalize">{listing.rarity}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Store className="h-3.5 w-3.5" />
                        {shop?.name ?? "Player shop"}
                      </span>
                      {shop?.city && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {shop.city.name}, {shop.city.country}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Star className="h-3.5 w-3.5" />
                        {Number(shop?.reputation ?? 0).toFixed(1)} {reputationLabel(Number(shop?.reputation ?? 0))}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-md border p-2">
                        <div className="text-lg font-semibold">{listing.final_quality}</div>
                        <div className="text-xs text-muted-foreground">Quality</div>
                      </div>
                      <div className="rounded-md border p-2">
                        <div className="text-lg font-semibold">{listing.condition_at_listing}%</div>
                        <div className="text-xs text-muted-foreground">Condition</div>
                      </div>
                      <div className="rounded-md border p-2">
                        <div className="text-lg font-semibold">{listing.provenance_snapshot?.shapeName ?? "Custom"}</div>
                        <div className="text-xs text-muted-foreground">Shape</div>
                      </div>
                    </div>

                    <div className="rounded-md bg-muted/40 p-3 text-sm">
                      <div className="mb-1 flex items-center gap-1.5 font-medium">
                        <ShieldCheck className="h-4 w-4" />
                        Verified build provenance
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {materials.length > 0 ? materials.join(" · ") : "Build materials recorded on the crafted item."}
                      </p>
                    </div>

                    {listing.description && <p className="text-sm">{listing.description}</p>}

                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <div className="text-xl font-bold">{formatCurrency(listing.asking_price)}</div>
                        <div className="text-xs text-muted-foreground">
                          Suggested value {formatCurrency(listing.suggested_value)}
                        </div>
                      </div>
                      <Button
                        onClick={() => void purchaseListing(listing.id)}
                        disabled={isPurchasing || ownListing || !canAfford}
                      >
                        {ownListing ? "Your listing" : !canAfford ? "Insufficient funds" : `Buy for ${formatCurrency(listing.asking_price)}`}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </TabsContent>

      <TabsContent value="manage" className="space-y-4">
        {!myShop ? (
          <Card>
            <CardHeader>
              <CardTitle>Open an instrument shop</CardTitle>
              <CardDescription>
                Qualified Luthiers can establish a branded shop in their current city and sell verified player-crafted instruments.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!isQualified ? (
                <div className="rounded-lg border border-dashed p-5">
                  <p className="font-medium">Professional shop access is still locked.</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Reach Basic Luthiery level 20. Current levels: Basic {levels.basic}, Professional {levels.professional}, Mastery {levels.mastery}.
                  </p>
                </div>
              ) : !profile?.current_city_id ? (
                <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
                  Travel to a city before opening your shop.
                </div>
              ) : (
                <form className="space-y-4" onSubmit={handleOpenShop}>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="new-luthiery-shop-name">Shop name</Label>
                      <Input
                        id="new-luthiery-shop-name"
                        value={openName}
                        onChange={(event) => setOpenName(event.target.value)}
                        minLength={3}
                        maxLength={50}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-luthiery-shop-tagline">Brand tagline</Label>
                      <Input
                        id="new-luthiery-shop-tagline"
                        value={openTagline}
                        onChange={(event) => setOpenTagline(event.target.value)}
                        maxLength={120}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-luthiery-shop-colour">Brand colour</Label>
                      <Input
                        id="new-luthiery-shop-colour"
                        type="color"
                        value={openColour}
                        onChange={(event) => setOpenColour(event.target.value)}
                        className="w-20 p-1"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-luthiery-shop-logo">Logo image URL (optional)</Label>
                      <Input
                        id="new-luthiery-shop-logo"
                        value={openLogo}
                        onChange={(event) => setOpenLogo(event.target.value)}
                        maxLength={500}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-luthiery-shop-commission">Original-maker resale commission (%)</Label>
                      <Input
                        id="new-luthiery-shop-commission"
                        type="number"
                        min={0}
                        max={15}
                        step={0.5}
                        value={openCommission}
                        onChange={(event) => setOpenCommission(event.target.value)}
                      />
                    </div>
                    <div className="rounded-lg border p-3 text-sm">
                      <div className="flex items-center gap-2 font-medium">
                        <MapPin className="h-4 w-4" />
                        {profile.city?.name ?? "Current city"}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">Your shop opens where your active character is currently located.</p>
                    </div>
                  </div>
                  <Button type="submit" disabled={isOpeningShop || openName.trim().length < 3}>
                    {isOpeningShop ? "Opening..." : "Open instrument shop"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <div className="h-1.5" style={{ backgroundColor: myShop.brand_colour }} />
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>{myShop.name}</CardTitle>
                    <CardDescription>
                      {myShop.brand_tagline || "Player-owned Luthiery shop"} · {myShop.city?.name}, {myShop.city?.country}
                    </CardDescription>
                  </div>
                  <Badge variant={myShop.is_open ? "default" : "secondary"}>{myShop.is_open ? "Open" : "Closed"}</Badge>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border p-3">
                  <Star className="mb-2 h-4 w-4 text-muted-foreground" />
                  <div className="text-xl font-semibold">{Number(myShop.reputation).toFixed(1)}</div>
                  <div className="text-xs text-muted-foreground">Reputation · {reputationLabel(Number(myShop.reputation))}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <PackageCheck className="mb-2 h-4 w-4 text-muted-foreground" />
                  <div className="text-xl font-semibold">{activeMyListings.length}</div>
                  <div className="text-xs text-muted-foreground">Active stock</div>
                </div>
                <div className="rounded-lg border p-3">
                  <History className="mb-2 h-4 w-4 text-muted-foreground" />
                  <div className="text-xl font-semibold">{myShop.completed_sales}</div>
                  <div className="text-xs text-muted-foreground">Completed sales</div>
                </div>
                <div className="rounded-lg border p-3">
                  <BadgeDollarSign className="mb-2 h-4 w-4 text-muted-foreground" />
                  <div className="text-xl font-semibold">{formatCurrency(myShop.gross_sales)}</div>
                  <div className="text-xs text-muted-foreground">Gross sales</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Shop settings</CardTitle>
              </CardHeader>
              <CardContent>
                <ShopSettingsForm
                  key={`${myShop.id}:${myShop.updated_at ?? ""}`}
                  shop={myShop}
                  currentCityName={profile?.city?.name}
                  isBusy={isUpdatingShop}
                  onSave={updateShop}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">List a crafted instrument</CardTitle>
                <CardDescription>
                  Only verified custom Luthiery instruments in your active character's inventory can be listed.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {availableInstruments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    You have no unequipped, unlisted player-crafted instruments available.
                  </p>
                ) : (
                  <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreateListing}>
                    <div className="space-y-2">
                      <Label>Instrument</Label>
                      <Select value={instrumentId} onValueChange={setInstrumentId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose an instrument" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableInstruments.map((instrument) => (
                            <SelectItem key={instrument.id} value={instrument.id}>
                              {instrument.equipment.custom_name || instrument.equipment.name} · {instrument.condition ?? 100}% condition
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="luthiery-listing-price">Asking price</Label>
                      <Input
                        id="luthiery-listing-price"
                        type="number"
                        min={1}
                        max={1000000000}
                        step={1}
                        value={askingPrice}
                        onChange={(event) => setAskingPrice(event.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="luthiery-listing-description">Listing description</Label>
                      <Textarea
                        id="luthiery-listing-description"
                        value={listingDescription}
                        onChange={(event) => setListingDescription(event.target.value)}
                        maxLength={500}
                        placeholder="Tell buyers what makes this instrument special."
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Button type="submit" disabled={isCreatingListing || !instrumentId || !askingPrice}>
                        <Tag className="mr-1.5 h-4 w-4" />
                        {isCreatingListing ? "Listing..." : "List instrument"}
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Stock and listing history</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {myListings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No listing history yet.</p>
                ) : (
                  myListings.map((listing) => (
                    <div key={listing.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                      <div>
                        <div className="font-medium">{listing.instrument_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatCurrency(listing.asking_price)} · Quality {listing.final_quality} · Maker {listing.maker_name}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={listing.status === "active" ? "default" : "secondary"} className="capitalize">
                          {listing.status}
                        </Badge>
                        {listing.status === "active" && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isCancellingListing}
                            onClick={() => void cancelListing(listing.id)}
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sales history</CardTitle>
                <CardDescription>Quality, value and fulfilled listings feed your shop reputation.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {salesHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No completed sales yet.</p>
                ) : (
                  salesHistory.map((sale) => (
                    <div key={sale.id} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-5">
                      <div>
                        <div className="text-xs text-muted-foreground">Sale</div>
                        <div className="font-medium">{formatCurrency(sale.sale_price)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Seller received</div>
                        <div className="font-medium">{formatCurrency(sale.seller_received)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Maker commission</div>
                        <div className="font-medium">{formatCurrency(sale.maker_commission)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Quality / value</div>
                        <div className="font-medium">{sale.quality_score} / {sale.value_score}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Reputation after sale</div>
                        <div className="font-medium">{Number(sale.reputation_after).toFixed(1)}</div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </>
        )}
      </TabsContent>
    </Tabs>
  );
};
