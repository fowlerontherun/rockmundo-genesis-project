import { BookOpen, GraduationCap, PlaySquare, Sparkles, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const tabs = [
  {
    value: "books",
    label: "Books",
    icon: BookOpen,
    description: "Curated reading lists for every stage of your journey."
  },
  {
    value: "university",
    label: "University",
    icon: GraduationCap,
    description: "Formal programs, certificates, and semester planners."
  },
  {
    value: "videos",
    label: "YouTube Videos",
    icon: PlaySquare,
    description: "High-impact playlists and channels ready to stream."
  },
  {
    value: "mentors",
    label: "Mentors",
    icon: Users,
    description: "Personalized coaching pods and expert office hours."
  },
  {
    value: "band",
    label: "Band Learning",
    icon: Sparkles,
    description: "Level up together with intensives and rotating focus cycles."
  }
];

const bookTracks = [
  {
    title: "Build the Fundamentals",
    description:
      "Lay a strong musical foundation with resources that strengthen theory, rhythm, and listening skills.",
    books: [
      {
        title: "The Musician's Way",
        author: "Gerald Klickstein",
        focus: "Technique & Habits",
        takeaway: "Daily practice frameworks for staying injury-free and motivated."
      },
      {
        title: "Music Theory for Guitarists",
        author: "Tom Kolb",
        focus: "Applied Theory",
        takeaway: "Translate theory concepts directly to the fretboard with modern drills."
      },
      {
        title: "Effortless Mastery",
        author: "Kenny Werner",
        focus: "Mindset",
        takeaway: "Unlock confident performances by rewiring how you approach the stage."
      }
    ]
  },
  {
    title: "Write & Produce",
    description:
      "Move from inspiration to finished songs with books that demystify lyric writing, arranging, and production.",
    books: [
      {
        title: "Writing Better Lyrics",
        author: "Pat Pattison",
        focus: "Story Craft",
        takeaway: "Semester-style assignments that transform loose ideas into lyrical hooks."
      },
      {
        title: "Tunesmith",
        author: "Jimmy Webb",
        focus: "Composition",
        takeaway: "Behind-the-scenes lessons from a Grammy-winning songwriter."
      },
      {
        title: "Mixing Secrets for the Small Studio",
        author: "Mike Senior",
        focus: "Production",
        takeaway: "Break down pro-level mixes using accessible home-studio workflows."
      }
    ]
  },
  {
    title: "Grow the Business",
    description:
      "Navigate the modern music economy with resources that cover branding, release strategy, and finances.",
    books: [
      {
        title: "How to Make It in the New Music Business",
        author: "Ari Herstand",
        focus: "Indie Strategy",
        takeaway: "Plan sustainable releases, tours, and fan funnels without a major label."
      },
      {
        title: "All You Need to Know About the Music Business",
        author: "Donald Passman",
        focus: "Legal & Deals",
        takeaway: "Understand royalties, contracts, and negotiations before you sign anything."
      },
      {
        title: "Creative Quest",
        author: "Questlove",
        focus: "Creative Leadership",
        takeaway: "Blend artistry, collaboration, and entrepreneurship through real-world stories."
      }
    ]
  }
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
        detail: "Ensemble collaborations, songwriting bootcamps, and touring simulations."
      },
      {
        program: "BA in Music Business",
        school: "Middle Tennessee State University",
        format: "4-year",
        detail: "Blend marketing, law, and management courses with internship placements."
      },
      {
        program: "BS in Music Production",
        school: "Full Sail University",
        format: "Accelerated",
        detail: "Hands-on DAW labs, engineering practicums, and release-ready projects."
      }
    ],
    action: {
      label: "Download Program Guide",
      href: "https://www.berklee.edu/majors"
    }
  },
  {
    title: "Certificates & Bootcamps",
    description: "Stack micro-credentials that keep you road-ready while you tour.",
    highlights: [
      {
        program: "Modern Music Production",
        school: "Coursera x Berklee",
        format: "12-week",
        detail: "Project-based course with mentor feedback on mixes and arrangements."
      },
      {
        program: "Music Marketing Accelerator",
        school: "Soundfly",
        format: "Mentor-Led",
        detail: "Design fan funnels, campaigns, and EPK updates with weekly coaching."
      },
      {
        program: "Live Event Production",
        school: "Point Blank Music School",
        format: "Hybrid",
        detail: "Stage management, advancing, and crew coordination drills."
      }
    ],
    action: {
      label: "Browse Certificates",
      href: "https://online.berklee.edu/programs"
    }
  },
  {
    title: "Semester Planner",
    description: "Balance credit loads with rehearsal, writing, and release cadences.",
    highlights: [
      {
        program: "Weeks 1-5",
        school: "Skill Ramp-Up",
        format: "Technique",
        detail: "Lock in practice labs, theory refreshers, and sectionals."
      },
      {
        program: "Weeks 6-10",
        school: "Creative Production",
        format: "Studio",
        detail: "Cut demos, arrange collabs, and prep for showcase submissions."
      },
      {
        program: "Weeks 11-15",
        school: "Career Launch",
        format: "Industry",
        detail: "Secure gigs, polish your EPK, and rehearse live sets for juries."
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
    title: "Technique Channels",
    description: "Consistent uploads that sharpen chops and keep practice fun.",
    videos: [
      {
        name: "Rick Beato",
        format: "Deep Dive Lessons",
        focus: "Ear Training",
        url: "https://www.youtube.com/user/pegzch"
      },
      {
        name: "Marty Music",
        format: "Guitar Tutorials",
        focus: "Technique",
        url: "https://www.youtube.com/c/martyschwartz"
      },
      {
        name: "Nahre Sol",
        format: "Creative Exercises",
        focus: "Composition",
        url: "https://www.youtube.com/c/nahresol"
      }
    ]
  },
  {
    title: "Guided Playlists",
    description: "Structured series that function like mini-courses with homework.",
    videos: [
      {
        name: "30-Day Songwriting Bootcamp",
        format: "Playlist",
        focus: "Daily Prompts",
        url: "https://www.youtube.com/playlist?list=PL1A2F2A3"
      },
      {
        name: "Mixing Essentials in Logic Pro",
        format: "Playlist",
        focus: "Home Studio",
        url: "https://www.youtube.com/playlist?list=PL2F3G4H5"
      },
      {
        name: "Stage Presence Fundamentals",
        format: "Mini-Series",
        focus: "Performance",
        url: "https://www.youtube.com/playlist?list=PL7K8L9M0"
      }
    ]
  },
  {
    title: "Accountability Formats",
    description: "Join co-practice rooms and track incremental wins together.",
    videos: [
      {
        name: "Practice With Me Streams",
        format: "Live Streams",
        focus: "Routine",
        url: "https://www.youtube.com/results?search_query=music+practice+with+me"
      },
      {
        name: "Looped Backing Tracks",
        format: "Play-Along",
        focus: "Improvisation",
        url: "https://www.youtube.com/results?search_query=backing+tracks+for+guitar"
      },
      {
        name: "Ear Training Drills",
        format: "Interactive",
        focus: "Listening Skills",
        url: "https://www.youtube.com/results?search_query=ear+training+intervals"
      }
    ]
  }
];

const mentorPrograms = [
  {
    title: "Mentorship Pods",
    description: "Small cohorts that deliver consistent feedback and accountability.",
    cohorts: [
      {
        name: "Songwriting Lab",
        cadence: "Bi-weekly",
        focus: "Co-writing & lyric review"
      },
      {
        name: "Stagecraft Intensive",
        cadence: "Monthly",
        focus: "Movement, mic technique, and live critique"
      },
      {
        name: "Indie Release Accelerator",
        cadence: "Weekly",
        focus: "Launch roadmaps, marketing funnels, and analytics"
      }
    ],
    action: {
      label: "Apply for Mentorship",
      href: "https://forms.gle/mentor-application"
    }
  },
  {
    title: "Expert Network",
    description: "Tap specialists for focused office hours or project-based consults.",
    cohorts: [
      {
        name: "Creative Director",
        cadence: "On-Demand",
        focus: "Visual branding & storytelling"
      },
      {
        name: "Music Attorney",
        cadence: "Retainer",
        focus: "Contract review and negotiation"
      },
      {
        name: "Tour Manager",
        cadence: "Consulting",
        focus: "Routing, advancing, and crew coordination"
      }
    ],
    action: {
      label: "Browse Mentor Roster",
      href: "https://rockmundo.com/mentors"
    }
  },
  {
    title: "Accountability Systems",
    description: "Keep momentum with daily logs, progress dashboards, and quarterly audits.",
    cohorts: [
      {
        name: "Weekly Standups",
        cadence: "15 min",
        focus: "Goal tracking & blockers"
      },
      {
        name: "Progress Journals",
        cadence: "Daily",
        focus: "Practice stats and mindset notes"
      },
      {
        name: "Quarterly Audits",
        cadence: "Seasonal",
        focus: "KPI reviews and roadmap resets"
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
    title: "Immersive Weekends",
    description: "Three-day intensives that tighten the band on and off the stage.",
    sessions: [
      {
        name: "Day 1: Groove Lab",
        focus: "Lock rhythmic chemistry",
        deliverable: "Record a tight rehearsal take"
      },
      {
        name: "Day 2: Story & Stage",
        focus: "Align brand and visuals",
        deliverable: "Produce a stage plot and visual mood board"
      },
      {
        name: "Day 3: Release Sprint",
        focus: "Content production",
        deliverable: "Capture photos and live clips for rollout"
      }
    ],
    action: {
      label: "Download Agenda",
      href: "https://docs.google.com"
    }
  },
  {
    title: "Monthly Focus Cycles",
    description: "Rotate priorities to keep growth steady across the whole band.",
    sessions: [
      {
        name: "Month 1: Arrangement Lab",
        focus: "Reimagine the set",
        deliverable: "Design new transitions and medleys"
      },
      {
        name: "Month 2: Business HQ",
        focus: "Operations",
        deliverable: "Shared budget tracker and merch plan"
      },
      {
        name: "Month 3: Audience Engine",
        focus: "Fan growth",
        deliverable: "Launch challenges and capture emails"
      }
    ],
    action: {
      label: "View Curriculum",
      href: "https://rockmundo.com/band-learning"
    }
  },
  {
    title: "Performance Feedback Loops",
    description: "Treat every show like a learning sprint with structured debriefs.",
    sessions: [
      {
        name: "Show Debrief",
        focus: "Immediate reflection",
        deliverable: "Rate energy, pacing, and tech notes"
      },
      {
        name: "Fan Pulse",
        focus: "Community insights",
        deliverable: "Survey attendees and review mentions"
      },
      {
        name: "Iterate & Implement",
        focus: "Action plan",
        deliverable: "Assign experiments for next gig"
      }
    ],
    action: {
      label: "Create Feedback Form",
      href: "https://forms.gle/band-feedback"
    }
  }
];

const Education = () => {
  return (
    <div className="space-y-10 pb-16">
      <header className="space-y-3 text-center">
        <Badge variant="outline" className="mx-auto w-fit px-4 py-1 text-sm font-semibold">
          Education Hub
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Level Up Your Musical Journey</h1>
        <p className="mx-auto max-w-3xl text-base text-muted-foreground sm:text-lg">
          Tap into curated learning paths—from foundational study to collaborative band growth—to keep your skills
          sharp and your career momentum steady.
        </p>
      </header>

      <Tabs defaultValue="books" className="space-y-8">
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
              <CardTitle>Curated Reading Tracks</CardTitle>
              <CardDescription>
                Move through themed reading sprints to balance skill-building, creativity, and business know-how.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {bookTracks.map((track) => (
                <Card key={track.title} className="border-dashed">
                  <CardHeader className="space-y-2">
                    <CardTitle className="text-lg">{track.title}</CardTitle>
                    <CardDescription>{track.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {track.books.map((book) => (
                      <div key={book.title} className="rounded-lg border bg-muted/30 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">{book.title}</p>
                            <p className="text-xs text-muted-foreground">{book.author}</p>
                          </div>
                          <Badge variant="outline" className="whitespace-nowrap text-xs">
                            {book.focus}
                          </Badge>
                        </div>
                        <p className="mt-3 text-xs text-muted-foreground">{book.takeaway}</p>
                      </div>
                    ))}
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
                Blend formal study with real-world practice using degree programs, certificates, and planners built for
                working musicians.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 lg:grid-cols-3">
              {universityRoutes.map((route) => (
                <Card key={route.title} className="border-dashed">
                  <CardHeader className="space-y-2">
                    <CardTitle className="text-lg">{route.title}</CardTitle>
                    <CardDescription>{route.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      {route.highlights.map((highlight) => (
                        <div key={`${highlight.program}-${highlight.school}`} className="rounded-lg border bg-muted/30 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold">{highlight.program}</p>
                              <p className="text-xs text-muted-foreground">{highlight.school}</p>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {highlight.format}
                            </Badge>
                          </div>
                          <p className="mt-3 text-xs text-muted-foreground">{highlight.detail}</p>
                        </div>
                      ))}
                    </div>
                    {route.action ? (
                      <Button asChild variant="secondary" className="w-full">
                        <a href={route.action.href} target="_blank" rel="noreferrer">
                          {route.action.label}
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
                Mix quick wins with deep dives using playlists that pair perfectly with practice sessions.
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
                    {playlist.videos.map((video) => (
                      <div key={video.name} className="space-y-3 rounded-lg border bg-muted/30 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">{video.name}</p>
                            <p className="text-xs text-muted-foreground">{video.format}</p>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {video.focus}
                          </Badge>
                        </div>
                        <Button asChild variant="link" className="h-auto px-0 text-xs font-semibold">
                          <a href={video.url} target="_blank" rel="noreferrer">
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
                Connect with mentors for accountability, expert advice, and structured career growth.
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
                Sync the entire crew with shared intensives, monthly focus cycles, and data-driven retros.
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
