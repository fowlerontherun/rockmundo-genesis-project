import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSkillBooks } from "@/hooks/useSkillBooks";
import { useAuth } from "@/hooks/use-auth-context";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/lib/supabase-types";

type SkillBook = Tables<"skill_books">;

export const BooksTab = () => {
  const { user } = useAuth();
  const { books, purchases, activeSession, isLoading, purchaseBook, startReading } = useSkillBooks();
  const [selectedBook, setSelectedBook] = useState<SkillBook | null>(null);

  const isPurchased = (bookId: string) => 
    purchases?.some((p) => p.book_id === bookId);

  const canStartReading = () =>
    !activeSession && selectedBook && isPurchased(selectedBook.id);

  const handlePurchase = async (book: SkillBook) => {
    if (!user) return;
    
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
    });
    setSelectedBook(null);
  };

  const groupedBooks = books?.reduce((acc, book) => {
    const skillSlug = book.skill_slug || "Other";
    if (!acc[skillSlug]) acc[skillSlug] = [];
    acc[skillSlug].push(book);
    return acc;
  }, {} as Record<string, SkillBook[]>);

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
                Day {activeSession.days_read}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {!isLoading && Object.entries(groupedBooks || {}).map(([skillSlug, booksInSkill]) => {
        return (
          <div key={skillSlug} className="space-y-4">
            <h3 className="text-lg font-semibold capitalize">
              {skillSlug}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {booksInSkill.map((book) => {
                const purchased = isPurchased(book.id);

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
                      <Badge variant={purchased ? "default" : "secondary"} className="w-full justify-center">
                        {purchased ? "Owned" : `Requires Level ${book.required_skill_level}`}
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
                <Badge variant="outline" className="capitalize">
                  {selectedBook?.skill_slug}
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
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            {selectedBook && !isPurchased(selectedBook.id) && (
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
