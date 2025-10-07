import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Clock, DollarSign, Lock } from "lucide-react";
import { useSkillBooks } from "@/hooks/useSkillBooks";
import { useAuth } from "@/hooks/use-auth-context";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
    const cat = book.category || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(book);
    return acc;
  }, {} as Record<string, SkillBook[]>);

  if (isLoading) {
    return <div className="text-center py-8">Loading books...</div>;
  }

  return (
    <>
      <Card className="p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2">Your Library</h2>
          <p className="text-muted-foreground">
            Build a foundational library for musicianship, songwriting, and career growth
          </p>
        </div>

        {activeSession && (
          <div className="mb-6 p-4 bg-primary/10 rounded-lg">
            <h3 className="font-semibold mb-2">Currently Reading</h3>
            <p className="text-sm">
              {activeSession.skill_books?.title} by {activeSession.skill_books?.author}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Progress: {activeSession.days_read} days
            </p>
          </div>
        )}

        {groupedBooks && Object.entries(groupedBooks).map(([category, categoryBooks]) => (
          <div key={category} className="mb-8">
            <h3 className="text-xl font-semibold mb-4">{category}</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {categoryBooks.map((book) => {
                const owned = isPurchased(book.id);
                
                return (
                  <Card
                    key={book.id}
                    className="p-4 cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => setSelectedBook(book)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <BookOpen className="h-5 w-5 text-primary" />
                      {owned && <Badge>Owned</Badge>}
                    </div>
                    <h4 className="font-semibold mb-1">{book.title}</h4>
                    <p className="text-sm text-muted-foreground mb-3">{book.author}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {book.base_reading_days} days
                      </span>
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        {book.price}
                      </span>
                    </div>
                    {book.required_skill_level > 0 && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-orange-600">
                        <Lock className="h-3 w-3" />
                        Requires level {book.required_skill_level}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </Card>

      <Dialog open={!!selectedBook} onOpenChange={() => setSelectedBook(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedBook?.title}</DialogTitle>
            <DialogDescription>By {selectedBook?.author}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm">{selectedBook?.description}</p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-semibold">Skill:</span>{" "}
                {selectedBook?.skill_slug}
              </div>
              <div>
                <span className="font-semibold">Reading Time:</span>{" "}
                {selectedBook?.base_reading_days} days
              </div>
              <div>
                <span className="font-semibold">Price:</span> ${selectedBook?.price}
              </div>
              <div>
                <span className="font-semibold">Skill Gain:</span>{" "}
                {selectedBook && Math.round(Number(selectedBook.skill_percentage_gain) * 100)}%
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              You'll read for 1 hour at 11 PM each night
            </p>
            <div className="flex gap-2">
              {isPurchased(selectedBook?.id || "") ? (
                canStartReading() ? (
                  <Button onClick={handleStartReading} className="w-full">
                    Start Reading
                  </Button>
                ) : (
                  <Button disabled className="w-full">
                    {activeSession ? "Already Reading Another Book" : "Owned"}
                  </Button>
                )
              ) : (
                <Button onClick={() => selectedBook && handlePurchase(selectedBook)} className="w-full">
                  Purchase for ${selectedBook?.price}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
