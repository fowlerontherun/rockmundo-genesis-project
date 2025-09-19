
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  BookOpenCheck,
  GraduationCap,
  Loader2,
  PlaySquare,
  RefreshCcw,
  ShoppingCart,
  Sparkles,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameData } from "@/hooks/useGameData";
import { SKILL_TREE_DEFINITIONS, type TierName } from "@/data/skillTree";

const DEFAULT_BOOK_XP = 10;

type SkillBookRow = Database["public"]["Tables"]["skill_books"]["Row"];
type PlayerSkillBookRow = Database["public"]["Tables"]["player_skill_books"]["Row"];
type SkillProgressRow = Database["public"]["Tables"]["skill_progress"]["Row"];

interface PlayerSkillBookWithDetails extends PlayerSkillBookRow {
  skill_books: SkillBookRow | null;
}

const tabs = [
  {
    value: "books",
    label: "Books",
    icon: BookOpen,
    description: "Unlock skills instantly with targeted study guides and XP bonuses.",
  },
  {
    value: "university",
    label: "University",
    icon: GraduationCap,
    description: "Formal programs, certificates, and semester planners.",
  },
  {
    value: "videos",
    label: "YouTube Videos",
    icon: PlaySquare,
    description: "High-impact playlists and channels ready to stream.",
  },
  {
    value: "mentors",
    label: "Mentors",
    icon: Users,
    description: "Personalized coaching pods and expert office hours.",
  },
  {
    value: "band",
    label: "Band Learning",
    icon: Sparkles,
    description: "Level up together with intensives and rotating focus cycles.",
  },
];

const universityRoutes = [
  {
    title: "Degree Programs",
    description: "Performance-first degrees that mix ensemble work with industry labs.",
    highlights: [
      {
        program: "BFA in Contemporary Performance",
        school: "Berklee College of Music",
        format: "4-year",
        detail: "Ensemble collaborations, songwriting bootcamps, and touring simulations.",
      },
      {
        program: "BA in Music Business",
        school: "Middle Tennessee State University",
        format: "4-year",
        detail: "Blend marketing, law, and management courses with internship placements.",
      },
      {
        program: "BS in Music Production",
        school: "Full Sail University",
        format: "Accelerated",
        detail: "Hands-on DAW labs, engineering practicums, and release-ready projects.",
      },
    ],
    action: {
      label: "Download Program Guide",
      href: "https://www.berklee.edu/majors",
    },
  },
  {
    title: "Certificates & Bootcamps",
    description: "Stack micro-credentials that keep you road-ready while you tour.",
    highlights: [
      {
        program: "Modern Music Production",
        school: "Coursera x Berklee",
        format: "12-week",
        detail: "Project-based course with mentor feedback on mixes and arrangements.",
      },
      {
        program: "Music Marketing Accelerator",
        school: "Soundfly",
        format: "Mentor-Led",
        detail: "Design fan funnels, campaigns, and EPK updates with weekly coaching.",
      },
      {
        program: "Live Event Production",
        school: "Point Blank Music School",
        format: "Hybrid",
        detail: "Stage management, advancing, and crew coordination drills.",
      },
    ],
    action: {
      label: "Browse Certificates",
      href: "https://online.berklee.edu/programs",
    },
  },
  {
    title: "Semester Planner",
    description: "Balance credit loads with rehearsal, writing, and release cadences.",
    highlights: [
      {
        program: "Weeks 1-5",
        school: "Skill Ramp-Up",
        format: "Technique",
        detail: "Lock in practice labs, theory refreshers, and sectionals.",
      },
      {
        program: "Weeks 6-10",
        school: "Creative Production",
        format: "Studio",
        detail: "Cut demos, arrange collabs, and prep for showcase submissions.",
      },
      {
        program: "Weeks 11-15",
        school: "Career Launch",
        format: "Industry",
        detail: "Secure gigs, polish your EPK, and rehearse live sets for juries.",
      },
    ],
    action: {
      label: "Download Planner",
      href: "https://calendar.google.com",
    },
  },
];

const isMetadataRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export default function Education() {
  const { user } = useAuth();
  const { profile, awardActionXp } = useGameData();
  const { toast } = useToast();

  const [books, setBooks] = useState<SkillBookRow[]>([]);
  const [ownedBooks, setOwnedBooks] = useState<PlayerSkillBookWithDetails[]>([]);
  const [skillProgress, setSkillProgress] = useState<SkillProgressRow[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(false);
  const [loadingOwnedBooks, setLoadingOwnedBooks] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(false);
  const [purchasingBookId, setPurchasingBookId] = useState<string | null>(null);
  const [readingBookId, setReadingBookId] = useState<string | null>(null);

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
        description: typeof definition?.description === "string" ? definition?.description : null,
        tier,
        track,
        category,
      };
    },
    [skillDefinitionMap],
  );

  const loadBooks = useCallback(async () => {
    setLoadingBooks(true);
    try {
      const { data, error } = await supabase
        .from("skill_books")
        .select("*")
        .eq("is_active", true)
        .order("cost", { ascending: true })
        .order("title", { ascending: true });

      if (error) throw error;

      setBooks((data as SkillBookRow[] | null) ?? []);
    } catch (error) {
      console.error("Failed to load skill books", error);
      toast({
        variant: "destructive",
        title: "Unable to load books",
        description: "We couldn't retrieve the skill book catalog. Please try again soon.",
      });
    } finally {
      setLoadingBooks(false);
    }
  }, [toast]);

  const loadOwnedBooks = useCallback(async () => {
    if (!user) {
      setOwnedBooks([]);
      return;
    }

    setLoadingOwnedBooks(true);
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
        description: "We couldn't retrieve your skill books. Please try again.",
      });
    } finally {
      setLoadingOwnedBooks(false);
    }
  }, [toast, user]);

  const loadSkillProgress = useCallback(async () => {
    if (!profile) {
      setSkillProgress([]);
      return;
    }

    setLoadingProgress(true);
    try {
      const { data, error } = await supabase
        .from("skill_progress")
        .select("skill_slug,current_level,current_xp,metadata")
        .eq("profile_id", profile.id);

      if (error) throw error;

      setSkillProgress((data as SkillProgressRow[] | null) ?? []);
    } catch (error) {
      console.error("Failed to load skill progress", error);
    } finally {
      setLoadingProgress(false);
    }
  }, [profile]);

  useEffect(() => {
    void loadBooks();
  }, [loadBooks]);

  useEffect(() => {
    void loadOwnedBooks();
  }, [loadOwnedBooks]);

  useEffect(() => {
    void loadSkillProgress();
  }, [loadSkillProgress]);

  const ownedBooksMap = useMemo(() => {
    const map = new Map<string, PlayerSkillBookWithDetails>();
    for (const entry of ownedBooks) {
      if (entry.skill_book_id) {
        map.set(entry.skill_book_id, entry);
      }
    }
    return map;
  }, [ownedBooks]);

  const knownSkillSlugs = useMemo(() => {
    const unlocked = new Set<string>();
    for (const progress of skillProgress) {
      if ((progress.current_level ?? 0) > 0 || (progress.current_xp ?? 0) > 0) {
        unlocked.add(progress.skill_slug);
      }
    }
    return unlocked;
  }, [skillProgress]);

  const availableBooks = useMemo(
    () =>
      [...books].sort((a, b) => {
        const costDifference = Number(a.cost ?? 0) - Number(b.cost ?? 0);
        if (costDifference !== 0) {
          return costDifference;
        }
        return a.title.localeCompare(b.title);
      }),
    [books],
  );

  const handlePurchase = useCallback(
    async (book: SkillBookRow) => {
      if (!user || !profile) {
        toast({
          variant: "destructive",
          title: "Sign in required",
          description: "You need an active character to purchase skill books.",
        });
        return;
      }

      if (knownSkillSlugs.has(book.skill_slug)) {
        toast({
          variant: "destructive",
          title: "Skill already unlocked",
          description: "Your character already knows this skill, so the book can't be purchased again.",
        });
        return;
      }

      if (ownedBooksMap.has(book.id)) {
        toast({
          title: "Already owned",
          description: "This book is already in your library.",
        });
        return;
      }

      setPurchasingBookId(book.id);
      try {
        const { error } = await supabase.from("player_skill_books").insert({
          user_id: user.id,
          profile_id: profile.id,
          skill_book_id: book.id,
        });

        if (error) throw error;

        toast({
          title: "Book added to library",
          description: book.title + " is ready to read from your inventory.",
        });

        await loadOwnedBooks();
      } catch (error) {
        console.error("Failed to purchase skill book", error);
        toast({
          variant: "destructive",
          title: "Purchase failed",
          description: "We couldn't process the purchase. Please try again.",
        });
      } finally {
        setPurchasingBookId(null);
      }
    },
    [knownSkillSlugs, loadOwnedBooks, ownedBooksMap, profile, toast, user],
  );

  const handleRead = useCallback(
    async (book: SkillBookRow) => {
      if (!user || !profile) {
        toast({
          variant: "destructive",
          title: "Sign in required",
          description: "You need an active character to read skill books.",
        });
        return;
      }

      if (knownSkillSlugs.has(book.skill_slug)) {
        toast({
          variant: "destructive",
          title: "Skill already unlocked",
          description: "Your character already knows this skill from another source.",
        });
        return;
      }

      const owned = ownedBooksMap.get(book.id);
      if (!owned) {
        toast({
          variant: "destructive",
          title: "Book not owned",
          description: "Purchase the book first before reading it.",
        });
        return;
      }

      if (owned.is_consumed) {
        toast({
          title: "Already completed",
          description: "You've already claimed the reward from this book.",
        });
        return;
      }

      const metadata = getSkillMetadata(book.skill_slug);
      const xpReward = book.xp_value ?? DEFAULT_BOOK_XP;

      setReadingBookId(book.id);
      try {
        const { error } = await supabase
          .from("player_skill_books")
          .update({ is_consumed: true, consumed_at: new Date().toISOString() })
          .eq("id", owned.id);

        if (error) throw error;

        try {
          await awardActionXp({
            amount: xpReward,
            actionKey: "read_skill_book",
            metadata: { skill_slug: book.skill_slug, skill_book_id: book.id },
          });
        } catch (xpError) {
          console.error("Failed to award XP from book", xpError);
          toast({
            variant: "destructive",
            title: "XP grant failed",
            description: "The book was marked as read, but the experience boost could not be applied.",
          });
        }

        try {
          const { data: existingProgress, error: progressError } = await supabase
            .from("skill_progress")
            .select("current_level,current_xp,required_xp,metadata")
            .eq("profile_id", profile.id)
            .eq("skill_slug", book.skill_slug)
            .maybeSingle();

          if (progressError) {
            throw progressError;
          }

          const existingMetadata = isMetadataRecord(existingProgress?.metadata)
            ? (existingProgress?.metadata as Record<string, unknown>)
            : {};

          const progressPayload: Database["public"]["Tables"]["skill_progress"]["Insert"] = {
            profile_id: profile.id,
            skill_slug: book.skill_slug,
            current_level: Math.max(existingProgress?.current_level ?? 0, 1),
            current_xp: (existingProgress?.current_xp ?? 0) + xpReward,
            required_xp: existingProgress?.required_xp ?? xpReward,
            metadata: {
              ...existingMetadata,
              unlocked_by: existingMetadata?.unlocked_by ?? "skill_book",
              last_book_reward: xpReward,
            },
          };

          const { error: upsertError } = await supabase
            .from("skill_progress")
            .upsert(progressPayload, { onConflict: "profile_id,skill_slug" });

          if (upsertError) {
            throw upsertError;
          }
        } catch (progressError) {
          console.error("Failed to update skill progress from book", progressError);
        }

        toast({
          title: "Skill unlocked",
          description: "Reading " + metadata.name + " granted " + xpReward + " XP.",
        });

        await Promise.all([loadOwnedBooks(), loadSkillProgress()]);
      } catch (error) {
        console.error("Failed to mark book as read", error);
        toast({
          variant: "destructive",
          title: "Reading failed",
          description: "We couldn't complete the read action. Please try again.",
        });
      } finally {
        setReadingBookId(null);
      }
    },
    [
      awardActionXp,
      getSkillMetadata,
      knownSkillSlugs,
      loadOwnedBooks,
      loadSkillProgress,
      ownedBooksMap,
      profile,
      toast,
      user,
    ],
  );

  const ownedBooksWithDetails = useMemo(
    () => ownedBooks.filter((entry) => entry.skill_books !== null),
    [ownedBooks],
  );

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Education Hub</h1>
        <p className="text-muted-foreground">
          Mix self-study, formal programs, and collaborative mentorship to grow faster every week.
        </p>
      </div>

      <Tabs defaultValue="books" className="space-y-6">
        <TabsList className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="flex items-center gap-2">
              <tab.icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="books" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <CardTitle>Skill Book Marketplace</CardTitle>
                <CardDescription>
                  Purchase focused study guides to unlock skill tree branches instantly and earn bonus XP.
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => void loadBooks()}
                disabled={loadingBooks}
                title="Refresh available books"
              >
                <RefreshCcw className={`h-4 w-4 ${loadingBooks ? "animate-spin" : ""}`} />
                <span className="sr-only">Refresh books</span>
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {!user || !profile ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  Sign in and choose a character to buy or read skill books.
                </div>
              ) : null}

              {loadingBooks ? (
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" /> Loading books...
                </div>
              ) : availableBooks.length === 0 ? (
                <p className="text-muted-foreground">
                  No books are currently available. Check back soon for new study materials.
                </p>
              ) : (
                <div className="space-y-4">
                  {availableBooks.map((book) => {
                    const skillMetadata = getSkillMetadata(book.skill_slug);
                    const ownedEntry = ownedBooksMap.get(book.id);
                    const alreadyUnlocked = knownSkillSlugs.has(book.skill_slug);
                    const alreadyOwned = Boolean(ownedEntry);
                    const alreadyRead = ownedEntry?.is_consumed ?? false;
                    const purchaseDisabled = !user || !profile || alreadyUnlocked || alreadyOwned;
                    const readDisabled =
                      !user ||
                      !profile ||
                      alreadyUnlocked ||
                      !alreadyOwned ||
                      alreadyRead;

                    return (
                      <div key={book.id} className="space-y-3 rounded-lg border p-4 shadow-sm">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-semibold">{book.title}</h3>
                            {skillMetadata.tier ? <Badge variant="outline">{skillMetadata.tier}</Badge> : null}
                            {alreadyRead ? <Badge>Completed</Badge> : alreadyOwned ? <Badge variant="secondary">Owned</Badge> : null}
                            {alreadyUnlocked ? <Badge variant="destructive">Skill Known</Badge> : null}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {book.description ??
                              skillMetadata.description ??
                              "Unlock this skill instantly and gain a burst of progression XP."}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            <Badge variant="secondary">${Number(book.cost ?? 0).toLocaleString()}</Badge>
                            <Badge variant="secondary">{(book.xp_value ?? DEFAULT_BOOK_XP) + " XP"}</Badge>
                            {skillMetadata.track ? (
                              <Badge variant="outline">{skillMetadata.track}</Badge>
                            ) : skillMetadata.category ? (
                              <Badge variant="outline">{skillMetadata.category}</Badge>
                            ) : null}
                          </div>
                          {alreadyUnlocked ? (
                            <div className="flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400">
                              <AlertCircle className="h-4 w-4" />
                              Your character already mastered this skill. Books can only be consumed once per skill.
                            </div>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            onClick={() => void handlePurchase(book)}
                            disabled={purchaseDisabled || purchasingBookId === book.id}
                          >
                            {purchasingBookId === book.id ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Purchasing
                              </>
                            ) : (
                              <>
                                <ShoppingCart className="mr-2 h-4 w-4" /> Purchase
                              </>
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => void handleRead(book)}
                            disabled={readDisabled || readingBookId === book.id}
                          >
                            {readingBookId === book.id ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Reading
                              </>
                            ) : (
                              <>
                                <BookOpenCheck className="mr-2 h-4 w-4" /> Read & Unlock
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <CardTitle>Your Library</CardTitle>
                <CardDescription>Review the books you own and track which skills they unlocked.</CardDescription>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => void loadOwnedBooks()}
                disabled={loadingOwnedBooks}
                title="Refresh your library"
              >
                <RefreshCcw className={`h-4 w-4 ${loadingOwnedBooks ? "animate-spin" : ""}`} />
                <span className="sr-only">Refresh library</span>
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingOwnedBooks || loadingProgress ? (
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" /> Loading your library...
                </div>
              ) : ownedBooksWithDetails.length === 0 ? (
                <p className="text-muted-foreground">
                  You haven't collected any skill books yet. Visit the marketplace above to grab your first guide.
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
        </TabsContent>

        <TabsContent value="university" className="space-y-6">
          {universityRoutes.map((route) => (
            <Card key={route.title}>
              <CardHeader>
                <CardTitle>{route.title}</CardTitle>
                <CardDescription>{route.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  {route.highlights.map((item) => (
                    <div key={item.program} className="space-y-1 rounded-lg border p-4">
                      <div className="font-semibold">{item.program}</div>
                      <div className="text-sm text-muted-foreground">{item.school}</div>
                      <div className="text-sm text-muted-foreground">{item.format}</div>
                      <p className="text-sm">{item.detail}</p>
                    </div>
                  ))}
                </div>
                <Button variant="outline" asChild>
                  <a href={route.action.href} target="_blank" rel="noreferrer">
                    {route.action.label}
                  </a>
                </Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="videos">
          <Card>
            <CardHeader>
              <CardTitle>Curated YouTube Playlists</CardTitle>
              <CardDescription>
                Jump into high-impact practice routines and production walkthroughs from trusted creators.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border p-4">
                  <h3 className="font-semibold">Daily Technique Lab</h3>
                  <p className="text-sm text-muted-foreground">Warmups and drills from Berklee Online faculty.</p>
                </div>
                <div className="rounded-lg border p-4">
                  <h3 className="font-semibold">Mixing in the Box</h3>
                  <p className="text-sm text-muted-foreground">Step-by-step mixes using stock plugins and free tools.</p>
                </div>
              </div>
              <Button variant="outline">Explore Video Library</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mentors">
          <Card>
            <CardHeader>
              <CardTitle>Mentor Pods</CardTitle>
              <CardDescription>
                Join rotating pods of experts to review your mixes, stagecraft, and release plans every week.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border p-4">
                <h3 className="font-semibold">Song Doctor Sessions</h3>
                <p className="text-sm text-muted-foreground">Lyric and structure feedback from charting writers.</p>
              </div>
              <div className="rounded-lg border p-4">
                <h3 className="font-semibold">Stagecraft Intensive</h3>
                <p className="text-sm text-muted-foreground">Weekly run-throughs with live show directors and choreographers.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="band">
          <Card>
            <CardHeader>
              <CardTitle>Band Learning Circles</CardTitle>
              <CardDescription>
                Coordinate practice quests, crowd-work drills, and release sprints with your bandmates.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border p-4">
                <h3 className="font-semibold">Four-Week Focus Cycle</h3>
                <p className="text-sm text-muted-foreground">
                  Rotate through songwriting, production, and live polish weeks with shared scoreboards.
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <h3 className="font-semibold">Tour-Ready Checklist</h3>
                <p className="text-sm text-muted-foreground">Lock in merch, setlists, and travel rehearsals before you hit the road.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

