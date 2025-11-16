import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, CheckCircle2, Clock } from "lucide-react";
import { useSkillBooksInventory } from "@/hooks/useSkillBooksInventory";

const InventoryManager = () => {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });
  }, []);

  const { books, isLoading, completeBook, isCompleting } = useSkillBooksInventory(user?.id);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Inventory Manager</h1>
        <p className="text-muted-foreground">Manage your equipment, wardrobe, and learning resources.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Inventory System Preview</CardTitle>
          <CardDescription>
            Equipment and wardrobe management tools are in development. Track your education books below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Future updates will introduce equipment loadouts, wardrobe customization, and detailed inventory analytics.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Book Library</CardTitle>
          <CardDescription>Review the education books you've purchased and their completion status.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!user ? (
            <p className="text-sm text-muted-foreground">Sign in to view your book inventory.</p>
          ) : isLoading ? (
            <p className="text-sm text-muted-foreground">Loading your books...</p>
          ) : books.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No books in your inventory yet. Visit the education section to purchase skill books!
            </p>
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
    </div>
  );
};

export default InventoryManager;
