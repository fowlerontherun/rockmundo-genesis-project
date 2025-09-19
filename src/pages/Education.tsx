
import { BookOpen, GraduationCap, PlaySquare, Sparkles, Users } from "lucide-react";
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

const tabItems = [
  {
    value: "books",
    label: "Books",
    icon: BookOpen,
    blurb: "Deep dives, playbooks, and creative inspiration for every stage of your music journey."
  },
  {
    value: "university",
    label: "University",
    icon: GraduationCap,
    blurb: "Accredited pathways and stackable certificates that sync with touring life."

  },
  {
    value: "videos",
    label: "YouTube Videos",
    icon: PlaySquare,
    blurb: "High-impact playlists and channels to keep your technique sharp on demand."

  },
  {
    value: "mentors",
    label: "Mentors",
    icon: Users,
    blurb: "Coaching collectives and expert rosters for personalized feedback loops."

  },
  {
    value: "band",
    label: "Band Learning",
    icon: Sparkles,
    blurb: "Immersive programs that level up your entire crew together."
  }
];

const bookJourneys = [
  {
    title: "Creative Foundations",
    description:
      "Build core musicianship and mindset habits so practice, performance, and writing feel effortless.",
    resources: [
      {
        name: "The Musician's Way",
        author: "Gerald Klickstein",
        focus: "Practice Systems",
        takeaway: "Design repeatable practice rituals that translate directly to confident stage time."
      },
      {
        name: "Effortless Mastery",
        author: "Kenny Werner",
        focus: "Mindset",
        takeaway: "Rewire performance anxiety into calm focus with proven mental exercises."
      },
      {
        name: "Music Theory for Guitarists",
        author: "Tom Kolb",
        focus: "Theory Essentials",
        takeaway: "Bridge fretboard fluency with modern harmony so ideas land faster."
      }
    ]
  },
  {
    title: "Songcraft Lab",
    description:
      "Level up lyricism, arrangement, and production workflows that stand out in a crowded release cycle.",
    resources: [
      {
        name: "Writing Better Lyrics",
        author: "Pat Pattison",
        focus: "Lyric Craft",
        takeaway: "Follow semester-style prompts that sharpen storytelling and emotional arcs."
      },
      {
        name: "Tunesmith",
        author: "Jimmy Webb",
        focus: "Composition",
        takeaway: "Peek inside Grammy-winning processes and adapt them to your band's workflow."
      },
      {
        name: "How to Make It in the New Music Business",
        author: "Ari Herstand",
        focus: "Indie Strategy",
        takeaway: "Turn your releases into campaigns with actionable marketing checklists."
      }
    ]
  },
  {
    title: "Career Architect",
    description:
      "Navigate deals, branding, and financial strategy with resources tailored for modern rock artists.",
    resources: [
      {
        name: "All You Need to Know About the Music Business",
        author: "Donald Passman",
        focus: "Contracts",
        takeaway: "Understand royalties, licensing, and negotiation language before meetings happen."
      },
      {
        name: "Creative Quest",
        author: "Questlove",
        focus: "Creative Leadership",
        takeaway: "Blend artistry and entrepreneurship through stories from a legendary collaborator."
      },
      {
        name: "Company of One",
        author: "Paul Jarvis",
        focus: "Sustainable Growth",
        takeaway: "Build a resilient music business without burning out your team or fan trust."
      }
    ],
    action: {
      label: "Download release checklist",
      href: "https://notion.so"
    }
  }
];


const universityRoutes = [
  {
    title: "Degree Pathways",
    description: "Immersive programs that balance ensemble work, songwriting labs, and career coaching.",
    highlights: [
      {
        program: "BFA in Contemporary Performance",
        school: "Berklee College of Music",
        focus: "Performance Lab",
        details: "Daily ensemble rotations with songwriting bootcamps and showcase nights."
      },
      {
        program: "BA in Music Business",
        school: "Middle Tennessee State University",
        focus: "Industry Leadership",
        details: "Blend legal, marketing, and analytics courses with Nashville internship placements."

      },
      {
        program: "BS in Music Production",
        school: "Full Sail University",
        focus: "Studio Technology",
        details: "Hands-on studio tracking, mixing, and mastering alongside release simulations."
      }
    ],
    action: {
      label: "Download program guide",
      href: "https://www.berklee.edu/majors"
    }
  },
  {
    title: "Micro-Credentials",
    description: "Short sprints that stack with your touring schedule while keeping your skills sharp.",
    highlights: [
      {
        program: "Modern Music Production",
        school: "Coursera x Berklee",
        focus: "12-Week Certificate",
        details: "Project-based DAW mastery with mentor feedback on each mix."
      },
      {
        program: "Music Marketing Accelerator",
        school: "Soundfly",
        focus: "Mentor Guided",
        details: "Launch funnels, fan journeys, and social ads with weekly strategy reviews."
      },
      {
        program: "Live Event Production",
        school: "Point Blank Music School",
        focus: "Hybrid",
        details: "Route tours, advance shows, and manage crews with real-world case studies."
      }
    ],
    action: {
      label: "Browse certificates",
      href: "https://online.berklee.edu/programs"
    }
  },
  {
    title: "Semester Planner",
    description: "Use this repeatable 15-week cadence to balance study, creation, and stage time.",
    highlights: [
      {
        program: "Weeks 1-5",
        school: "Skill Ramp-Up",
        focus: "Technique + Theory",
        details: "Stack practice labs, ear training, and songwriting prompts."
      },
      {
        program: "Weeks 6-10",
        school: "Creative Production",
        focus: "Studio Sprints",
        details: "Batch arrange, record, and collaborate on portfolio-ready tracks."
      },
      {
        program: "Weeks 11-15",
        school: "Career Launch",
        focus: "Showcase",
        details: "Book showcases, refresh your EPK, and meet with advisors for next steps."
      }
    ],
    action: {
      label: "Grab the planner template",
      href: "https://calendar.google.com"
    }
  }
];

const videoCollections = [
  {
    title: "Technique & Theory",
    description: "Channels that deliver weekly drills, breakdowns, and ear training challenges.",
    resources: [
      {
        name: "Rick Beato",
        format: "Deep-dive lessons",
        focus: "Ear Training",
        link: "https://www.youtube.com/user/pegzch",
        summary: "Dissect iconic songs, chord changes, and arrangement secrets in long-form videos."
      },
      {
        name: "Marty Music",
        format: "Guitar tutorials",
        focus: "Technique",
        link: "https://www.youtube.com/c/martyschwartz",
        summary: "Accessible riffs, tone tips, and genre studies that scale with your skill."
      },
      {
        name: "Nahre Sol",
        format: "Creative experiments",
        focus: "Composition",
        link: "https://www.youtube.com/c/nahresol",
        summary: "Blend classical, electronic, and improvisational tools for fresh writing prompts."
      }
    ]
  },
  {
    title: "Structured Playlists",
    description: "Follow guided series that mimic a cohort with homework and check-ins.",
    resources: [
      {
        name: "30-Day Songwriting Bootcamp",
        format: "Playlist",
        focus: "Daily Prompts",
        link: "https://www.youtube.com/playlist?list=PL1A2F2A3",
        summary: "Turn sparks into full demos in a month with incremental challenges."
      },
      {
        name: "Mixing Essentials in Logic Pro",
        format: "Playlist",
        focus: "Home Studio",
        link: "https://www.youtube.com/playlist?list=PL2F3G4H5",
        summary: "Master EQ, compression, and mix bus workflows for indie releases."
      },
      {
        name: "Stage Presence Fundamentals",
        format: "Mini-series",
        focus: "Performance",
        link: "https://www.youtube.com/playlist?list=PL7K8L9M0",
        summary: "Own the stage with crowd engagement tactics and mic control drills."
      }
    ]
  },
  {
    title: "Accountability Formats",
    description: "Keep practice consistent with co-working streams, trackable logs, and improv labs.",
    resources: [
      {
        name: "Practice With Me Streams",
        format: "Co-practice",
        focus: "Routine Building",
        link: "https://www.youtube.com/results?search_query=music+practice+with+me",
        summary: "Join real-time practice rooms that feel like digital rehearsal studios."
      },
      {
        name: "Looped Backing Tracks",
        format: "Play-along",
        focus: "Improvisation",
        link: "https://www.youtube.com/results?search_query=backing+tracks+for+guitar",
        summary: "Expand your improv vocabulary with tempo-based jam sessions."
      },
      {
        name: "Ear Training Drills",
        format: "Interactive",
        focus: "Listening Skills",
        link: "https://www.youtube.com/results?search_query=ear+training+intervals",
        summary: "Speed up interval recognition with call-and-response challenges."
      }

const mentorTracks = [
  {
    title: "Mentorship Pathways",
    description: "Pick the feedback cadence that matches your goals and current release cycle.",
    cohorts: [
      {
        name: "Songwriting Lab",
        focus: "Co-writing Circle",
        cadence: "Bi-weekly",
        support: "Share drafts, iterate hooks, and receive structured lyric feedback."
      },
      {
        name: "Stagecraft Intensive",
        focus: "Performance Coaching",
        cadence: "Monthly",
        support: "Break down live footage with mentors who optimize stage movement."
      },
      {
        name: "Indie Release Accelerator",
        focus: "Launch Strategy",
        cadence: "Weekly",
        support: "Plan release calendars, promo funnels, and milestone reviews."
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
    action: {
      label: "Apply for mentorship",
      href: "https://forms.gle/mentor-application"
    }
  },
  {
    title: "Expert Network",
    description: "One-off consultations or retained advisors for specialized projects.",
    cohorts: [
      {
        name: "Creative Director",
        focus: "Visual Branding",
        cadence: "On-demand",
        support: "Craft album art, stage visuals, and social storytelling guidelines."
      },
      {
        name: "Music Attorney",
        focus: "Contract Review",
        cadence: "Retainer",
        support: "Secure licensing, negotiate deals, and protect intellectual property."
      },
      {
        name: "Tour Manager",
        focus: "Live Logistics",
        cadence: "Consulting",
        support: "Optimize routing, budgets, and crew coordination for upcoming runs."
      }
    ],
    action: {
      label: "Browse mentor roster",
      href: "https://rockmundo.com/mentors"
    }
  },
  {
    title: "Accountability Systems",
    description: "Keep momentum high with weekly standups, progress dashboards, and seasonal audits.",
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
        support: "Log practice stats, gig learnings, and mindset notes."
      },
      {
        name: "Quarterly Audits",
        focus: "Career Review",
        cadence: "Seasonal",
        support: "Refresh KPIs, celebrate milestones, and adjust your roadmap."
      }
    ],
    action: {
      label: "Download templates",
      href: "https://notion.so"
    }

const bandLearningTracks = [
  {
    title: "Weekend Intensives",
    description: "Design a three-day sprint that tightens chemistry and produces releasable assets.",
    sessions: [
      {
        name: "Day 1: Groove Lab",
        focus: "Rhythmic Alignment",
        deliverable: "Record a live rehearsal take with crowd cues."
      },
      {
        name: "Day 2: Story & Stage",
        focus: "Brand Alignment",
        deliverable: "Craft a unified band bio, stage plot, and visual style."
      },
      {
        name: "Day 3: Release Sprint",
        focus: "Content Production",
        deliverable: "Capture video + photo assets for your next release cycle."
      }
    ],
    action: {
      label: "Download weekend agenda",
      href: "https://docs.google.com"
    }
  },
  {
    title: "Monthly Focus Cycle",
    description: "Rotate priorities so every member develops together without losing momentum.",
    sessions: [
      {
        name: "Month 1: Arrangement Lab",
        focus: "Setlist Evolution",
        deliverable: "New transitions, medleys, and crowd participation moments."
      },
      {
        name: "Month 2: Business HQ",
        focus: "Operations",
        deliverable: "Shared budget tracker, merch inventory, and task board."
      },
      {
        name: "Month 3: Audience Engine",
        focus: "Growth Experiments",
        deliverable: "Fan challenges, email collection, and paid promotion pilots."
      }
    ],
    action: {
      label: "View full curriculum",
      href: "https://rockmundo.com/band-learning"
    }
  },
  {
    title: "Performance Feedback Loop",
    description: "Capture data from every show to iterate faster as a unit.",
    sessions: [
      {
        name: "Soundcheck Surveys",
        focus: "Crew Feedback",
        deliverable: "Document mix notes, monitor requests, and stage adjustments."
      },
      {
        name: "Post-Show Retro",
        focus: "Team Debrief",
        deliverable: "Score energy, crowd engagement, and set pacing within 24 hours."
      },
      {
        name: "Fan Pulse",
        focus: "Audience Signals",
        deliverable: "Collect QR-based feedback and merge it into your fan CRM."
      }
    ],
    action: {
      label: "Set up reporting sheet",
      href: "https://notion.so/templates"
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
    <div className="space-y-10 px-4 pb-16 pt-8 md:px-8 lg:px-16">
      <div className="text-center">
        <Badge variant="secondary" className="mb-3">Learning Engine</Badge>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Education</h1>
        <p className="mx-auto mt-3 max-w-3xl text-base text-muted-foreground sm:text-lg">
          Craft a learning roadmap that keeps your artistry, business savvy, and band cohesion in sync. Dive into
          curated resources, structured programs, and real mentors tailored for the Rockmundo universe.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button asChild>
            <a href="https://rockmundo.com/education" target="_blank" rel="noreferrer">
              Start a learning sprint
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href="https://notion.so" target="_blank" rel="noreferrer">
              Download study planner
            </a>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="books" className="space-y-6">
        <TabsList className="grid w-full gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {tabItems.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger key={tab.value} value={tab.value} className="flex flex-col gap-1 py-3">
                <span className="flex items-center justify-center gap-2 text-sm font-semibold">
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </span>
                <span className="hidden text-xs text-muted-foreground lg:block">{tab.blurb}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="books" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Curated Reading Journeys</CardTitle>
              <CardDescription>
                Progress from foundational chops to advanced career strategy with books we keep in every Rockmundo locker.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {bookJourneys.map((journey) => (
                <Card key={journey.title} className="border-dashed">
                  <CardHeader className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <CardTitle className="text-lg">{journey.title}</CardTitle>
                      <Badge variant="secondary" className="text-xs">
                        {journey.resources.length} picks
                      </Badge>
                    </div>
                    <CardDescription>{journey.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {journey.resources.map((resource) => (
                      <div key={resource.name} className="rounded-lg border bg-muted/40 p-4 text-left">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">{resource.name}</p>
                            <p className="text-xs text-muted-foreground">{resource.author}</p>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {resource.focus}
                          </Badge>
                        </div>
                        <p className="mt-3 text-xs text-muted-foreground">{resource.takeaway}</p>
                      </div>
                    ))}
                    {journey.action ? (
                      <Button asChild variant="secondary" className="w-full">
                        <a href={journey.action.href} target="_blank" rel="noreferrer">
                          {journey.action.label}
                        </a>
                      </Button>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
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
                Blend formal study with real-world shows, mentorship, and portfolio milestones.
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
                        <div key={highlight.name} className="rounded-lg border bg-muted/40 p-4">
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
              <CardTitle>Streamable Curriculum</CardTitle>
              <CardDescription>
                Save these playlists and channels so every practice session has guidance and accountability.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {videoCollections.map((collection) => (
                <Card key={collection.title} className="border-dashed">
                  <CardHeader className="space-y-2">
                    <CardTitle className="text-lg">{collection.title}</CardTitle>
                    <CardDescription>{collection.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {collection.resources.map((resource) => (
                      <div key={resource.name} className="space-y-3 rounded-lg border bg-muted/40 p-4">
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

        <TabsContent value="mentors">
          <Card>
            <CardHeader>
              <CardTitle>Mentor Pods</CardTitle>
              <CardDescription>
                Surround your project with experts who provide clarity, accountability, and momentum.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {mentorTracks.map((track) => (
                <Card key={track.title} className="border-dashed">
                  <CardHeader className="space-y-2">
                    <CardTitle className="text-lg">{track.title}</CardTitle>
                    <CardDescription>{track.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      {track.cohorts.map((cohort) => (
                        <div key={cohort.name} className="rounded-lg border bg-muted/40 p-4">
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

        <TabsContent value="band">
          <Card>
            <CardHeader>
              <CardTitle>Band Learning Circles</CardTitle>
              <CardDescription>
                Keep the whole crew aligned with intensives, monthly focus cycles, and data-informed retros.
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
                      <div key={session.name} className="rounded-lg border bg-muted/40 p-4">
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
}

