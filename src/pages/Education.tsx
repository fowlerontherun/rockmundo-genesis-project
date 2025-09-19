import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, GraduationCap, Loader2, PlaySquare, Users, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/use-auth-context";
import { fetchPrimaryProfileForUser } from "@/integrations/supabase/friends";
import { awardSpecialXp } from "@/utils/progression";

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
    description: "Structured learning plans designed to level up your entire band together."
  }
];

type SkillBookRow = Tables<"skill_books">;
type PlayerSkillBookRow = Tables<"player_skill_books">;
type SkillDefinitionRow = Tables<"skill_definitions">;

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

const Education = () => {
  const { toast } = useToast();
  const {
    definitions,
    progress,
    loading: skillsLoading,
    error: skillsError,
    refreshProgress,
    updateSkillProgress
  } = useSkillSystem();
  const { attributes, skills, addActivity } = useGameData();

  const [videoWatchCounts, setVideoWatchCounts] = useState<Record<string, number>>({});
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});
  const [activeSkill, setActiveSkill] = useState<string | null>(null);
  const [lastWatchedAt, setLastWatchedAt] = useState<Record<string, number>>({});

  useEffect(() => {
    void refreshProgress();
  }, [refreshProgress]);

  const progressBySlug = useMemo(() => {
    const map = new Map<string, SkillProgressRecord>();
    for (const record of progress ?? []) {
      if (record?.skill_slug) {
        map.set(record.skill_slug, record);
      }
    }
    return map;
  }, [progress]);

  const skillsRecord = useMemo(() => {
    return (skills as PlayerSkills | null) ?? null;
  }, [skills]);

  const getSkillValue = useCallback(
    (slug: string) => {
      const progressRecord = progressBySlug.get(slug);
      if (progressRecord) {
        const numeric = Number(progressRecord.current_value ?? progressRecord.total_xp ?? 0);
        if (Number.isFinite(numeric)) {
          return numeric;
        }
      }

      const fallback = skillsRecord?.[slug];
      if (typeof fallback === "number" && Number.isFinite(fallback)) {
        return fallback;
      }

      return 0;
    },
    [progressBySlug, skillsRecord]
  );

  const getCooldownRemaining = useCallback(
    (slug: string) => {
      const readyAt = cooldowns[slug];
      if (!readyAt) {
        return 0;
      }

      const remainingMs = readyAt - Date.now();
      if (remainingMs <= 0) {
        return 0;
      }

      return Math.ceil(remainingMs / 60000);
    },
    [cooldowns]
  );

  const groupedSkills = useMemo(() => {
    if (!definitions || definitions.length === 0) {
      return [] as Array<{ category: string; skills: SkillDefinitionRecord[] }>;
    }

    const map = new Map<string, SkillDefinitionRecord[]>();
    for (const definition of definitions) {
      const category = (definition.metadata?.category as string | undefined) ?? "General";
      if (!map.has(category)) {
        map.set(category, []);
      }
      map.get(category)?.push(definition);
    }

const Education = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [skillBooks, setSkillBooks] = useState<SkillBookRow[]>([]);
  const [skillDefinitions, setSkillDefinitions] = useState<SkillDefinitionRow[]>([]);
  const [ownedBooks, setOwnedBooks] = useState<Record<string, PlayerSkillBookRow>>({});
  const [skillUnlocks, setSkillUnlocks] = useState<
    Record<string, { isUnlocked: boolean; unlockLevel: number | null }>
  >({});
  const [profileId, setProfileId] = useState<string | null>(null);
  const [isLoadingBooks, setIsLoadingBooks] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [pendingPurchaseId, setPendingPurchaseId] = useState<string | null>(null);
  const [pendingReadId, setPendingReadId] = useState<string | null>(null);

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }),
    [],
  );

  const skillDefinitionBySlug = useMemo(() => {
    return skillDefinitions.reduce<Record<string, SkillDefinitionRow>>((acc, definition) => {
      if (definition.slug) {
        acc[definition.slug] = definition;
      }
      return acc;
    }, {});
  }, [skillDefinitions]);

  const skillDefinitionIdBySlug = useMemo(() => {
    return skillDefinitions.reduce<Record<string, string>>((acc, definition) => {
      if (definition.slug && definition.id) {
        acc[definition.slug] = definition.id;
      }
      return acc;
    }, {});
  }, [skillDefinitions]);

  const loadSkillData = useCallback(async () => {
    setIsLoadingBooks(true);
    try {
      const [{ data: booksData, error: booksError }, { data: definitionsData, error: definitionsError }] =
        await Promise.all([
          supabase.from("skill_books").select("*").order("title", { ascending: true }),
          supabase.from("skill_definitions").select("id, slug, display_name").order("display_name", { ascending: true }),
        ]);

      if (booksError) throw booksError;
      if (definitionsError) throw definitionsError;

      setSkillBooks((booksData as SkillBookRow[] | null) ?? []);
      setSkillDefinitions((definitionsData as SkillDefinitionRow[] | null) ?? []);
    } catch (error) {
      console.error("Failed to load skill books", error);
      toast({
        variant: "destructive",
        title: "Unable to load books",
        description: "We couldn't retrieve the education library. Please try again later.",
      });
    } finally {
      setIsLoadingBooks(false);
    }
  }, [toast]);

  const loadOwnedBooks = useCallback(
    async (currentProfileId: string) => {
      try {
        const { data, error } = await supabase
          .from("player_skill_books")
          .select("*")
          .eq("profile_id", currentProfileId);

        if (error) throw error;

        const map: Record<string, PlayerSkillBookRow> = {};
        for (const row of (data as PlayerSkillBookRow[] | null) ?? []) {
          map[row.skill_book_id] = row;
        }
        setOwnedBooks(map);
      } catch (error) {
        console.error("Failed to load owned books", error);
        toast({
          variant: "destructive",
          title: "Unable to load your books",
          description: "We couldn't check which books you own.",
        });
      }
    },
    [toast],
  );

  const loadSkillUnlocks = useCallback(
    async (currentProfileId: string) => {
      try {
        const { data, error } = await supabase
          .from("profile_skill_unlocks")
          .select("skill_id, is_unlocked, unlock_level")
          .eq("profile_id", currentProfileId);

        if (error) throw error;

        const map: Record<string, { isUnlocked: boolean; unlockLevel: number | null }> = {};
        for (const entry of (data as { skill_id: string; is_unlocked: boolean | null; unlock_level: number | null }[] | null) ?? []) {
          if (entry.skill_id) {
            map[entry.skill_id] = {
              isUnlocked: Boolean(entry.is_unlocked),
              unlockLevel: entry.unlock_level,
            };
          }
        }
        setSkillUnlocks(map);
      } catch (error) {
        console.error("Failed to load skill unlocks", error);
        toast({
          variant: "destructive",
          title: "Unable to check skill unlocks",
          description: "We couldn't determine which skills are already unlocked.",
        });
      }
    },
    [toast],
  );

  useEffect(() => {
    void loadSkillData();
  }, [loadSkillData]);

  useEffect(() => {
    if (!user) {
      setProfileId(null);
      setOwnedBooks({});
      setSkillUnlocks({});
      return;
    }

    let isCurrent = true;
    setIsLoadingProfile(true);
    const fetchProfile = async () => {
      try {
        const profile = await fetchPrimaryProfileForUser(user.id);
        if (!isCurrent) return;
        setProfileId(profile?.id ?? null);
      } catch (error) {
        console.error("Failed to load active profile", error);
        if (isCurrent) {
          toast({
            variant: "destructive",
            title: "Unable to load your character",
            description: "We couldn't find an active profile. Create a character to unlock books.",
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
  }, [toast, user]);

  useEffect(() => {
    if (!profileId) {
      setOwnedBooks({});
      setSkillUnlocks({});
      return;
    }

    void loadOwnedBooks(profileId);
    void loadSkillUnlocks(profileId);
  }, [loadOwnedBooks, loadSkillUnlocks, profileId]);

  const handlePurchase = useCallback(
    async (book: SkillBookRow) => {
      if (!user) {
        toast({
          variant: "destructive",
          title: "Sign in required",
          description: "Create an account or sign in to purchase books.",
        });
        return;
      }

      if (!profileId) {
        toast({
          variant: "destructive",
          title: "Select a character",
          description: "You need an active character profile to collect books.",
        });
        return;
      }

      if (ownedBooks[book.id]) {
        toast({
          title: "Already owned",
          description: "This book is already in your library.",
        });
        return;
      }

      setPendingPurchaseId(book.id);
      try {
        const { data, error } = await supabase
          .from("player_skill_books")
          .insert({ profile_id: profileId, skill_book_id: book.id })
          .select("*")
          .single();

        if (error) throw error;

        const inserted = data as PlayerSkillBookRow;
        setOwnedBooks((prev) => ({ ...prev, [book.id]: inserted }));
        toast({
          title: "Book purchased",
          description: `${book.title} is now in your inventory.`,
        });
      } catch (error) {
        console.error("Failed to purchase book", error);
        toast({
          variant: "destructive",
          title: "Purchase failed",
          description: "We couldn't complete that purchase. Please try again.",
        });
      } finally {
        setPendingPurchaseId(null);
      }
    },
    [ownedBooks, profileId, toast, user],
  );

  const handleRead = useCallback(
    async (book: SkillBookRow) => {
      if (!profileId) {
        toast({
          variant: "destructive",
          title: "Select a character",
          description: "Create or select a character before reading books.",
        });
        return;
      }

      const ownership = ownedBooks[book.id];
      if (!ownership) {
        toast({
          variant: "destructive",
          title: "Purchase required",
          description: "Buy the book before attempting to read it.",
        });
        return;
      }

      if (ownership.xp_awarded_at) {
        toast({
          title: "Already completed",
          description: "You've already gained the XP from this book.",
        });
        return;
      }

      setPendingReadId(book.id);
      const xpAmount = book.xp_reward ?? 10;
      const metadata = {
        book_id: book.id,
        book_slug: book.slug,
        skill_slug: book.skill_slug,
      };
      const now = new Date().toISOString();
      try {
        await awardSpecialXp({ amount: xpAmount, reason: `skill_book:${book.slug}`, metadata });

        const { data, error } = await supabase
          .from("player_skill_books")
          .update({ consumed_at: now, xp_awarded_at: now })
          .eq("id", ownership.id)
          .select("*")
          .single();

        if (error) throw error;

        const updated = data as PlayerSkillBookRow;
        setOwnedBooks((prev) => ({ ...prev, [book.id]: updated }));

        const skillId = skillDefinitionIdBySlug[book.skill_slug];
        if (skillId) {
          const { error: unlockError } = await supabase
            .from("profile_skill_unlocks")
            .upsert(
              {
                profile_id: profileId,
                skill_id: skillId,
                is_unlocked: true,
                unlocked_at: now,
                unlock_level: Math.max(10, skillUnlocks[skillId]?.unlockLevel ?? 0),
                unlock_source: `book:${book.slug}`,
              },
              { onConflict: "profile_id,skill_id" },
            );

          if (unlockError) throw unlockError;

          setSkillUnlocks((prev) => ({
            ...prev,
            [skillId]: {
              isUnlocked: true,
              unlockLevel: Math.max(10, prev[skillId]?.unlockLevel ?? 0),
            },
          }));
        }

        toast({
          title: "Skill unlocked",
          description: `Reading ${book.title} granted +${xpAmount} XP.`,
        });
      } catch (error) {
        console.error("Failed to process book read", error);
        toast({
          variant: "destructive",
          title: "Progress not saved",
          description: "We couldn't record that reading session. Please try again.",
        });
      } finally {
        setPendingReadId(null);
      }
    },
    [ownedBooks, profileId, skillDefinitionIdBySlug, skillUnlocks, toast],
  );

  const isAuthenticated = Boolean(user);

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
            <CardHeader>
              <CardTitle>Skill Book Library</CardTitle>
              <CardDescription>
                Purchase books to unlock foundational skills and earn a one-time 10 XP reward when you read them.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!isAuthenticated ? (
                <p className="text-sm text-muted-foreground">
                  Sign in to start collecting books and unlocking skills.
                </p>
              ) : isLoadingProfile ? (
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Loading your character...
                </div>
              ) : !profileId ? (
                <p className="text-sm text-muted-foreground">
                  Create a character profile to track your book progress.
                </p>
              ) : null}
              {isLoadingBooks ? (
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Loading books...
                </div>
              ) : skillBooks.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No books have been published yet. Check back soon for new study material.
                </p>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {skillBooks.map((book) => {
                    const ownership = ownedBooks[book.id];
                    const isOwned = Boolean(ownership);
                    const isCompleted = Boolean(ownership?.xp_awarded_at);
                    const skillLabel = skillDefinitionBySlug[book.skill_slug]?.display_name ?? book.skill_slug;
                    const skillId = skillDefinitionIdBySlug[book.skill_slug];
                    const unlockInfo = skillId ? skillUnlocks[skillId] : undefined;
                    const alreadyUnlocked = Boolean(unlockInfo?.isUnlocked);
                    return (
                      <Card key={book.id} className="border-dashed">
                        <CardHeader className="space-y-2">
                          <div className="flex items-start justify-between gap-4">
                            <CardTitle className="text-lg">{book.title}</CardTitle>
                            <Badge variant={isCompleted ? "default" : isOwned ? "outline" : "secondary"}>
                              {isCompleted ? "Completed" : isOwned ? "Owned" : "New"}
                            </Badge>
                          </div>
                          <CardDescription>{book.description}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-1 text-sm">
                            {book.author ? (
                              <p className="text-muted-foreground">by {book.author}</p>
                            ) : null}
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="outline">{skillLabel}</Badge>
                              <Badge variant="outline">{currencyFormatter.format(book.cost ?? 0)}</Badge>
                              <Badge variant="outline">+{book.xp_reward ?? 0} XP</Badge>
                              {alreadyUnlocked ? (
                                <Badge variant="destructive">Skill already unlocked</Badge>
                              ) : null}
                            </div>
                          </div>
                          <div className="flex flex-col gap-2 sm:flex-row">
                            {isOwned ? (
                              <Button
                                className="sm:flex-1"
                                onClick={() => void handleRead(book)}
                                disabled={isCompleted || pendingReadId === book.id || !profileId}
                                variant={isCompleted ? "secondary" : "default"}
                              >
                                {isCompleted ? (
                                  <>
                                    <Sparkles className="mr-2 h-4 w-4" />
                                    Mastered
                                  </>
                                ) : pendingReadId === book.id ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Unlocking...
                                  </>
                                ) : (
                                  <>
                                    <BookOpen className="mr-2 h-4 w-4" />
                                    Read & Unlock
                                  </>
                                )}
                              </Button>
                            ) : (
                              <Button
                                className="sm:flex-1"
                                onClick={() => void handlePurchase(book)}
                                disabled={pendingPurchaseId === book.id || !profileId}
                              >
                                {pendingPurchaseId === book.id ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Purchasing...
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="mr-2 h-4 w-4" />
                                    Purchase & Learn
                                  </>
                                )}
                              </Button>
                            )}
                            {isCompleted ? (
                              <Button variant="outline" className="sm:w-auto" disabled>
                                Completed
                              </Button>
                            ) : isOwned ? (
                              <Button variant="outline" className="sm:w-auto" disabled>
                                Owned
                              </Button>
                            ) : null}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Books provide a single 10 XP boost the first time you read them. Track your collection in the Inventory Manager.
              </p>
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
              <CardTitle>YouTube Skill Training</CardTitle>
              <CardDescription>
                Pick a skill, watch a curated lesson, and earn XP scaled by your mastery tier and attribute strengths.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {skillsError ? (
                <p className="text-sm text-destructive">
                  Unable to load skill data right now. Refresh the page or try again later.
                </p>
              ) : null}

              {skillsLoading ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-64 animate-pulse rounded-lg border border-dashed bg-muted/40"
                    />
                  ))}
                </div>
              ) : groupedSkills.length > 0 ? (
                groupedSkills.map((group) => (
                  <div key={group.category} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        {group.category}
                      </h3>
                      <Badge variant="outline" className="text-xs">
                        {group.skills.length} skills
                      </Badge>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {group.skills.map((definition) => renderSkillCard(definition))}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No trainable skills are available yet. Unlock skills in your profile to see tailored lessons.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Supplemental Playlists</CardTitle>
              <CardDescription>
                Keep learning between training sessions with curated channels and playlists covering every discipline.
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

