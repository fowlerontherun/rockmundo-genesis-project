import { useMemo, useState } from "react";
import { Loader2, Search, X, Filter } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSkillBooks } from "@/hooks/useSkillBooks";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useBookReading } from "@/hooks/useBookReading";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/lib/supabase-types";

type SkillBook = Tables<"skill_books">;
type EnrichedSkillBook = SkillBook & { skill_display_name?: string };

export const BooksTab = () => {
  const { profileId, userId } = useActiveProfile();
  const { toast } = useToast();
  const { books, purchases, activeSession, isLoading, purchaseBook, startReading } = useSkillBooks();
  const { processAttendance, isProcessing } = useBookReading();
  const typedBooks = books as EnrichedSkillBook[] | undefined;
  const [selectedBook, setSelectedBook] = useState<EnrichedSkillBook | null>(null);
  const [autoRead, setAutoRead] = useState(false);

  const isPurchased = (bookId: string) => 
    purchases?.some((p) => p.book_id === bookId);

  const isCompleted = (bookId: string) => {
    const purchase = purchases?.find((p) => p.book_id === bookId);
    if (!purchase) return false;
    
    const sessions = Array.isArray(purchase.player_book_reading_sessions) 
      ? purchase.player_book_reading_sessions 
      : purchase.player_book_reading_sessions 
      ? [purchase.player_book_reading_sessions] 
      : [];
    
    return sessions.some((s: any) => s?.status === "completed");
  };

  const canStartReading = () =>
    !activeSession && selectedBook && isPurchased(selectedBook.id) && !isCompleted(selectedBook.id);

  const handlePurchase = async (book: SkillBook) => {
    if (!profileId || !userId) return;
    
    // Check if already completed
    if (isCompleted(book.id)) {
      toast({
        title: "Already Completed",
        description: "You've already read this book.",
        variant: "destructive",
      });
      setSelectedBook(null);
      return;
    }
    
    purchaseBook({
      bookId: book.id,
      userId: userId,
      profileId: profileId,
      price: book.price,
    });
    setSelectedBook(null);
  };

  const handleStartReading = async () => {
    if (!profileId || !userId || !selectedBook) return;
    
    const purchase = purchases?.find((p) => p.book_id === selectedBook.id);
    if (!purchase) return;

    startReading({
      purchaseId: purchase.id,
      bookId: selectedBook.id,
      userId: userId,
      profileId: profileId,
      readingDays: selectedBook.base_reading_days,
      autoRead,
    });
    setSelectedBook(null);
    setAutoRead(false);
  };

  // Get unique skill categories for filter
  const skillCategories = useMemo(() => {
    if (!typedBooks) return [];
    const cats = new Set<string>();
    for (const book of typedBooks) {
      cats.add(book.skill_display_name || book.skill_slug || "Other");
    }
    return Array.from(cats).sort();
  }, [typedBooks]);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSkill, setSelectedSkill] = useState<string>("all");

  const groupedBooks = useMemo(() => {
    if (!typedBooks) return null;
    
    let filtered = typedBooks;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(b =>
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        (b.skill_display_name || b.skill_slug || "").toLowerCase().includes(q)
      );
    }

    if (selectedSkill !== "all") {
      filtered = filtered.filter(b => (b.skill_display_name || b.skill_slug || "Other") === selectedSkill);
    }

    const groups = new Map<string, EnrichedSkillBook[]>();
    for (const book of filtered) {
      const groupKey = book.skill_display_name || book.skill_slug || "Other";
      const existing = groups.get(groupKey) || [];
      existing.push(book);
      groups.set(groupKey, existing);
    }
    
    return Object.fromEntries(groups.entries());
  }, [typedBooks, searchQuery, selectedSkill]);

  const hasActiveFilters = searchQuery.trim() || selectedSkill !== "all";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Your Library</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Skill books offer passive learning. Choose how long to read each day, then let daily attendance build experience
          over time until completion unlocks the skill gain.
        </p>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search books by title, author, or skill..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectedSkill === "all" ? "default" : "outline"}
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => setSelectedSkill("all")}
          >
            <Filter className="h-3.5 w-3.5" />
            All Skills
          </Button>
          {skillCategories.map((cat) => (
            <Button
              key={cat}
              variant={selectedSkill === cat ? "default" : "outline"}
              size="sm"
              className="text-xs"
              onClick={() => setSelectedSkill(cat)}
            >
              {cat}
            </Button>
          ))}
        </div>
        {hasActiveFilters && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Active filters:</span>
            {searchQuery.trim() && (
              <Badge variant="secondary" className="gap-1 text-xs">
                "{searchQuery}"
                <X className="h-3 w-3 cursor-pointer" onClick={() => setSearchQuery("")} />
              </Badge>
            )}
            {selectedSkill !== "all" && (
              <Badge variant="secondary" className="gap-1 text-xs">
                {selectedSkill}
                <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedSkill("all")} />
              </Badge>
            )}
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => { setSearchQuery(""); setSelectedSkill("all"); }}>
              Clear all
            </Button>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading your library...
        </div>
      )}

      {!isLoading && activeSession && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base">Currently Reading</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="font-semibold">{activeSession.skill_books?.title}</p>
                <p className="text-sm text-muted-foreground">by {activeSession.skill_books?.author}</p>
              </div>
              <Badge variant="outline">
                Day {activeSession.days_read} / {activeSession.skill_books?.base_reading_days || 0}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">XP Earned: {activeSession.total_skill_xp_earned}</p>
            <Button 
              onClick={() => processAttendance()} 
              disabled={isProcessing}
              className="w-full"
              size="sm"
            >
              {isProcessing ? "Processing..." : "Record Today's Reading"}
            </Button>
          </CardContent>
        </Card>
      )}

      {!isLoading && groupedBooks &&
        Object.entries(groupedBooks).map(([groupKey, booksInSkill]) => {
        return (
          <div key={groupKey} className="space-y-4">
            <h3 className="text-lg font-semibold">
              {groupKey}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {booksInSkill.map((book) => {
                const purchased = isPurchased(book.id);
                const completed = isCompleted(book.id);

                return (
                  <Card
                    key={book.id}
                    className="cursor-pointer transition-all hover:border-primary/50 hover:shadow-md"
                    onClick={() => setSelectedBook(book)}
                  >
                    <CardHeader className="pb-3">
                      <CardTitle className="line-clamp-2 text-base leading-snug">{book.title}</CardTitle>
                      <CardDescription className="text-sm">by {book.author}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">{book.base_reading_days} days</span>
                        <span className="font-semibold">${book.price}</span>
                      </div>
                      <Badge 
                        variant={completed ? "outline" : purchased ? "default" : "secondary"} 
                        className="w-full justify-center"
                      >
                        {completed ? "Completed Reading" : purchased ? "Owned" : `Requires Level ${book.required_skill_level}`}
                      </Badge>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}

      <Dialog open={!!selectedBook} onOpenChange={(open) => !open && setSelectedBook(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">{selectedBook?.title}</DialogTitle>
            <DialogDescription>by {selectedBook?.author}</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Description</h4>
              <p className="text-sm leading-relaxed text-muted-foreground">{selectedBook?.description}</p>
            </div>
              <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Skill</span>
                  <Badge variant="outline">
                    {selectedBook?.skill_display_name ?? selectedBook?.skill_slug}
                  </Badge>
                </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Reading Time</span>
                <span className="text-sm font-semibold">{selectedBook?.base_reading_days} days</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Price</span>
                <span className="text-sm font-semibold">${selectedBook?.price}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Skill Gain</span>
                <span className="text-sm font-semibold">
                  {selectedBook && Math.round(Number(selectedBook.skill_percentage_gain) * 100)}%
                </span>
              </div>
            </div>
            {selectedBook && isPurchased(selectedBook.id) && canStartReading() && (
              <div className="flex items-center space-x-2 rounded-lg border bg-muted/20 p-3">
                <Switch id="auto-read" checked={autoRead} onCheckedChange={setAutoRead} />
                <Label htmlFor="auto-read" className="text-sm">
                  Auto-read daily at 11 PM (hands-free progress)
                </Label>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            {selectedBook && isCompleted(selectedBook.id) && (
              <Badge variant="outline" className="w-full justify-center py-2">
                Completed Reading
              </Badge>
            )}
            {selectedBook && !isPurchased(selectedBook.id) && !isCompleted(selectedBook.id) && (
              <Button onClick={() => handlePurchase(selectedBook)} className="w-full sm:w-auto">
                Purchase for ${selectedBook.price}
              </Button>
            )}
            {selectedBook && isPurchased(selectedBook.id) && canStartReading() && (
              <Button onClick={handleStartReading} className="w-full sm:w-auto">
                Start Reading
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
