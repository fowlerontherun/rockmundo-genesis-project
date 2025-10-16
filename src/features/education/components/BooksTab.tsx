import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSkillBooks } from "@/hooks/useSkillBooks";
import { useAuth } from "@/hooks/use-auth-context";
import { useBookReading } from "@/hooks/useBookReading";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/lib/supabase-types";

type SkillBook = Tables<"skill_books">;
type EnrichedSkillBook = SkillBook & { skill_display_name?: string };

export const BooksTab = () => {
  const { user } = useAuth();
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
    if (!user) return;
    
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
    
    const { data: profile } = await supabase.from("profiles").select("id").eq("user_id", user.id).single();
    if (!profile) return;

    purchaseBook({
      bookId: book.id,
      userId: user.id,
      profileId: profile.id,
      price: book.price,
    });
    setSelectedBook(null);
  };

  const handleStartReading = async () => {
    if (!user || !selectedBook) return;
    
    const purchase = purchases?.find((p) => p.book_id === selectedBook.id);
    if (!purchase) return;

    const { data: profile } = await supabase.from("profiles").select("id").eq("user_id", user.id).single();
    if (!profile) return;

    startReading({
      purchaseId: purchase.id,
      bookId: selectedBook.id,
      userId: user.id,
      profileId: profile.id,
      readingDays: selectedBook.base_reading_days,
      autoRead,
    });
    setSelectedBook(null);
    setAutoRead(false);
  };

  const groupedBooks = useMemo(() => {
    if (!typedBooks) return null;
    
    // Group by display name to consolidate skills with different slugs but same name
    const groups = new Map<string, EnrichedSkillBook[]>();
    
    for (const book of typedBooks) {
      const groupKey = book.skill_display_name || book.skill_slug || "Other";
      const existing = groups.get(groupKey) || [];
      existing.push(book);
      groups.set(groupKey, existing);
    }
    
    return Object.fromEntries(groups.entries());
  }, [typedBooks]);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold">Your Library</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Skill books offer passive learning. Choose how long to read each day, then let daily attendance build experience
          over time until completion unlocks the skill gain.
        </p>
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
