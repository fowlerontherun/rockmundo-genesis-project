import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, CheckCircle2, Clock, Package, Zap, Sparkles, Heart, Star, KeyRound, Home, Guitar, DollarSign, Store, Ticket } from "lucide-react";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { useUnderworldInventory, type InventoryItem } from "@/hooks/useUnderworldInventory";
import { ItemDetailDialog } from "@/components/inventory/ItemDetailDialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
// useAuth removed — profileId from useActiveProfile
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { toast } from "sonner";
import { useMyFestivalMemorabilia } from "@/features/festival-company/attendance/useFestivalAttendance";

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
  // profileId already available from useActiveProfile below
  const { profileId, userId } = useActiveProfile();
  const queryClient = useQueryClient();
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { inventoryItems, inventoryLoading, useItem } = useUnderworldInventory();
  const {
    data: festivalMemorabilia = [],
    isLoading: festivalMemorabiliaLoading,
  } = useMyFestivalMemorabilia(Boolean(profileId));

  // Personal instruments / gear (e.g. from blind boxes)
  const { data: personalGear = [], isLoading: gearLoading, isError: gearError, refetch: retryGear } = useQuery({
    queryKey: ["inventory-personal-gear", userId],
    enabled: !!userId,
    queryFn: async () => {
      const allGear: any[] = [];
      for (let offset = 0; ; offset += 500) {
      const { data, error } = await (supabase as any)
        .from("player_personal_gear")
        .select("id, gear_name, gear_type, quality_rating, condition_rating, purchase_cost, stat_boosts, notes, created_at")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(offset, offset + 499);
      if (error) throw error;
      allGear.push(...(data ?? []));
      if (!data || data.length < 500) break;
      }
      return allGear;
    },
  });

  const sellGear = useMutation({
    mutationFn: async (gearId: string) => {
      const { data, error } = await supabase.rpc("sell_personal_gear" as any, { p_gear_id: gearId });
      if (error) throw error;
      const result = data as any;
      if (!result?.success) throw new Error(result?.error ?? "Sale failed");
      return result;
    },
    onSuccess: (result) => {
      toast.success(`Sold for $${(result.refund ?? 0).toLocaleString()}`);
      queryClient.invalidateQueries({ queryKey: ["inventory-personal-gear"] });
      queryClient.invalidateQueries({ queryKey: ["blind-box-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["active-profile"] });
      queryClient.invalidateQueries({ queryKey: ["player-equipment"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  // Fetch books from player_book_reading_sessions (the real book ownership table)
  const { data: bookSessions = [], isLoading: booksLoading, isError: booksError, refetch: retryBooks } = useQuery({
    queryKey: ["inventory-book-sessions", profileId],
    queryFn: async () => {
      if (!profileId) return [];

      const ownedBooks: any[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase.from("player_book_purchases")
          .select(`
            *,
            skill_books (id, title, author, skill_slug, price, base_reading_days, skill_percentage_gain, category),
            player_book_reading_sessions!player_book_reading_sessions_purchase_id_fkey (
              id, status, days_read, total_skill_xp_earned, actual_completion_date, started_at
            )
          `)
          .eq("profile_id", profileId)
          .order("created_at", { ascending: false })
          .range(offset, offset + 499);
        if (error) throw error;
        for (const purchase of data ?? []) {
          const sessions = Array.isArray(purchase.player_book_reading_sessions)
            ? [...purchase.player_book_reading_sessions] : [];
          sessions.sort((a, b) => Date.parse(b.started_at ?? "") - Date.parse(a.started_at ?? ""));
          const session = sessions.find(s => s.status === "reading") ?? sessions[0];
          ownedBooks.push({
            ...session,
            id: purchase.id,
            book_id: purchase.book_id,
            skill_books: purchase.skill_books,
            status: session?.status ?? "owned",
            days_read: session?.days_read ?? 0,
            total_skill_xp_earned: session?.total_skill_xp_earned ?? 0,
            started_at: session?.started_at ?? purchase.created_at,
          });
        }
        if (!data || data.length < 500) break;
      }
      return ownedBooks;
    },
    enabled: !!profileId,
  });

  // Fetch house keys from player_properties
  const { data: properties = [], isLoading: propertiesLoading, isError: propertiesError, refetch: retryProperties } = useQuery({
    queryKey: ["inventory-properties", profileId],
    queryFn: async () => {
      if (!profileId) return [];

      const allProperties: any[] = [];
      for (let offset = 0; ; offset += 500) {
      const { data, error } = await (supabase as any)
        .from("player_properties")
        .select(`
          *,
          housing_types (name, country, tier, bedrooms, description, base_price, image_url)
        `)
        .eq("profile_id", profileId)
        .order("purchased_at", { ascending: false })
        .order("id", { ascending: false })
        .range(offset, offset + 499);

      if (error) throw error;
      allProperties.push(...(data ?? []));
      if (!data || data.length < 500) break;
      }
      return allProperties;
    },
    enabled: !!profileId,
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
    <FMPageScaffold
      title="Inventory Manager"
      subtitle="Manage your items, memorabilia, books, equipment, and property keys."
      icon={Store}
      backTo="/hub/career-business"
      backLabel="Back to Career & Business"
    >


      <Tabs defaultValue="instruments" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:w-auto lg:inline-flex">
          <TabsTrigger value="instruments" className="gap-2">
            <Guitar className="h-4 w-4" />
            Instruments
            {personalGear.length > 0 && (
              <Badge variant="secondary" className="ml-1">{personalGear.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="festival" className="gap-2">
            <Ticket className="h-4 w-4" />
            Festival Keepsakes
            {festivalMemorabilia.length > 0 && (
              <Badge variant="secondary" className="ml-1">{festivalMemorabilia.length}</Badge>
            )}
          </TabsTrigger>
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

        {/* Instruments Tab */}
        <TabsContent value="instruments" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Guitar className="h-5 w-5 text-primary" /> My Instruments
              </CardTitle>
              <CardDescription>
                Personal instruments and gear — including items pulled from blind boxes. Sell back for 50% of value.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!userId ? (
                <p className="text-sm text-muted-foreground">Sign in to view your instruments.</p>
              ) : gearLoading ? (
                <p className="text-sm text-muted-foreground">Loading instruments...</p>
              ) : gearError ? <div role="alert" className="text-sm text-destructive">Unable to load instruments. <Button size="sm" variant="outline" onClick={() => void retryGear()}>Retry instruments</Button></div> : personalGear.length === 0 ? (
                <div className="text-center py-8">
                  <Guitar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">No instruments yet.</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Buy gear from the equipment store or open a blind box to add instruments here.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {personalGear.map((g: any) => {
                    return (
                      <Card key={g.id} className="border-2">
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <CardTitle className="text-base leading-tight">{g.gear_name}</CardTitle>
                            <Badge variant="outline" className="capitalize text-xs">{g.gear_type}</Badge>
                          </div>
                          {g.notes && (
                            <p className="text-xs text-muted-foreground line-clamp-2">{g.notes}</p>
                          )}
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Quality</span>
                            <span className="font-medium">{g.quality_rating ?? 0}/100</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Condition</span>
                            <span className="font-medium">{g.condition_rating ?? 0}/100</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Original Cost</span>
                            <span className="font-medium">${(g.purchase_cost ?? 0).toLocaleString()}</span>
                          </div>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="w-full gap-1"
                            disabled={sellGear.isPending}
                            onClick={() => {
                              if (confirm(`Sell ${g.gear_name}? The final refund is calculated by the server and shown after the sale.`)) {
                                sellGear.mutate(g.id);
                              }
                            }}
                          >
                            <DollarSign className="h-3 w-3" />
                            Sell item
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Festival Keepsakes Tab */}
        <TabsContent value="festival" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ticket className="h-5 w-5 text-primary" />
                Festival Keepsakes
              </CardTitle>
              <CardDescription>
                Festival keepsakes linked to your character's festival history. Wristbands are issued automatically with valid admission.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!profileId ? (
                <p className="text-sm text-muted-foreground">Sign in to view your festival keepsakes.</p>
              ) : festivalMemorabiliaLoading ? (
                <p className="text-sm text-muted-foreground">Loading festival keepsakes...</p>
              ) : festivalMemorabilia.length === 0 ? (
                <div className="text-center py-8">
                  <Ticket className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">No festival keepsakes yet.</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Buy a valid festival admission ticket to receive your first wristband automatically.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {festivalMemorabilia.map((item) => (
                    <Card key={item.id} className={`overflow-hidden border-2 ${rarityStyles[item.rarity] || "border-muted"}`}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="rounded-lg bg-primary/10 p-2">
                              <Ticket className="h-5 w-5 text-primary" />
                            </div>
                            <CardTitle className="text-base">{item.displayName}</CardTitle>
                          </div>
                          <Badge variant="outline" className="capitalize text-xs">
                            {item.rarity}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {item.description && (
                          <p className="text-sm text-muted-foreground">{item.description}</p>
                        )}
                        <Badge variant="secondary" className="capitalize">
                          {item.itemType.replaceAll("_", " ")}
                        </Badge>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>Issued {new Date(item.issuedAt).toLocaleDateString("en-GB")}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

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
              {!profileId ? (
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
                    if (!product) return <Card key={item.id} role="status"><CardHeader><CardTitle>Unresolved inventory item</CardTitle></CardHeader><CardContent>Item {item.id} is owned, but its product details are unavailable. Please contact support if this persists.</CardContent></Card>;
                    
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
                            {effects.health !== null && effects.health !== undefined && (
                              <Badge 
                                variant="outline" 
                                className={`gap-1 text-xs ${Number(effects.health) < 0 ? 'text-destructive border-destructive/30' : ''}`}
                              >
                                <Heart className="h-3 w-3" /> {Number(effects.health) >= 0 ? '+' : ''}{String(effects.health)}
                              </Badge>
                            )}
                            {effects.energy !== null && effects.energy !== undefined && (
                              <Badge 
                                variant="outline" 
                                className={`gap-1 text-xs ${Number(effects.energy) < 0 ? 'text-destructive border-destructive/30' : ''}`}
                              >
                                <Zap className="h-3 w-3" /> {Number(effects.energy) >= 0 ? '+' : ''}{String(effects.energy)}
                              </Badge>
                            )}
                            {effects.xp !== null && effects.xp !== undefined && (
                              <Badge 
                                variant="outline" 
                                className={`gap-1 text-xs ${Number(effects.xp) < 0 ? 'text-destructive border-destructive/30' : ''}`}
                              >
                                <Star className="h-3 w-3" /> {Number(effects.xp) >= 0 ? '+' : ''}{String(effects.xp)} XP
                              </Badge>
                            )}
                            {effects.fame !== null && effects.fame !== undefined && (
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

        {/* Book Library Tab - ownership comes from purchases, with optional reading progress */}
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
              {!profileId ? (
                <p className="text-sm text-muted-foreground">Sign in to view your book inventory.</p>
              ) : booksLoading ? (
                <p className="text-sm text-muted-foreground">Loading your books...</p>
              ) : booksError ? <div role="alert" className="text-sm text-destructive">Unable to load your book inventory. <Button size="sm" variant="outline" onClick={() => void retryBooks()}>Retry books</Button></div> : bookSessions.length === 0 ? (
                <div className="text-center py-8">
                  <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">No books in your library yet.</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Visit the Education section to purchase and start reading skill books!
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {bookSessions.filter((session: any, index: number, all: any[]) => all.findIndex((item: any) => (item.skill_books?.id ?? item.book_id ?? item.id) === (session.skill_books?.id ?? session.book_id ?? session.id)) === index).map((session: any) => {
                    const book = session.skill_books;
                    if (!book) return <Card key={session.id} role="status"><CardHeader><CardTitle>Reading record unavailable</CardTitle></CardHeader><CardContent>Reading session {session.id} ({session.status}) exists, but the linked book details could not be loaded.</CardContent></Card>;
                    const isCompleted = session.status === "completed";
                    const isReading = session.status === "reading";
                    const progress = book.base_reading_days
                      ? Math.min(100, Math.max(0, Math.round((session.days_read / book.base_reading_days) * 100)))
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
                              <span>Day {Math.min(Math.max(0, Number(session.days_read) || 0), Math.max(0, Number(book.base_reading_days) || 0))} / {book.base_reading_days}</span>
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
                            <span>{session.status === "owned" ? "Purchased" : "Started"} {session.started_at ? new Date(session.started_at).toLocaleDateString() : "date unavailable"}</span>
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
              {!profileId ? (
                <p className="text-sm text-muted-foreground">Sign in to view your property keys.</p>
              ) : propertiesLoading ? (
                <p className="text-sm text-muted-foreground">Loading your property keys...</p>
              ) : propertiesError ? (<div role="alert">Unable to load property keys. <Button variant="outline" size="sm" onClick={() => void retryProperties()}>Retry keys</Button></div>) : properties.length === 0 ? (
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
                    const prop = purchase.housing_types ?? { name: "Owned property (details unavailable)", image_url: null, tier: null, bedrooms: null, description: "The property is owned, but its housing type could not be loaded.", base_price: null };

                    return (
                      <Card key={purchase.id} className="overflow-hidden border-2 border-primary/20">
                        {prop.image_url && (
                          <div className="h-32 overflow-hidden">
                            <img src={prop.image_url} alt={prop.name} className="w-full h-full object-cover" />
                          </div>
                        )}
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <div className="rounded-lg bg-primary/10 p-2">
                                <KeyRound className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <CardTitle className="text-base">{prop.name}</CardTitle>
                                <p className="text-xs text-muted-foreground">{purchase.country}</p>
                              </div>
                            </div>
                            {prop.tier && (
                              <Badge variant="outline" className="text-xs">
                                Tier {prop.tier}
                              </Badge>
                            )}
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
                          </div>

                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Purchase Price</span>
                            <span className="font-bold">${purchase.purchase_price?.toLocaleString()}</span>
                          </div>

                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>Purchased {new Date(purchase.purchased_at).toLocaleDateString()}</span>
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
    </FMPageScaffold>
  );
};

export default InventoryManager;
