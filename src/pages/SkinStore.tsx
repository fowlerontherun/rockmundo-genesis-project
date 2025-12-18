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
} from "lucide-react";
import { CollectionCard } from "@/components/skin-store/CollectionCard";
import { StoreItemCard } from "@/components/skin-store/StoreItemCard";
import { FeaturedCarousel } from "@/components/skin-store/FeaturedCarousel";
import { ItemPreviewDialog } from "@/components/skin-store/ItemPreviewDialog";
import {
  useSkinCollections,
  useClothingItems,
  useFeaturedItems,
  useNewArrivals,
  useOwnedSkins,
  usePurchaseSkin,
  ClothingItem,
} from "@/hooks/useSkinStore";
import { useVipStatus } from "@/hooks/useVipStatus";
import { useTranslation } from "@/hooks/useTranslation";

const SkinStore = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("featured");
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<ClothingItem | null>(null);
  const { data: collections = [], isLoading: collectionsLoading } = useSkinCollections();
  const { data: featuredItems = [] } = useFeaturedItems();
  const { data: newArrivals = [] } = useNewArrivals();
  const { data: collectionItems = [] } = useClothingItems(selectedCollection || undefined);
  const { data: allItems = [] } = useClothingItems();
  const { data: ownedSkins = [] } = useOwnedSkins();
  const { data: vipStatus } = useVipStatus();
  const purchaseMutation = usePurchaseSkin();

  const ownedItemIds = ownedSkins.map((s) => s.item_id);

  const handlePurchase = (item: ClothingItem) => {
    purchaseMutation.mutate({
      itemId: item.id,
      itemType: item.category,
      price: item.price || 0,
    });
    setPreviewItem(null);
  };

  const handlePreview = (item: ClothingItem) => {
    setPreviewItem(item);
  };

  const handleViewCollection = (collectionId: string) => {
    setSelectedCollection(collectionId);
    setActiveTab("collection");
  };

  const handleBackToCollections = () => {
    setSelectedCollection(null);
    setActiveTab("collections");
  };

  // Get collection item counts
  const collectionItemCounts = collections.reduce((acc, col) => {
    acc[col.id] = allItems.filter((item) => item.collection_id === col.id).length;
    return acc;
  }, {} as Record<string, number>);

  // Filter items by category
  const getItemsByCategory = (category: string) =>
    allItems.filter((item) => item.category === category);

  const selectedCollectionData = collections.find((c) => c.id === selectedCollection);

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShoppingBag className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Skin Store</h1>
            <p className="text-sm text-muted-foreground">
              Customize your avatar with exclusive skins and outfits
            </p>
          </div>
        </div>
        
        {vipStatus?.isVip && (
          <Badge className="bg-warning/20 text-warning border-warning/30">
            <Crown className="h-3.5 w-3.5 mr-1" />
            VIP Member
          </Badge>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
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
            <span>Collections</span>
          </TabsTrigger>
          <TabsTrigger value="browse" className="gap-1.5">
            <Shirt className="h-4 w-4 hidden sm:inline" />
            <span>Browse</span>
          </TabsTrigger>
          <TabsTrigger value="owned" className="gap-1.5">
            <Clock className="h-4 w-4 hidden sm:inline" />
            <span>Owned</span>
          </TabsTrigger>
        </TabsList>

        {/* Featured Tab */}
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

              {/* Limited Time Offers */}
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
                <p className="text-muted-foreground">
                  No featured items right now. Check back soon!
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* New Arrivals Tab */}
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
            <Card>
              <CardContent className="p-12 text-center">
                <p className="text-muted-foreground">No new arrivals yet.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Collections Tab */}
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
            <Card>
              <CardContent className="p-12 text-center">
                <p className="text-muted-foreground">No collections available.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Collection Detail Tab */}
        <TabsContent value="collection" className="space-y-6">
          {selectedCollectionData && (
            <>
              <Button
                variant="ghost"
                onClick={handleBackToCollections}
                className="mb-4"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Collections
              </Button>

              <Card className="bg-gradient-primary border-none mb-6">
                <CardContent className="p-6">
                  <h2 className="text-xl font-bold text-primary-foreground">
                    {selectedCollectionData.name}
                  </h2>
                  {selectedCollectionData.description && (
                    <p className="text-primary-foreground/80 mt-2">
                      {selectedCollectionData.description}
                    </p>
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
                <Card>
                  <CardContent className="p-12 text-center">
                    <p className="text-muted-foreground">
                      No items in this collection yet.
                    </p>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* Browse Tab */}
        <TabsContent value="browse" className="space-y-6">
          <ScrollArea className="h-[calc(100vh-280px)]">
            {["shirt", "pants", "jacket", "shoes", "accessory", "hat"].map((category) => {
              const categoryItems = getItemsByCategory(category);
              if (categoryItems.length === 0) return null;

              return (
                <div key={category} className="mb-8">
                  <h3 className="text-lg font-semibold capitalize mb-4">
                    {category}s
                  </h3>
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

        {/* Owned Tab */}
        <TabsContent value="owned" className="space-y-6">
          {ownedSkins.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {allItems
                .filter((item) => ownedItemIds.includes(item.id))
                .map((item) => (
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
              <CardContent className="p-12 text-center">
                <ShoppingBag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  You don't own any skins yet. Start shopping!
                </p>
                <Button
                  variant="default"
                  className="mt-4"
                  onClick={() => setActiveTab("featured")}
                >
                  Browse Store
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Item Preview Dialog */}
      <ItemPreviewDialog
        item={previewItem}
        isOwned={previewItem ? ownedItemIds.includes(previewItem.id) : false}
        onClose={() => setPreviewItem(null)}
        onPurchase={handlePurchase}
      />
    </div>
  );
};

export default SkinStore;
