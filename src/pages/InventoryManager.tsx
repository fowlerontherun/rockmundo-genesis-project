import React, { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/use-auth-context";
import { fetchPrimaryProfileForUser } from "@/integrations/supabase/friends";

type SkillBookRow = Tables<"skill_books">;
type PlayerSkillBookRow = Tables<"player_skill_books">;

const InventoryManager = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isLoadingBooks, setIsLoadingBooks] = useState(false);
  const [bookInventory, setBookInventory] = useState<
    (PlayerSkillBookRow & { skill_books: SkillBookRow | null })[]
  >([]);

  const loadBookInventory = useCallback(
    async (currentProfileId: string) => {
      setIsLoadingBooks(true);
      try {
        const { data, error } = await supabase
          .from("player_skill_books")
          .select("*, skill_books:skill_books(*)")
          .eq("profile_id", currentProfileId)
          .order("acquired_at", { ascending: false });

        if (error) throw error;

        setBookInventory((data as (PlayerSkillBookRow & { skill_books: SkillBookRow | null })[] | null) ?? []);
      } catch (error) {
        console.error("Failed to load book inventory", error);
        toast({
          variant: "destructive",
          title: "Unable to load books",
          description: "We could not retrieve your book inventory. Please try again later.",
        });
      } finally {
        setIsLoadingBooks(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    if (!user) {
      setProfileId(null);
      setBookInventory([]);
      return;
    }

    let isCurrent = true;
    setIsLoadingProfile(true);

    const fetchProfile = async () => {
      try {
        const profile = await fetchPrimaryProfileForUser(user.id);
        if (!isCurrent) return;
        setProfileId(profile?.id ?? null);
        if (profile?.id) {
          await loadBookInventory(profile.id);
        }
      } catch (error) {
        console.error("Failed to load active profile", error);
        if (isCurrent) {
          toast({
            variant: "destructive",
            title: "Unable to load your character",
            description: "Create a character to start tracking inventory.",
          });
        }
        setProfileId(null);
      } finally {
        if (isCurrent) {
          setIsLoadingProfile(false);
        }
      }
    };

    void fetchProfile();

    return () => {
      isCurrent = false;
    };
  }, [loadBookInventory, toast, user]);

  useEffect(() => {
    if (!profileId) {
      setBookInventory([]);
      return;
    }

    void loadBookInventory(profileId);
  }, [loadBookInventory, profileId]);

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
            Equipment and wardrobe management tools are in development. Track your education books below while we finish the rest of
            the system.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Future updates will introduce equipment loadouts, wardrobe customization, and detailed inventory analytics. Stay tuned!
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
          ) : isLoadingProfile ? (
            <div className="flex items-center gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading your character...
            </div>
          ) : !profileId ? (
            <p className="text-sm text-muted-foreground">Create a character profile to start collecting books.</p>
          ) : isLoadingBooks ? (
            <div className="flex items-center gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading books...
            </div>
          ) : bookInventory.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You haven't purchased any books yet. Visit the Education hub to unlock new skills.
            </p>
          ) : (
            <div className="space-y-4">
              {bookInventory.map((entry) => {
                const book = entry.skill_books;
                return (
                  <div key={entry.id} className="rounded-lg border bg-muted/20 p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{book?.title ?? "Unknown Book"}</p>
                        {book?.author ? <p className="text-xs text-muted-foreground">by {book.author}</p> : null}
                      </div>
                      <Badge variant={entry.xp_awarded_at ? "default" : "secondary"}>
                        {entry.xp_awarded_at ? "Completed" : "Owned"}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {book?.skill_slug ? <Badge variant="outline">{book.skill_slug}</Badge> : null}
                      {book?.xp_reward ? <Badge variant="outline">+{book.xp_reward} XP</Badge> : null}
                      {entry.acquired_at ? (
                        <Badge variant="outline">
                          Purchased {new Date(entry.acquired_at).toLocaleDateString()}
                        </Badge>
                      ) : null}
                    </div>
                    {entry.consumed_at ? (
                      <p className="text-xs text-muted-foreground">
                        Completed on {new Date(entry.consumed_at).toLocaleDateString()} and XP applied.
                      </p>
                    ) : null}
                  </div>
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
