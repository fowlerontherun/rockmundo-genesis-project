import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, GraduationCap, Loader2, PlaySquare, Users, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    description: "Build a foundational library for musicianship, songwriting, and career growth."
  },
  {
    value: "university",
    label: "University",
    icon: GraduationCap,
    description: "Map out formal education paths and micro-credentials that align with your goals."
  },
  {
    value: "videos",
    label: "YouTube Videos",
    icon: PlaySquare,
    description: "Curated playlists and channels that deliver high-impact lessons on demand."
  },
  {
    value: "mentors",
    label: "Mentors",
    icon: Users,
    description: "Connect with experts for personalized feedback, coaching, and accountability."
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

const universityTracks = [
  {
    title: "Degree Pathways",
    description:
      "Explore accredited programs that combine performance, technology, and music business training.",
    highlights: [
      {
        name: "BFA in Contemporary Performance",
        school: "Berklee College of Music",
        focus: "Performance Major",
        details: "Focus on live performance labs, ensemble work, and songwriting collaborations."
      },
      {
        name: "BA in Music Business",
        school: "Middle Tennessee State University",
        focus: "Industry Leadership",
        details: "Blend legal, marketing, and management courses with internship placements in Nashville."
      },
      {
        name: "BS in Music Production",
        school: "Full Sail University",
        focus: "Studio Technology",
        details: "Hands-on studio time with DAW mastery, audio engineering, and mixing for release."
      }
    ],
    action: {
      label: "Download Program Guide",
      href: "https://www.berklee.edu/majors"
    }
  },
  {
    title: "Micro-Credentials & Certificates",
    description:
      "Stack short-form credentials to sharpen niche skills while staying active in the scene.",
    highlights: [
      {
        name: "Modern Music Production",
        school: "Coursera x Berklee",
        focus: "12-Week Certificate",
        details: "Project-based program covering beat design, mixing, and mastering workflows."
      },
      {
        name: "Music Marketing Accelerator",
        school: "Soundfly",
        focus: "Mentor-Guided",
        details: "Learn digital strategy, branding, and fan funnels with 1:1 mentor feedback."
      },
      {
        name: "Live Event Production",
        school: "Point Blank Music School",
        focus: "Hybrid",
        details: "Develop stage management and tour logistics skills with live practicum opportunities."
      }
    ],
    action: {
      label: "Browse Certificates",
      href: "https://online.berklee.edu/programs"
    }
  },
  {
    title: "Semester Planner",
    description:
      "Balance academic study with band commitments using this repeatable 15-week structure.",
    highlights: [
      {
        name: "Weeks 1-5",
        school: "Skill Ramp-Up",
        focus: "Technique & Theory",
        details: "Double down on practice labs and music theory intensives while scheduling songwriting sprints."
      },
      {
        name: "Weeks 6-10",
        school: "Creative Production",
        focus: "Studio & Writing",
        details: "Shift toward arranging, collaboration projects, and recording sessions for portfolio tracks."
      },
      {
        name: "Weeks 11-15",
        school: "Career Launch",
        focus: "Showcase & Networking",
        details: "Secure live showcases, meet with advisors, and prepare EPK updates ahead of finals."
      }
    ],
    action: {
      label: "Download Planner",
      href: "https://calendar.google.com"
    }
  }
];

const videoPlaylists = [
  {
    title: "Technique & Theory Channels",
    description:
      "Weekly uploads from trusted educators to keep your chops sharp and your theory knowledge fresh.",
    resources: [
      {
        name: "Rick Beato",
        format: "Deep-Dive Lessons",
        focus: "Ear Training & Analysis",
        link: "https://www.youtube.com/user/pegzch",
        summary: "Break down legendary songs, chord progressions, and arrangement secrets in long-form videos."
      },
      {
        name: "Marty Music",
        format: "Guitar Tutorials",
        focus: "Technique",
        link: "https://www.youtube.com/c/martyschwartz",
        summary: "Accessible guitar lessons covering riffs, tone tips, and style-specific workouts."
      },
      {
        name: "Nahre Sol",
        format: "Creative Exercises",
        focus: "Composition",
        link: "https://www.youtube.com/c/nahresol",
        summary: "Hybrid classical & electronic explorations for players who love experimentation."
      }
    ]
  },
  {
    title: "Structured Playlists",
    description:
      "Follow curated playlists that simulate guided courses complete with homework prompts.",
    resources: [
      {
        name: "30-Day Songwriting Bootcamp",
        format: "Playlist",
        focus: "Daily Prompts",
        link: "https://www.youtube.com/playlist?list=PL1A2F2A3",
        summary: "Short daily assignments that move from lyric sketches to full demos in a month."
      },
      {
        name: "Mixing Essentials in Logic Pro",
        format: "Playlist",
        focus: "Home Studio",
        link: "https://www.youtube.com/playlist?list=PL2F3G4H5",
        summary: "Step-by-step walkthroughs on EQ, compression, and mix bus processing for indie releases."
      },
      {
        name: "Stage Presence Fundamentals",
        format: "Mini-Series",
        focus: "Performance",
        link: "https://www.youtube.com/playlist?list=PL7K8L9M0",
        summary: "Learn crowd engagement, mic control, and dynamic movement in live settings."
      }
    ]
  },
  {
    title: "Practice Accountability",
    description:
      "Use these formats to keep consistent practice logs and track incremental progress.",
    resources: [
      {
        name: "Practice With Me Streams",
        format: "Co-Practice",
        focus: "Routine Building",
        link: "https://www.youtube.com/results?search_query=music+practice+with+me",
        summary: "Join real-time practice rooms that mimic study halls for musicians working on technique."
      },
      {
        name: "Looped Backing Tracks",
        format: "Play-Along",
        focus: "Improvisation",
        link: "https://www.youtube.com/results?search_query=backing+tracks+for+guitar",
        summary: "Select tempo-specific jam tracks to develop improvisation vocabulary and stage endurance."
      },
      {
        name: "Ear Training Drills",
        format: "Interactive",
        focus: "Listening Skills",
        link: "https://www.youtube.com/results?search_query=ear+training+intervals",
        summary: "Build interval recognition speed with call-and-response exercises and on-screen quizzes."
      }
    ]
  }
];

const mentorPrograms = [
  {
    title: "Mentorship Tracks",
    description:
      "Choose a pathway that matches your current career phase and desired feedback style.",
    cohorts: [
      {
        name: "Songwriting Lab",
        focus: "Co-Writing Circle",
        cadence: "Bi-weekly",
        support: "Collaborative feedback on drafts, melody rewrites, and lyric polish." 
      },
      {
        name: "Stagecraft Intensive",
        focus: "Performance Coaching",
        cadence: "Monthly",
        support: "Virtual showcase critiques with movement and mic technique guidance."
      },
      {
        name: "Indie Release Accelerator",
        focus: "Launch Strategy",
        cadence: "Weekly",
        support: "Release calendar planning, marketing funnels, and analytics reviews."
      }
    ],
    action: {
      label: "Apply for Mentorship",
      href: "https://forms.gle/mentor-application"
    }
  },
  {
    title: "Expert Network",
    description:
      "Tap into a curated roster of industry veterans for one-off consultations or recurring coaching.",
    cohorts: [
      {
        name: "Creative Director",
        focus: "Visual Branding",
        cadence: "On-Demand",
        support: "Refine album art, stage visuals, and social media style guides."
      },
      {
        name: "Music Attorney",
        focus: "Contract Review",
        cadence: "Retainer",
        support: "Protect intellectual property, negotiate deals, and review licensing opportunities."
      },
      {
        name: "Tour Manager",
        focus: "Live Logistics",
        cadence: "Consulting",
        support: "Route tours, manage advancing, and streamline crew coordination."
      }
    ],
    action: {
      label: "Browse Mentor Roster",
      href: "https://rockmundo.com/mentors"
    }
  },
  {
    title: "Accountability Systems",
    description:
      "Stay consistent with structured check-ins, progress dashboards, and peer support.",
    cohorts: [
      {
        name: "Weekly Standups",
        focus: "Goal Tracking",
        cadence: "15 min",
        support: "Share wins, blockers, and next actions with your mentor pod."
      },
      {
        name: "Progress Journals",
        focus: "Reflection",
        cadence: "Daily",
        support: "Log practice stats, gig insights, and mindset notes inside Rockmundo."
      },
      {
        name: "Quarterly Audits",
        focus: "Career Review",
        cadence: "Seasonal",
        support: "Assess KPIs, adjust roadmaps, and celebrate milestones with your coach."
      }
    ],
    action: {
      label: "Download Templates",
      href: "https://notion.so"
    }
  }
];

const bandLearningTracks = [
  {
    title: "Band Intensives",
    description:
      "Plan immersive weekends that combine rehearsal, songwriting, and branding workshops.",
    sessions: [
      {
        name: "Day 1: Groove Lab",
        focus: "Tighten Rhythmic Chemistry",
        deliverable: "Record a live rehearsal take with click + crowd cues."
      },
      {
        name: "Day 2: Story & Stage",
        focus: "Brand Alignment",
        deliverable: "Craft a unified band bio, stage plot, and social hook."
      },
      {
        name: "Day 3: Release Sprint",
        focus: "Content Production",
        deliverable: "Capture video + photo assets for upcoming release cycle."
      }
    ],
    action: {
      label: "Download Weekend Agenda",
      href: "https://docs.google.com"
    }
  },
  {
    title: "Ongoing Band Curriculum",
    description:
      "Rotate focus areas each month to keep the whole group evolving in sync.",
    sessions: [
      {
        name: "Month 1: Arrangement Lab",
        focus: "Reimagine Setlist",
        deliverable: "New live transitions, medleys, and crowd participation cues."
      },
      {
        name: "Month 2: Business HQ",
        focus: "Operational Systems",
        deliverable: "Shared budget tracker, merch inventory log, and task board."
      },
      {
        name: "Month 3: Audience Engine",
        focus: "Growth Experiments",
        deliverable: "Launch fan challenges, collect emails, and test paid promotion."
      }
    ],
    action: {
      label: "View Curriculum",
      href: "https://rockmundo.com/band-learning"
    }
  },
  {
    title: "Performance Feedback Loops",
    description:
      "Capture data from every show to iterate faster as a unit.",
    sessions: [
      {
        name: "Show Debrief",
        focus: "Immediate Reflection",
        deliverable: "Rate crowd energy, set pacing, and technical stability within 24 hours."
      },
      {
        name: "Fan Pulse",
        focus: "Community Insights",
        deliverable: "Survey attendees, review social mentions, and note merch conversion."
      },
      {
        name: "Iterate & Implement",
        focus: "Action Plan",
        deliverable: "Assign next-step experiments for setlist, visuals, and engagement."
      }
    ],
    action: {
      label: "Create Feedback Form",
      href: "https://forms.gle/band-feedback"
    }
  }
];

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
    <div className="space-y-8 pb-16">
      <div className="space-y-3 text-center">
        <Badge variant="outline" className="mx-auto w-fit px-4 py-1 text-sm font-semibold">
          Education Hub
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Level Up Your Musical Journey</h1>
        <p className="mx-auto max-w-3xl text-base text-muted-foreground sm:text-lg">
          Discover the best resources for self-paced learning, formal education, and collaborative growth. Pick a
          pathway, follow the curated plan, and keep your skills—and your band—constantly evolving.
        </p>
      </div>

      <Tabs defaultValue="books" className="space-y-6">
        <TabsList className="grid w-full gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger key={tab.value} value={tab.value} className="flex flex-col gap-1 py-3">
                <span className="flex items-center justify-center gap-2 text-sm font-semibold">
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </span>
                <span className="hidden text-xs font-normal text-muted-foreground lg:block">{tab.description}</span>
              </TabsTrigger>
            );
          })}
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
          <Card>
            <CardHeader>
              <CardTitle>Academic Pathways</CardTitle>
              <CardDescription>
                Blend formal study with real-world experience using programs designed for modern performers.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 lg:grid-cols-3">
              {universityTracks.map((track) => (
                <Card key={track.title} className="border-dashed">
                  <CardHeader className="space-y-2">
                    <CardTitle className="text-lg">{track.title}</CardTitle>
                    <CardDescription>{track.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      {track.highlights.map((highlight) => (
                        <div key={highlight.name} className="rounded-lg border bg-muted/30 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold">{highlight.name}</p>
                              <p className="text-xs text-muted-foreground">{highlight.school}</p>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {highlight.focus}
                            </Badge>
                          </div>
                          <p className="mt-3 text-xs text-muted-foreground">{highlight.details}</p>
                        </div>
                      ))}
                    </div>
                    {track.action ? (
                      <Button asChild variant="secondary" className="w-full">
                        <a href={track.action.href} target="_blank" rel="noreferrer">
                          {track.action.label}
                        </a>
                      </Button>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="videos" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Stream Your Lessons</CardTitle>
              <CardDescription>
                Mix binge-worthy channels with structured playlists so every practice session has purpose.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {videoPlaylists.map((playlist) => (
                <Card key={playlist.title} className="border-dashed">
                  <CardHeader className="space-y-2">
                    <CardTitle className="text-lg">{playlist.title}</CardTitle>
                    <CardDescription>{playlist.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {playlist.resources.map((resource) => (
                      <div key={resource.name} className="space-y-3 rounded-lg border bg-muted/30 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">{resource.name}</p>
                            <p className="text-xs text-muted-foreground">{resource.format}</p>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {resource.focus}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{resource.summary}</p>
                        <Button asChild variant="link" className="h-auto px-0 text-xs font-semibold">
                          <a href={resource.link} target="_blank" rel="noreferrer">
                            Watch now
                          </a>
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mentors" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Guided Mentorship</CardTitle>
              <CardDescription>
                Partner with mentors who accelerate your growth with actionable feedback and steady accountability.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {mentorPrograms.map((program) => (
                <Card key={program.title} className="border-dashed">
                  <CardHeader className="space-y-2">
                    <CardTitle className="text-lg">{program.title}</CardTitle>
                    <CardDescription>{program.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      {program.cohorts.map((cohort) => (
                        <div key={cohort.name} className="rounded-lg border bg-muted/30 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold">{cohort.name}</p>
                              <p className="text-xs text-muted-foreground">{cohort.focus}</p>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {cohort.cadence}
                            </Badge>
                          </div>
                          <p className="mt-3 text-xs text-muted-foreground">{cohort.support}</p>
                        </div>
                      ))}
                    </div>
                    {program.action ? (
                      <Button asChild variant="secondary" className="w-full">
                        <a href={program.action.href} target="_blank" rel="noreferrer">
                          {program.action.label}
                        </a>
                      </Button>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="band" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Band Learning Lab</CardTitle>
              <CardDescription>
                Align your entire crew with immersive intensives, monthly focus cycles, and actionable feedback loops.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {bandLearningTracks.map((track) => (
                <Card key={track.title} className="border-dashed">
                  <CardHeader className="space-y-2">
                    <CardTitle className="text-lg">{track.title}</CardTitle>
                    <CardDescription>{track.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {track.sessions.map((session) => (
                      <div key={session.name} className="rounded-lg border bg-muted/30 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">{session.name}</p>
                            <p className="text-xs text-muted-foreground">{session.focus}</p>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {session.deliverable}
                          </Badge>
                        </div>
                      </div>
                    ))}
                    {track.action ? (
                      <Button asChild variant="secondary" className="w-full">
                        <a href={track.action.href} target="_blank" rel="noreferrer">
                          {track.action.label}
                        </a>
                      </Button>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Education;
