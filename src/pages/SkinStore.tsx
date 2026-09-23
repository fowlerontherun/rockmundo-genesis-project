import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sparkles,
  ShoppingBag,
  Clock,
  Star,
  Crown,
  ArrowLeft,
  Shirt,
  Guitar,
} from "lucide-react";
import { CollectionCard } from "@/components/skin-store/CollectionCard";
import { StoreItemCard } from "@/components/skin-store/StoreItemCard";
import { FeaturedCarousel } from "@/components/skin-store/FeaturedCarousel";
import { ItemPreviewDialog, type ClothingPurchaseCustomization } from "@/components/skin-store/ItemPreviewDialog";
import { InstrumentSkinCard } from "@/components/skin-store/InstrumentSkinCard";
import { InstrumentSkinPreviewDialog, type InstrumentSkinPurchaseCustomization } from "@/components/skin-store/InstrumentSkinPreviewDialog";
import type { InstrumentSkinItem } from "@/features/instrument-skins/instrumentSkin";
import {
  useSkinCollections,
  useClothingItems,
  useStoreClothingItems,
  useFeaturedItems,
  useNewArrivals,
  useOwnedSkins,
  usePurchaseSkin,
  useInstrumentSkinItems,
  usePurchaseInstrumentSkin,
  ClothingItem,
} from "@/hooks/useSkinStore";
import { useVipStatus } from "@/hooks/useVipStatus";
import { useTranslation } from "@/hooks/useTranslation";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";

const SkinStore = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("featured");
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<ClothingItem | null>(null);
  const [previewInstrument, setPreviewInstrument] = useState<InstrumentSkinItem | null>(null);
  const { data: collections = [], isLoading: collectionsLoading } = useSkinCollections();
  const { data: featuredItems = [] } = useFeaturedItems();
  const { data: newArrivals = [] } = useNewArrivals();
  const { data: collectionItems = [] } = useStoreClothingItems(selectedCollection || undefined);
  const { data: allItems = [] } = useStoreClothingItems();
  const { data: ownedCatalogItems = [] } = useClothingItems();
  const { data: ownedSkins = [] } = useOwnedSkins();
  const { data: instrumentItems = [] } = useInstrumentSkinItems();
  const { data: vipStatus } = useVipStatus();
  const purchaseMutation = usePurchaseSkin();
  const instrumentPurchaseMutation = usePurchaseInstrumentSkin();

  const ownedItemIds = ownedSkins.filter((skin) => skin.item_type === 'clothing').map((skin) => skin.item_id);
  const ownedInstrumentIds = ownedSkins.filter((skin) => skin.item_type === 'instrument').map((skin) => skin.item_id);
  const ownedClothingItems = ownedCatalogItems.filter((item) => ownedItemIds.includes(item.id));
  const ownedInstrumentItems = instrumentItems.filter((item) => ownedInstrumentIds.includes(item.id));
  const previewOwnedSkin = previewItem
    ? ownedSkins.find((skin) => skin.item_type === 'clothing' && skin.item_id === previewItem.id) || null
    : null;
  const previewOwnedInstrument = previewInstrument
    ? ownedSkins.find((skin) => skin.item_type === 'instrument' && skin.item_id === previewInstrument.id) || null
    : null;

  const handlePurchase = (item: ClothingItem, customization?: ClothingPurchaseCustomization) => {
    purchaseMutation.mutate({
      itemId: item.id,
      variantKey: customization?.variantKey || null,
      zoneColours: customization?.zoneColours || {},
    }, {
      onSuccess: () => {
        setPreviewItem((current) => current?.id === item.id ? null : current);
      },
    });
  };

  const handlePreview = (item: ClothingItem) => {
    setPreviewItem(item);
  };

  const handleInstrumentPurchase = (item: InstrumentSkinItem, customization: InstrumentSkinPurchaseCustomization) => {
    instrumentPurchaseMutation.mutate({
      itemId: item.id,
      variantKey: customization.variantKey,
      zoneColours: customization.zoneColours,
    }, {
      onSuccess: () => setPreviewInstrument((current) => current?.id === item.id ? null : current),
    });
  };

  const handleViewCollection = (collectionId: string) => {
    setSelectedCollection(collectionId);
    setActiveTab("collection");
  };

  const handleBackToCollections = () => {
    setSelectedCollection(null);
    setActiveTab("collections");
  };

  const collectionItemCounts = collections.reduce((acc, col) => {
    acc[col.id] = allItems.filter((item) => item.collection_id === col.id).length;
    return acc;
  }, {} as Record<string, number>);

  const browseGroups = [
    { key: "tops", label: "Tops & Jackets", slots: ["top", "outerwear"] },
    { key: "bottoms", label: "Bottoms", slots: ["bottom"] },
    { key: "footwear", label: "Footwear", slots: ["footwear"] },
    { key: "accessories", label: "Accessories", slots: ["accessory", "headwear", "eyewear"] },
  ] as const;
  const getItemsBySlots = (slots: readonly string[]) =>
    allItems.filter((item) => slots.includes(String(item.wearable_slot || "")));

  const selectedCollectionData = collections.find((c) => c.id === selectedCollection);

  return (
    <FMPageScaffold
      title="Skin Store"
      subtitle="Customize your avatar and stage instruments with exclusive skins, colours and designs"
      icon={ShoppingBag}
      backTo="/hub/premium-store"
      headerActions={
        vipStatus?.isVip ? (
          <Badge className="bg-warning/20 text-warning border-warning/30">
            <Crown className="h-3.5 w-3.5 mr-1" />
            VIP Member
          </Badge>
        ) : undefined
      }
    >
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 lg:w-auto lg:inline-grid">
          <TabsTrigger value="featured" className="gap-1.5">
            <Star className="h-4 w-4 hidden sm:inline" />
            <span>Featured</span>
          </TabsTrigger>
          <TabsTrigger value="new" className="gap-1.5">
            <Sparkles className="h-4 w-4 hidden sm:inline" />
            <span>New</span>
          </TabsTrigger>
          <TabsTrigger value="collections" className="gap-1.5">
            <ShoppingBag className="h-4 w-4 hidden sm:inline" />
            <span>Skin Packs</span>
          </TabsTrigger>
          <TabsTrigger value="browse" className="gap-1.5">
            <Shirt className="h-4 w-4 hidden sm:inline" />
            <span>Browse</span>
          </TabsTrigger>
          <TabsTrigger value="instruments" className="gap-1.5">
            <Guitar className="h-4 w-4 hidden sm:inline" />
            <span>Instruments</span>
          </TabsTrigger>
          <TabsTrigger value="owned" className="gap-1.5">
            <Clock className="h-4 w-4 hidden sm:inline" />
            <span>Owned</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="featured" className="space-y-6">
          {featuredItems.length > 0 ? (
            <>
              <Card className="bg-gradient-primary border-none">
                <CardContent className="p-6">
                  <h2 className="text-xl font-bold text-primary-foreground mb-4">
                    ✨ Featured This Week
                  </h2>
                  <FeaturedCarousel
                    items={featuredItems}
                    ownedItemIds={ownedItemIds}
                    onPurchase={handlePurchase}
                    onPreview={handlePreview}
                  />
                </CardContent>
              </Card>

              {collections.filter((c) => c.ends_at).length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Clock className="h-5 w-5 text-warning" />
                    Limited Time Offers
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {collections
                      .filter((c) => c.ends_at)
                      .slice(0, 3)
                      .map((collection) => (
                        <CollectionCard
                          key={collection.id}
                          collection={collection}
                          itemCount={collectionItemCounts[collection.id]}
                          onViewCollection={handleViewCollection}
                        />
                      ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No featured items right now. Check back soon!</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="new" className="space-y-6">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            New Arrivals (Last 30 Days)
          </h2>
          {newArrivals.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {newArrivals.map((item) => (
                <StoreItemCard
                  key={item.id}
                  item={item}
                  isOwned={ownedItemIds.includes(item.id)}
                  onPurchase={handlePurchase}
                  onPreview={handlePreview}
                />
              ))}
            </div>
          ) : (
            <Card><CardContent className="p-12 text-center"><p className="text-muted-foreground">No new arrivals yet.</p></CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="collections" className="space-y-6">
          {collectionsLoading ? (
            <div className="text-center py-12">Loading collections...</div>
          ) : collections.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {collections.map((collection) => (
                <CollectionCard
                  key={collection.id}
                  collection={collection}
                  itemCount={collectionItemCounts[collection.id]}
                  onViewCollection={handleViewCollection}
                />
              ))}
            </div>
          ) : (
            <Card><CardContent className="p-12 text-center"><p className="text-muted-foreground">No collections available.</p></CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="collection" className="space-y-6">
          {selectedCollectionData && (
            <>
              <Button variant="ghost" onClick={handleBackToCollections} className="mb-4">
                <ArrowLeft className="h-4 w-4 mr-2" />Back to Collections
              </Button>

              <Card className="bg-gradient-primary border-none mb-6">
                <CardContent className="p-6">
                  <h2 className="text-xl font-bold text-primary-foreground">{selectedCollectionData.name}</h2>
                  {selectedCollectionData.description && (
                    <p className="text-primary-foreground/80 mt-2">{selectedCollectionData.description}</p>
                  )}
                </CardContent>
              </Card>

              {collectionItems.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                  {collectionItems.map((item) => (
                    <StoreItemCard
                      key={item.id}
                      item={item}
                      isOwned={ownedItemIds.includes(item.id)}
                      onPurchase={handlePurchase}
                      onPreview={handlePreview}
                    />
                  ))}
                </div>
              ) : (
                <Card><CardContent className="p-12 text-center"><p className="text-muted-foreground">No items in this collection yet.</p></CardContent></Card>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="browse" className="space-y-6">
          <ScrollArea className="h-[calc(100vh-280px)]">
            {browseGroups.map((group) => {
              const categoryItems = getItemsBySlots(group.slots);
              if (categoryItems.length === 0) return null;

              return (
                <div key={group.key} className="mb-8">
                  <h3 className="text-lg font-semibold mb-4">{group.label}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                    {categoryItems.map((item) => (
                      <StoreItemCard
                        key={item.id}
                        item={item}
                        isOwned={ownedItemIds.includes(item.id)}
                        onPurchase={handlePurchase}
                        onPreview={handlePreview}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="instruments" className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2"><Guitar className="h-5 w-5 text-primary" />Instrument Skin Designer</h2>
            <p className="mt-1 text-sm text-muted-foreground">Choose a guitar or bass design, change unlocked finish zones, then save it as the instrument you take on stage.</p>
          </div>
          {instrumentItems.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {instrumentItems.map((item) => (
                <InstrumentSkinCard key={item.id} item={item} isOwned={ownedInstrumentIds.includes(item.id)} onPreview={setPreviewInstrument} />
              ))}
            </div>
          ) : (
            <Card><CardContent className="p-12 text-center"><Guitar className="h-12 w-12 text-muted-foreground mx-auto mb-4" /><p className="text-muted-foreground">No instrument skins are available yet.</p></CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="owned" className="space-y-6">
          {ownedClothingItems.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {ownedClothingItems.map((item) => (
                <StoreItemCard
                  key={item.id}
                  item={item}
                  isOwned={true}
                  onPurchase={handlePurchase}
                  onPreview={handlePreview}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <ShoppingBag className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">You don't own any clothing yet.</p>
              </CardContent>
            </Card>
          )}
          {ownedInstrumentItems.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold flex items-center gap-2"><Guitar className="h-5 w-5" />Your instrument skins</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {ownedInstrumentItems.map((item) => <InstrumentSkinCard key={item.id} item={item} isOwned onPreview={setPreviewInstrument} />)}
              </div>
            </div>
          )}
          {ownedClothingItems.length === 0 && ownedInstrumentItems.length === 0 && <Button variant="default" onClick={() => setActiveTab("featured")}>Browse Store</Button>}
        </TabsContent>
      </Tabs>

      <InstrumentSkinPreviewDialog
        item={previewInstrument}
        ownedSkin={previewOwnedInstrument}
        onClose={() => setPreviewInstrument(null)}
        onPurchase={handleInstrumentPurchase}
      />

      <ItemPreviewDialog
        item={previewItem}
        isOwned={!!previewOwnedSkin}
        ownedSkin={previewOwnedSkin}
        onClose={() => setPreviewItem(null)}
        onPurchase={handlePurchase}
      />
    </FMPageScaffold>
  );
};

export default SkinStore;
