import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameData } from "@/hooks/useGameData";
import { SKILL_TREE_DEFINITIONS, type TierName } from "@/data/skillTree";

const DEFAULT_BOOK_XP = 10;

type SkillBookRow = Database["public"]["Tables"]["skill_books"]["Row"];
type PlayerSkillBookRow = Database["public"]["Tables"]["player_skill_books"]["Row"];

interface PlayerSkillBookWithDetails extends PlayerSkillBookRow {
  skill_books: SkillBookRow | null;
}

const isMetadataRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const InventoryManager = () => {
  const { user } = useAuth();
  const { profile } = useGameData();
  const { toast } = useToast();

  const [ownedBooks, setOwnedBooks] = useState<PlayerSkillBookWithDetails[]>([]);
  const [loading, setLoading] = useState(false);

  const skillDefinitionMap = useMemo(() => {
    const map = new Map<string, (typeof SKILL_TREE_DEFINITIONS)[number]>();
    for (const definition of SKILL_TREE_DEFINITIONS) {
      map.set(definition.slug, definition);
    }
    return map;
  }, []);

  const getSkillMetadata = useCallback(
    (slug: string) => {
      const definition = skillDefinitionMap.get(slug);
      const metadata = isMetadataRecord(definition?.metadata) ? definition?.metadata : {};
      const tierValue = metadata?.tier;
      const tier: TierName | undefined =
        typeof tierValue === "string" && (tierValue === "Basic" || tierValue === "Professional" || tierValue === "Mastery")
          ? (tierValue as TierName)
          : undefined;
      const track = typeof metadata?.track === "string" ? metadata.track : undefined;
      const category = typeof metadata?.category === "string" ? metadata.category : undefined;

      return {
        name: definition?.display_name ?? slug,
        tier,
        track,
        category,
      };
    },
    [skillDefinitionMap],
  );

  const loadOwnedBooks = useCallback(async () => {
    if (!user) {
      setOwnedBooks([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("player_skill_books")
        .select("*, skill_books(*)")
        .eq("user_id", user.id)
        .order("owned_at", { ascending: false });

      if (error) throw error;

      setOwnedBooks((data as PlayerSkillBookWithDetails[] | null) ?? []);
    } catch (error) {
      console.error("Failed to load owned books", error);
      toast({
        variant: "destructive",
        title: "Unable to load library",
        description: "We couldn't retrieve your collected books. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }, [toast, user]);

  useEffect(() => {
    void loadOwnedBooks();
  }, [loadOwnedBooks]);

  const ownedBooksWithDetails = useMemo(
    () => ownedBooks.filter((entry) => entry.skill_books !== null),
    [ownedBooks],
  );

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Inventory Manager</h1>
        <p className="text-muted-foreground">
          Review your study materials and keep tabs on equipment as new features roll out.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <CardTitle>Owned Skill Books</CardTitle>
              <CardDescription>
                Track the books you've purchased and see which skills they've boosted.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => void loadOwnedBooks()}
              disabled={loading}
              title="Refresh library"
            >
              <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              <span className="sr-only">Refresh library</span>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {!user ? (
              <p className="text-muted-foreground">Sign in to view the books you've collected.</p>
            ) : loading ? (
              <div className="flex items-center gap-3 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" /> Loading your books...
              </div>
            ) : ownedBooksWithDetails.length === 0 ? (
              <p className="text-muted-foreground">
                You haven't collected any books yet. Purchase study guides from the Education hub to see them here.
              </p>
            ) : (
              <div className="space-y-3">
                {ownedBooksWithDetails.map((entry) => {
                  const book = entry.skill_books;
                  if (!book) {
                    return null;
                  }

                  const metadata = getSkillMetadata(book.skill_slug);
                  const ownedDate = entry.owned_at ? new Date(entry.owned_at) : null;
                  const consumedDate = entry.consumed_at ? new Date(entry.consumed_at) : null;

                  return (
                    <div key={entry.id} className="space-y-2 rounded-lg border p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{book.title}</span>
                        <Badge variant={entry.is_consumed ? "default" : "secondary"}>
                          {entry.is_consumed ? "Read" : "Unread"}
                        </Badge>
                        {metadata.tier ? <Badge variant="outline">{metadata.tier}</Badge> : null}
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span>{metadata.name}</span>
                        {ownedDate ? <span>Acquired {ownedDate.toLocaleDateString()}</span> : null}
                        {entry.is_consumed && consumedDate ? (
                          <span>Finished {consumedDate.toLocaleDateString()}</span>
                        ) : null}
                        <span>Reward {book.xp_value ?? DEFAULT_BOOK_XP} XP</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Equipment & Wardrobe</CardTitle>
            <CardDescription>
              Equipment and wardrobe management features are currently under development.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Soon you'll be able to organize instruments, outfits, and loadouts alongside your study resources.
            </p>
            {profile ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Active character: <span className="font-medium">{profile.username}</span>
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default InventoryManager;

