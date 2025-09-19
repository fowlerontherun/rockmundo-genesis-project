import { BookOpen, GraduationCap, PlaySquare, Sparkles, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

const universityTracks = [
  {
    title: "Degree Pathways",
    description: "Immersive programs that balance ensemble work, songwriting labs, and career coaching.",
    highlights: [
      {
        name: "BFA in Contemporary Performance",
        school: "Berklee College of Music",
        focus: "Performance Lab",
        details: "Daily ensemble rotations with songwriting bootcamps and showcase nights."
      },
      {
        name: "BA in Music Business",
        school: "Middle Tennessee State University",
        focus: "Industry Leadership",
        details: "Blend legal, marketing, and analytics courses with Nashville internship placements."
      },
      {
        name: "BS in Music Production",
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
        name: "Modern Music Production",
        school: "Coursera x Berklee",
        focus: "12-Week Certificate",
        details: "Project-based DAW mastery with mentor feedback on each mix."
      },
      {
        name: "Music Marketing Accelerator",
        school: "Soundfly",
        focus: "Mentor Guided",
        details: "Launch funnels, fan journeys, and social ads with weekly strategy reviews."
      },
      {
        name: "Live Event Production",
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
        name: "Weeks 1-5",
        school: "Skill Ramp-Up",
        focus: "Technique + Theory",
        details: "Stack practice labs, ear training, and songwriting prompts."
      },
      {
        name: "Weeks 6-10",
        school: "Creative Production",
        focus: "Studio Sprints",
        details: "Batch arrange, record, and collaborate on portfolio-ready tracks."
      },
      {
        name: "Weeks 11-15",
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
    ]
  }
];

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
  }
];

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
  }
];

const Education = () => {
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
          <Card>
            <CardHeader>
              <CardTitle>Academic Pathways</CardTitle>
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

        <TabsContent value="mentors" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Guided Mentorship</CardTitle>
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

        <TabsContent value="band" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Band Learning Lab</CardTitle>
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
};

export default Education;
