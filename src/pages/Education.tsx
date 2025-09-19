import { BookOpen, GraduationCap, PlaySquare, Users, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

const bookCollections = [
  {
    title: "Foundational Musicianship",
    description:
      "Master the essentials of music theory, ear training, and instrument technique to build confident performance skills.",
    items: [
      {
        name: "The Musician's Handbook",
        author: "Bobby Borg",
        focus: "Career Fundamentals",
        takeaway: "Establish a rock-solid foundation for navigating the industry and building sustainable habits."
      },
      {
        name: "Music Theory for Guitarists",
        author: "Tom Kolb",
        focus: "Theory Essentials",
        takeaway: "Translate theory concepts directly onto the fretboard with modern practice drills."
      },
      {
        name: "Effortless Mastery",
        author: "Kenny Werner",
        focus: "Mindset & Practice",
        takeaway: "Unlock flow-state practicing with techniques that balance discipline and creativity."
      }
    ]
  },
  {
    title: "Songwriting & Creativity",
    description:
      "Upgrade your writing toolkit with books that unpack lyricism, storytelling, and arranging for modern audiences.",
    items: [
      {
        name: "Writing Better Lyrics",
        author: "Pat Pattison",
        focus: "Lyric Craft",
        takeaway: "A semester-style guide to turning song ideas into compelling narratives."
      },
      {
        name: "Tunesmith",
        author: "Jimmy Webb",
        focus: "Composition",
        takeaway: "Legendary songwriting lessons from a Grammy-winning composer with exercises you can apply immediately."
      },
      {
        name: "Songwriters On Songwriting",
        author: "Paul Zollo",
        focus: "Creative Process",
        takeaway: "Dozens of interviews with iconic writers that reveal breakthrough moments and creative systems."
      }
    ]
  },
  {
    title: "Music Business & Branding",
    description:
      "Navigate the modern music economy with guides that demystify contracts, marketing, and independent releases.",
    items: [
      {
        name: "All You Need to Know About the Music Business",
        author: "Donald Passman",
        focus: "Industry",
        takeaway: "Understand contracts, royalties, and negotiation tactics before your next big opportunity."
      },
      {
        name: "Creative Quest",
        author: "Questlove",
        focus: "Creative Leadership",
        takeaway: "Blend artistry and entrepreneurship through stories from one of music's most inventive minds."
      },
      {
        name: "How to Make It in the New Music Business",
        author: "Ari Herstand",
        focus: "Indie Strategy",
        takeaway: "A modern blueprint for self-managed releases, touring, and audience growth."
      }
    ]
  }
];

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
              <CardTitle>Curated Reading Tracks</CardTitle>
              <CardDescription>
                Start with foundational skills, then branch into creative mastery and business strategy as you grow.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {bookCollections.map((collection) => (
                <Card key={collection.title} className="border-dashed">
                  <CardHeader className="space-y-2">
                    <div className="flex items-start justify-between gap-4">
                      <CardTitle className="text-lg">{collection.title}</CardTitle>
                      <Badge variant="secondary">3 titles</Badge>
                    </div>
                    <CardDescription>{collection.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {collection.items.map((item) => (
                      <div key={item.name} className="rounded-lg border bg-muted/30 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">{item.name}</p>
                            <p className="text-xs text-muted-foreground">{item.author}</p>
                          </div>
                          <Badge variant="outline" className="whitespace-nowrap text-xs">
                            {item.focus}
                          </Badge>
                        </div>
                        <p className="mt-3 text-xs text-muted-foreground">{item.takeaway}</p>
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
