import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, CheckCircle2, Clock, Package, Zap, Sparkles, Heart, Star } from "lucide-react";
import { useSkillBooksInventory } from "@/hooks/useSkillBooksInventory";
import { useUnderworldInventory, type InventoryItem } from "@/hooks/useUnderworldInventory";
import { ItemDetailDialog } from "@/components/inventory/ItemDetailDialog";

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
  const [user, setUser] = useState<any>(null);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });
  }, []);

  const { books, isLoading, completeBook, isCompleting } = useSkillBooksInventory(user?.id);
  const { inventoryItems, inventoryLoading, useItem } = useUnderworldInventory();

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
        <p className="text-muted-foreground">Manage your items, equipment, and learning resources.</p>
      </div>

      <Tabs defaultValue="underworld" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:inline-flex">
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
            {books.length > 0 && (
              <Badge variant="secondary" className="ml-1">{books.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

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

        <TabsContent value="books" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                Book Library
              </CardTitle>
              <CardDescription>
                Review the education books you've purchased and their completion status.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!user ? (
                <p className="text-sm text-muted-foreground">Sign in to view your book inventory.</p>
              ) : isLoading ? (
                <p className="text-sm text-muted-foreground">Loading your books...</p>
              ) : books.length === 0 ? (
                <div className="text-center py-8">
                  <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">No books in your inventory yet.</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Visit the education section to purchase skill books!
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {books.map((book) => {
                    const isCompleted = !!book.completed_at;
                    return (
                      <Card key={book.id} className="overflow-hidden">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <BookOpen className="h-5 w-5 text-primary" />
                              <CardTitle className="text-base">{book.book_title}</CardTitle>
                            </div>
                            {isCompleted && (
                              <CheckCircle2 className="h-5 w-5 text-green-500" />
                            )}
                          </div>
                          <Badge variant="secondary" className="w-fit">
                            {book.skill_focus}
                          </Badge>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Progress</span>
                              <span>{book.progress_percentage}%</span>
                            </div>
                            <Progress value={book.progress_percentage} />
                          </div>

                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">XP Reward</span>
                            <Badge variant="outline">{book.xp_reward} XP</Badge>
                          </div>

                          {isCompleted ? (
                            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                              <CheckCircle2 className="h-4 w-4" />
                              <span>Completed {new Date(book.completed_at).toLocaleDateString()}</span>
                            </div>
                          ) : (
                            <div>
                              <Button
                                size="sm"
                                className="w-full"
                                onClick={() => completeBook(book.id)}
                                disabled={isCompleting}
                              >
                                {isCompleting ? "Completing..." : "Complete & Claim XP"}
                              </Button>
                              <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                <span>Purchased {new Date(book.purchased_at).toLocaleDateString()}</span>
                              </div>
                            </div>
                          )}
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
