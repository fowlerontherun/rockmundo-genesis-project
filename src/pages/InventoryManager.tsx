import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, CheckCircle2, Clock, Package, Zap, Sparkles, Heart, Star, KeyRound, Home } from "lucide-react";
import { useUnderworldInventory, type InventoryItem } from "@/hooks/useUnderworldInventory";
import { ItemDetailDialog } from "@/components/inventory/ItemDetailDialog";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth-context";

const categoryIcons: Record<string, React.ElementType> = {
  consumable: Zap,
  booster: Sparkles,
  skill_book: BookOpen,
  collectible: Package,
};

const rarityStyles: Record<string, string> = {
  common: "border-muted",
  uncommon: "border-green-500/50",
  rare: "border-blue-500/50",
  epic: "border-purple-500/50",
  legendary: "border-yellow-500/50",
};

const InventoryManager = () => {
  const { user } = useAuth();
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { inventoryItems, inventoryLoading, useItem } = useUnderworldInventory();

  // Fetch books from player_book_reading_sessions (the real book ownership table)
  const { data: bookSessions = [], isLoading: booksLoading } = useQuery({
    queryKey: ["inventory-book-sessions", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!profile) return [];

      const { data, error } = await supabase
        .from("player_book_reading_sessions")
        .select(`
          *,
          skill_books (id, title, author, skill_slug, price, base_reading_days, skill_percentage_gain, category)
        `)
        .eq("profile_id", profile.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.id,
  });

  // Fetch house keys from lifestyle_property_purchases
  const { data: properties = [], isLoading: propertiesLoading } = useQuery({
    queryKey: ["inventory-properties", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from("lifestyle_property_purchases")
        .select(`
          *,
          lifestyle_properties (name, city, district, property_type, bedrooms, bathrooms, area_sq_ft, description, energy_rating)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.id,
  });

  const handleItemClick = (item: InventoryItem) => {
    setSelectedItem(item);
    setDetailOpen(true);
  };

  const handleUseItem = () => {
    if (selectedItem) {
      useItem.mutate(selectedItem.id, {
        onSuccess: () => {
          setDetailOpen(false);
          setSelectedItem(null);
        },
      });
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Inventory Manager</h1>
        <p className="text-muted-foreground">Manage your items, books, equipment, and property keys.</p>
      </div>

      <Tabs defaultValue="underworld" className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-flex">
          <TabsTrigger value="underworld" className="gap-2">
            <Package className="h-4 w-4" />
            Underworld Items
            {inventoryItems.length > 0 && (
              <Badge variant="secondary" className="ml-1">{inventoryItems.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="books" className="gap-2">
            <BookOpen className="h-4 w-4" />
            Book Library
            {bookSessions.length > 0 && (
              <Badge variant="secondary" className="ml-1">{bookSessions.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="keys" className="gap-2">
            <KeyRound className="h-4 w-4" />
            House Keys
            {properties.length > 0 && (
              <Badge variant="secondary" className="ml-1">{properties.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Underworld Items Tab */}
        <TabsContent value="underworld" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Underworld Items
              </CardTitle>
              <CardDescription>
                Items purchased from the Underworld. Click on an item to view details and use it.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!user ? (
                <p className="text-sm text-muted-foreground">Sign in to view your inventory.</p>
              ) : inventoryLoading ? (
                <p className="text-sm text-muted-foreground">Loading your items...</p>
              ) : inventoryItems.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">No items in your inventory yet.</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Visit the Underworld to acquire consumables and boosters!
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {inventoryItems.map((item) => {
                    const product = item.product;
                    if (!product) return null;
                    
                    const CategoryIcon = categoryIcons[product.category] || Package;
                    const rarityClass = rarityStyles[product.rarity] || "border-muted";
                    const effects = product.effects || {};

                    return (
                      <Card
                        key={item.id}
                        className={`overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] border-2 ${rarityClass}`}
                        onClick={() => handleItemClick(item)}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <div className="rounded-lg bg-primary/10 p-1.5">
                                <CategoryIcon className="h-4 w-4 text-primary" />
                              </div>
                              <CardTitle className="text-base">{product.name}</CardTitle>
                            </div>
                            <Badge variant="outline" className="capitalize text-xs">
                              {product.rarity}
                            </Badge>
                          </div>
                          <Badge variant="secondary" className="w-fit capitalize">
                            {product.category.replace("_", " ")}
                          </Badge>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {product.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {product.description}
                            </p>
                          )}

                          <div className="flex flex-wrap gap-1.5">
                            {effects.health && (
                              <Badge 
                                variant="outline" 
                                className={`gap-1 text-xs ${Number(effects.health) < 0 ? 'text-destructive border-destructive/30' : ''}`}
                              >
                                <Heart className="h-3 w-3" /> {Number(effects.health) >= 0 ? '+' : ''}{String(effects.health)}
                              </Badge>
                            )}
                            {effects.energy && (
                              <Badge 
                                variant="outline" 
                                className={`gap-1 text-xs ${Number(effects.energy) < 0 ? 'text-destructive border-destructive/30' : ''}`}
                              >
                                <Zap className="h-3 w-3" /> {Number(effects.energy) >= 0 ? '+' : ''}{String(effects.energy)}
                              </Badge>
                            )}
                            {effects.xp && (
                              <Badge 
                                variant="outline" 
                                className={`gap-1 text-xs ${Number(effects.xp) < 0 ? 'text-destructive border-destructive/30' : ''}`}
                              >
                                <Star className="h-3 w-3" /> {Number(effects.xp) >= 0 ? '+' : ''}{String(effects.xp)} XP
                              </Badge>
                            )}
                            {effects.fame && (
                              <Badge 
                                variant="outline" 
                                className={`gap-1 text-xs ${Number(effects.fame) < 0 ? 'text-destructive border-destructive/30' : ''}`}
                              >
                                <Sparkles className="h-3 w-3" /> {Number(effects.fame) >= 0 ? '+' : ''}{String(effects.fame)}
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>{new Date(item.created_at).toLocaleDateString()}</span>
                            </div>
                            <Button size="sm" variant="secondary">
                              View & Use
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Book Library Tab - now using player_book_reading_sessions */}
        <TabsContent value="books" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                Book Library
              </CardTitle>
              <CardDescription>
                Skill books you own and their reading progress.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!user ? (
                <p className="text-sm text-muted-foreground">Sign in to view your book inventory.</p>
              ) : booksLoading ? (
                <p className="text-sm text-muted-foreground">Loading your books...</p>
              ) : bookSessions.length === 0 ? (
                <div className="text-center py-8">
                  <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">No books in your library yet.</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Visit the Education section to purchase and start reading skill books!
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {bookSessions.map((session: any) => {
                    const book = session.skill_books;
                    if (!book) return null;
                    const isCompleted = session.status === "completed";
                    const isReading = session.status === "reading";
                    const progress = book.base_reading_days
                      ? Math.min(100, Math.round((session.days_read / book.base_reading_days) * 100))
                      : 0;

                    return (
                      <Card key={session.id} className={`overflow-hidden border-2 ${isCompleted ? 'border-green-500/30' : isReading ? 'border-primary/30' : 'border-muted'}`}>
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <BookOpen className="h-5 w-5 text-primary" />
                              <CardTitle className="text-base">{book.title}</CardTitle>
                            </div>
                            {isCompleted && (
                              <CheckCircle2 className="h-5 w-5 text-green-500" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">by {book.author}</p>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            <Badge variant="secondary" className="w-fit capitalize">
                              {book.skill_slug?.replace(/_/g, " ")}
                            </Badge>
                            {isReading && (
                              <Badge variant="default" className="w-fit text-xs">Reading</Badge>
                            )}
                            {isCompleted && (
                              <Badge variant="outline" className="w-fit text-xs text-green-600 border-green-500/30">Complete</Badge>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Progress</span>
                              <span>Day {session.days_read} / {book.base_reading_days}</span>
                            </div>
                            <Progress value={progress} />
                          </div>

                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">XP Earned</span>
                            <Badge variant="outline">{session.total_skill_xp_earned} XP</Badge>
                          </div>

                          {isCompleted && session.actual_completion_date && (
                            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                              <CheckCircle2 className="h-4 w-4" />
                              <span>Completed {new Date(session.actual_completion_date).toLocaleDateString()}</span>
                            </div>
                          )}

                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>Started {new Date(session.started_at).toLocaleDateString()}</span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* House Keys Tab */}
        <TabsContent value="keys" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-primary" />
                House Keys
              </CardTitle>
              <CardDescription>
                Keys to properties you own. Each key represents a home you've purchased.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!user ? (
                <p className="text-sm text-muted-foreground">Sign in to view your property keys.</p>
              ) : propertiesLoading ? (
                <p className="text-sm text-muted-foreground">Loading your property keys...</p>
              ) : properties.length === 0 ? (
                <div className="text-center py-8">
                  <Home className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">No house keys yet.</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Visit the Real Estate section to browse and purchase properties!
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {properties.map((purchase: any) => {
                    const prop = purchase.lifestyle_properties;
                    if (!prop) return null;

                    return (
                      <Card key={purchase.id} className="overflow-hidden border-2 border-primary/20">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <div className="rounded-lg bg-primary/10 p-2">
                                <KeyRound className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <CardTitle className="text-base">{prop.name}</CardTitle>
                                <p className="text-xs text-muted-foreground">{prop.city}{prop.district ? ` · ${prop.district}` : ''}</p>
                              </div>
                            </div>
                            <Badge variant="outline" className="capitalize text-xs">
                              {prop.property_type?.replace(/_/g, " ")}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {prop.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">{prop.description}</p>
                          )}

                          <div className="grid grid-cols-2 gap-2 text-sm">
                            {prop.bedrooms != null && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Bedrooms</span>
                                <span className="font-medium">{prop.bedrooms}</span>
                              </div>
                            )}
                            {prop.bathrooms != null && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Bathrooms</span>
                                <span className="font-medium">{prop.bathrooms}</span>
                              </div>
                            )}
                            {prop.area_sq_ft != null && (
                              <div className="flex justify-between col-span-2">
                                <span className="text-muted-foreground">Area</span>
                                <span className="font-medium">{prop.area_sq_ft.toLocaleString()} sq ft</span>
                              </div>
                            )}
                          </div>

                          {prop.energy_rating && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Energy Rating</span>
                              <Badge variant="secondary">{prop.energy_rating}</Badge>
                            </div>
                          )}

                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Purchase Price</span>
                            <span className="font-bold">${purchase.purchase_price?.toLocaleString()}</span>
                          </div>

                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>Purchased {new Date(purchase.created_at).toLocaleDateString()}</span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ItemDetailDialog
        item={selectedItem}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onUse={handleUseItem}
        isUsing={useItem.isPending}
      />
    </div>
  );
};

export default InventoryManager;
