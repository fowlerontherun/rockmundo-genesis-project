import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChevronRight,
  Globe,
  Guitar,
  HeartPulse,
  LogIn,
  MapPin,
  MessageCircle,
  Mic2,
  Music,
  Plane,
  PlayCircle,
  Radio,
  Rocket,
  ServerCrash,
  Sparkles,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { version } from "@/components/VersionHeader";
import { usePlayerPresenceStats } from "@/hooks/usePlayerPresenceStats";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { supabase } from "@/integrations/supabase/client";
import heroImage from "@/assets/landing-hero.jpg";
import logo from "@/assets/rockmundo-new-logo.png";

const FEATURES = [
  {
    icon: Music,
    title: "Write & Record",
    body: "Compose songs, book studios, release singles, EPs and albums across 180 cities.",
  },
  {
    icon: Mic2,
    title: "Live Performance",
    body: "Book gigs, open mics and arena tours. Tune your setlist, hire crew, and read the crowd.",
  },
  {
    icon: Users,
    title: "Form a Band",
    body: "Recruit members, manage chemistry, split royalties and handle the drama on the road.",
  },
  {
    icon: Radio,
    title: "Media & PR",
    body: "Pitch to radio, podcasts, magazines, newspapers and streaming playlists.",
  },
  {
    icon: Globe,
    title: "Global Career",
    body: "Travel between cities, build regional fame and grow from a local act into an international name.",
  },
  {
    icon: Trophy,
    title: "Awards & Charts",
    body: "Climb weekly charts, get nominated, win trophies and earn a place in RockMundo history.",
  },
  {
    icon: TrendingUp,
    title: "Run an Empire",
    body: "Build businesses, operate venues, run labels and turn music success into something much bigger.",
  },
  {
    icon: Sparkles,
    title: "Live a Life",
    body: "Relationships, wellness, family, ageing and major life events all continue alongside your career.",
  },
];

const CAREER_STEPS = [
  {
    step: "01",
    title: "Learn your craft",
    body: "Develop instrument, vocal, performance and career skills through practice, education and experience.",
  },
  {
    step: "02",
    title: "Create music",
    body: "Write songs, improve them, rehearse with your band and take them into the recording studio.",
  },
  {
    step: "03",
    title: "Build an audience",
    body: "Play open mics and gigs, release music, promote yourself and turn attention into fans and fame.",
  },
  {
    step: "04",
    title: "Go bigger",
    body: "Tour new cities, compete in charts and awards, headline larger venues and build a worldwide reputation.",
  },
  {
    step: "05",
    title: "Shape the world",
    body: "Lead bands, run companies, operate venues and labels, launch festivals and leave a lasting legacy.",
  },
];

const GAME_FACTS = [
  {
    icon: CalendarDays,
    title: "Persistent time",
    body: "RockMundo keeps moving when you log off. Gigs, travel, charts, festivals and scheduled activities happen on a shared world clock.",
  },
  {
    icon: MapPin,
    title: "A global music world",
    body: "Your location matters. Travel between cities to find opportunities, audiences, venues, studios, jobs and other players.",
  },
  {
    icon: Guitar,
    title: "Music has depth",
    body: "Song quality, rehearsal, skills, equipment, studio choices, band chemistry and preparation all feed into results.",
  },
  {
    icon: Users,
    title: "Real multiplayer bands",
    body: "Create or join bands with other players, assign roles, share songs, rehearse together and make decisions as a group.",
  },
  {
    icon: Plane,
    title: "Touring is a system",
    body: "Plan routes, move between cities, manage transport and timing, and prepare each stop rather than teleporting from gig to gig.",
  },
  {
    icon: BriefcaseBusiness,
    title: "More than performing",
    body: "Build careers around teaching, production, media, business and other parts of the music world alongside your artist career.",
  },
  {
    icon: Building2,
    title: "Player-driven ambition",
    body: "Success can expand into labels, venues, festivals and other organisations that affect opportunities across the world.",
  },
  {
    icon: HeartPulse,
    title: "Your character is a person",
    body: "Wellness, relationships, ageing, family and lifestyle choices sit alongside music progression instead of existing as separate minigames.",
  },
];

const isDev = import.meta.env.DEV;
const DEFAULT_DISCORD_URL = "https://discord.gg/lovable-dev";
const numberFormatter = new Intl.NumberFormat("en-GB");

const formatStat = (value: number | null, loading: boolean) => {
  if (loading && value === null) return "…";
  if (value === null) return "—";
  return numberFormatter.format(value);
};

const Landing = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { data: siteConfig } = useSiteConfig();
  const {
    totalPlayers,
    totalBands,
    newPlayersThisWeek,
    onlinePlayers,
    loading: statsLoading,
  } = usePlayerPresenceStats({ refreshInterval: 60_000, publicMode: true });

  const serverStatus = siteConfig?.server.status ?? "up";
  const serverMessage = siteConfig?.server.message ?? "";
  const announcement = siteConfig?.announcement;

  const worldStats = [
    { label: "Players", value: formatStat(totalPlayers, statsLoading) },
    { label: "Bands", value: formatStat(totalBands, statsLoading) },
    { label: "New this week", value: formatStat(newPlayersThisWeek, statsLoading) },
    { label: "Online now", value: formatStat(onlinePlayers, statsLoading) },
  ];

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }

    toast({ title: "Welcome back", description: "Loading your career…" });
    setOpen(false);
    navigate("/home");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/40 bg-card/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-3 sm:px-6">
          <Link to="/" className="flex min-w-0 items-center gap-2">
            <img src={logo} alt="RockMundo" className="h-8 w-8 shrink-0 object-contain" width={32} height={32} />
            <span className="pt-0.5 font-bebas text-xl leading-none tracking-wide">ROCKMUNDO</span>
          </Link>
          <Badge variant="outline" className="hidden bg-warning/10 px-1.5 py-0 font-oswald text-[10px] text-warning sm:inline-flex">
            Beta V2
          </Badge>
          <div className="flex-1" />
          <a href="#how-it-works" className="hidden px-2 py-1 font-oswald text-xs text-muted-foreground hover:text-foreground md:inline-block">How it works</a>
          <Link to="/about" className="hidden px-2 py-1 font-oswald text-xs text-muted-foreground hover:text-foreground sm:inline-block">About</Link>
          <a href="/wiki/" className="inline-flex items-center gap-1.5 px-2 py-1 font-oswald text-xs text-muted-foreground hover:text-foreground" title="Open the RockMundo Compendium">
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Compendium</span>
          </a>
          {isDev && (
            <Button variant="ghost" size="sm" className="h-9 px-2 font-oswald text-xs tracking-wide" onClick={() => navigate("/home")} title="Dev-only: enters the app as a guest with mock data">
              <PlayCircle className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Demo</span>
            </Button>
          )}
          <Button size="sm" className="h-9 px-3 font-oswald text-xs tracking-wide sm:px-4" onClick={() => setOpen(true)}>
            <LogIn className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Log in</span>
          </Button>
        </div>
      </header>

      {(serverStatus === "down" || serverStatus === "degraded") && (
        <div className={`${serverStatus === "down" ? "border-destructive/40 bg-destructive/15 text-destructive" : "border-yellow-500/40 bg-yellow-500/10 text-yellow-500"} border-b`}>
          <div className="mx-auto flex max-w-6xl items-start gap-2.5 px-3 py-2.5 font-oswald text-xs sm:items-center sm:px-6 sm:text-sm">
            <ServerCrash className="mt-0.5 h-4 w-4 shrink-0 sm:mt-0" />
            <div className="flex-1 leading-snug">
              <span className="mr-1.5 font-semibold">Server status · {serverStatus === "down" ? "Down" : "Degraded"}</span>
              <span className="opacity-90">{serverMessage}</span>
            </div>
          </div>
        </div>
      )}

      {announcement?.enabled && (announcement.title || announcement.body) && (
        <div className="border-b border-primary/30 bg-primary/10">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-3 py-2.5 font-oswald text-xs sm:flex-row sm:items-center sm:px-6 sm:text-sm">
            <div className="flex flex-1 items-start gap-2 leading-snug sm:items-center">
              <Rocket className="mt-0.5 h-4 w-4 shrink-0 text-primary sm:mt-0" />
              <span>
                {announcement.title && <span className="mr-1.5 font-semibold text-primary">{announcement.title}</span>}
                {announcement.body && <span className="text-foreground/90">{announcement.body}</span>}
              </span>
            </div>
            {announcement.cta_label && announcement.cta_url && (
              <Button asChild size="sm" variant="outline" className="h-7 px-2.5 font-oswald text-[10px] tracking-wide">
                <a href={announcement.cta_url || DEFAULT_DISCORD_URL} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="mr-1 h-3.5 w-3.5" /> {announcement.cta_label}
                </a>
              </Button>
            )}
          </div>
        </div>
      )}

      <section id="overview" className="relative overflow-hidden border-b border-border/40">
        <img src={heroImage} alt="Concert stage with crowd and stage lights" width={1920} height={1080} className="absolute inset-0 h-full w-full object-cover opacity-25" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/85 to-background" />
        <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 md:py-20">
          <div className="mb-8 text-center sm:mb-10">
            <img src={logo} alt="RockMundo" className="mx-auto mb-5 h-24 w-auto object-contain drop-shadow-2xl sm:h-32 md:h-40" />
            <div className="mb-4 flex items-center justify-center gap-2 font-oswald text-[10px] text-primary sm:text-xs">
              <Activity className="h-3 w-3" /> Season 2026 · Open Beta · v{version}
            </div>
            <h1 className="mb-4 font-bebas text-4xl leading-[0.95] tracking-wide sm:text-6xl md:text-7xl">
              Live the dream.<br />
              <span className="text-primary">Build a music career.</span>
            </h1>
            <p className="mx-auto max-w-2xl font-oswald text-sm text-muted-foreground sm:text-base">
              RockMundo is a persistent online music career simulation. Start with a new character, learn your craft, write songs, form a band, play live, record releases, tour the world and build a career that can last generations.
            </p>
          </div>

          <div className="mx-auto flex max-w-md flex-col justify-center gap-3 sm:max-w-none sm:flex-row">
            <Button size="lg" className="w-full font-oswald tracking-wide sm:w-auto" onClick={() => setOpen(true)}>
              <LogIn className="mr-2 h-4 w-4" /> Continue Career <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
            {isDev ? (
              <Button size="lg" variant="outline" className="w-full font-oswald tracking-wide sm:w-auto" onClick={() => navigate("/home")}>
                <PlayCircle className="mr-2 h-4 w-4" /> Demo (Dev)
              </Button>
            ) : (
              <Button asChild size="lg" variant="outline" className="w-full font-oswald tracking-wide sm:w-auto">
                <Link to="/auth"><Sparkles className="mr-2 h-4 w-4" /> New Career</Link>
              </Button>
            )}
          </div>

          <div className="mt-4 text-center">
            <a href="/wiki/guides/getting-started.html" className="inline-flex items-center gap-1.5 font-oswald text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">
              <BookOpen className="h-3.5 w-3.5" /> New here? Read the Getting Started guide
            </a>
          </div>

          <div className="mx-auto mt-10 grid max-w-3xl grid-cols-2 gap-3 sm:mt-14 sm:grid-cols-4" aria-label="Live RockMundo community statistics">
            {worldStats.map((stat) => (
              <Card key={stat.label} className="border-border/40 bg-card/80 backdrop-blur-sm">
                <CardContent className="p-4 text-center">
                  <div className="mb-1 font-oswald text-[10px] text-muted-foreground sm:text-xs">{stat.label}</div>
                  <div className="font-bebas text-2xl tracking-wide text-foreground tabular-nums sm:text-3xl" aria-live="polite">{stat.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="mt-2 text-center font-oswald text-[10px] text-muted-foreground/70">Live game data · refreshes every minute</p>
        </div>
      </section>

      <section id="how-it-works" className="border-b border-border/40 bg-card/20">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="mb-8 text-center sm:mb-10">
            <div className="mb-2 font-oswald text-[10px] text-primary sm:text-xs">Your career</div>
            <h2 className="font-bebas text-3xl tracking-wide sm:text-4xl md:text-5xl">From first chord to world tour</h2>
            <p className="mx-auto mt-3 max-w-2xl font-oswald text-sm text-muted-foreground">
              There is no fixed story to finish. You build your own career over time, choosing what to practise, who to work with, where to travel and what kind of musician you want to become.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-5">
            {CAREER_STEPS.map((item) => (
              <Card key={item.step} className="border-border/40 bg-background/70">
                <CardContent className="p-4">
                  <div className="mb-3 font-bebas text-3xl tracking-wide text-primary/60">{item.step}</div>
                  <h3 className="mb-2 font-bebas text-xl tracking-wide">{item.title}</h3>
                  <p className="font-oswald text-xs leading-relaxed text-muted-foreground">{item.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="border-b border-border/40">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="mb-8 text-center sm:mb-10">
            <div className="mb-2 font-oswald text-[10px] text-primary sm:text-xs">What you can do</div>
            <h2 className="font-bebas text-3xl tracking-wide sm:text-4xl md:text-5xl">A career, fully simulated</h2>
            <p className="mx-auto mt-3 max-w-2xl font-oswald text-sm text-muted-foreground">
              Your music career is connected rather than a collection of isolated menus. Skills affect songs, songs affect shows and releases, success creates new opportunities, and your choices build a history around your character and band.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <Card key={feature.title} className="border-border/40 bg-card/80 backdrop-blur-sm transition-colors hover:border-primary/40">
                <CardContent className="p-4">
                  <feature.icon className="mb-3 h-5 w-5 text-primary" />
                  <h3 className="mb-1.5 font-bebas text-lg tracking-wide">{feature.title}</h3>
                  <p className="font-oswald text-xs leading-relaxed text-muted-foreground">{feature.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="details" className="border-b border-border/40 bg-card/30">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="mb-8 text-center sm:mb-10">
            <div className="mb-2 font-oswald text-[10px] text-primary sm:text-xs">Inside RockMundo</div>
            <h2 className="font-bebas text-3xl tracking-wide sm:text-4xl md:text-5xl">A living music world, not just a career ladder</h2>
            <p className="mx-auto mt-3 max-w-2xl font-oswald text-sm text-muted-foreground">
              The world is designed around long-term decisions and interconnected systems. You can play casually, optimise every detail, specialise in one path or try to build an entire music empire.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {GAME_FACTS.map((fact) => (
              <Card key={fact.title} className="border-border/40 bg-background/70">
                <CardContent className="p-5">
                  <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
                    <fact.icon className="h-4.5 w-4.5" />
                  </div>
                  <h3 className="mb-2 font-bebas text-xl tracking-wide">{fact.title}</h3>
                  <p className="font-oswald text-xs leading-relaxed text-muted-foreground">{fact.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="world" className="border-b border-border/40">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="mb-8 text-center">
            <div className="mb-2 font-oswald text-[10px] text-primary sm:text-xs">The world keeps moving</div>
            <h2 className="mb-3 font-bebas text-3xl tracking-wide sm:text-4xl md:text-5xl">Your decisions happen in a shared timeline</h2>
            <p className="mx-auto max-w-2xl font-oswald text-sm text-muted-foreground">
              Other artists release music, players form bands, charts change, festivals happen and your scheduled activities complete even while you are away. Logging in means returning to a world that has continued without you.
            </p>
          </div>
          <Card className="mx-auto max-w-4xl border-border/40 bg-card/80 backdrop-blur-sm">
            <CardContent className="p-0">
              <ul className="divide-y divide-border/40">
                {[
                  ["TIME", "1 in-game year = 120 real days, using a shared global clock"],
                  ["MUSIC", "Songs, recordings, releases, streams, sales and charts create a connected music economy"],
                  ["LIVE", "Open mics, gigs, tours, festivals and competitive events reward preparation and progression"],
                  ["SOCIAL", "Band recruitment, rehearsals, collaboration, messaging and shared decisions connect players"],
                  ["LIFE", "Wellness, relationships, ageing, family and legacy continue beyond your next release"],
                ].map(([key, value]) => (
                  <li key={key} className="flex items-start gap-3 px-4 py-3 sm:items-center sm:gap-4">
                    <span className="w-16 shrink-0 font-oswald text-[10px] text-primary sm:w-20 sm:text-xs">{key}</span>
                    <span className="font-oswald text-sm text-muted-foreground">{value}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="compendium" className="border-b border-border/40 bg-card/30">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="mx-auto max-w-4xl overflow-hidden rounded-lg border border-border/50 bg-card/80">
            <div className="flex flex-col gap-5 p-5 sm:p-7 md:flex-row md:items-center">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-primary/30 bg-primary/10 text-primary"><BookOpen className="h-6 w-6" /></div>
              <div className="flex-1">
                <div className="mb-1 font-oswald text-[10px] text-primary sm:text-xs">RockMundo Compendium</div>
                <h2 className="mb-2 font-bebas text-2xl tracking-wide sm:text-3xl">Learn the systems as you need them</h2>
                <p className="font-oswald text-sm leading-relaxed text-muted-foreground">
                  The Compendium has guides for getting started, songwriting, skills, bands, gigs, recording, releases, tours, businesses and the wider world without exposing every hidden formula.
                </p>
              </div>
              <div className="flex flex-col gap-2 md:shrink-0">
                <Button asChild className="font-oswald tracking-wide"><a href="/wiki/">Open Compendium</a></Button>
                <Button asChild variant="outline" className="font-oswald tracking-wide"><a href="/wiki/guides/getting-started.html">Getting Started</a></Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border/40">
        <div className="mx-auto max-w-6xl px-4 py-12 text-center sm:px-6 sm:py-16">
          <div className="mb-2 font-oswald text-[10px] text-primary sm:text-xs">Start small. Dream big.</div>
          <h2 className="mb-3 font-bebas text-3xl tracking-wide sm:text-4xl md:text-5xl">What will your music career become?</h2>
          <p className="mx-auto mb-6 max-w-2xl font-oswald text-sm text-muted-foreground">
            Join a band or go your own way. Chase chart success, become the best live act in the world, build a business empire or simply see how far one musician can go.
          </p>
          <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-3 sm:max-w-none sm:flex-row">
            <Button size="lg" className="w-full font-oswald tracking-wide sm:w-auto" onClick={() => setOpen(true)}><LogIn className="mr-2 h-4 w-4" /> Log in</Button>
            <Button asChild size="lg" variant="outline" className="w-full font-oswald tracking-wide sm:w-auto"><Link to="/auth">Create account</Link></Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/40 bg-card/50">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-4 font-oswald text-[10px] text-muted-foreground sm:flex-row sm:px-6 sm:text-xs">
          <div className="flex items-center gap-2"><img src={logo} alt="" className="h-4 w-4 object-contain" />© {new Date().getFullYear()} RockMundo · v{version}</div>
          <div className="flex items-center gap-3">
            <Link to="/about" className="hover:text-foreground">About · Press · Contact</Link>
            <span aria-hidden="true">·</span>
            <a href="/wiki/" className="inline-flex items-center gap-1 hover:text-foreground"><BookOpen className="h-3.5 w-3.5" /> Compendium</a>
          </div>
        </div>
      </footer>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card/95 backdrop-blur-sm sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-bebas text-xl tracking-wide"><LogIn className="h-5 w-5 text-primary" /> Continue Career</DialogTitle>
            <DialogDescription className="font-oswald">Enter your credentials. New here? <Link to="/auth" className="text-foreground underline" onClick={() => setOpen(false)}>Start a new career</Link>.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleLogin} className="space-y-3">
            {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
            <div className="space-y-1.5">
              <Label htmlFor="landing-email" className="font-oswald text-xs text-muted-foreground">Email</Label>
              <Input id="landing-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="landing-password" className="font-oswald text-xs text-muted-foreground">Password</Label>
                <Link to="/auth" className="font-oswald text-xs text-muted-foreground hover:text-foreground" onClick={() => setOpen(false)}>Forgot?</Link>
              </div>
              <Input id="landing-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
            </div>
            <DialogFooter className="gap-2 pt-2 sm:gap-0">
              {isDev && (
                <Button type="button" variant="ghost" className="font-oswald text-xs tracking-wide" onClick={() => { setOpen(false); navigate("/home"); }}>
                  <PlayCircle className="mr-1.5 h-4 w-4" /> Skip · Demo
                </Button>
              )}
              <Button type="submit" disabled={loading} className="font-oswald tracking-wide">
                {loading ? "Signing in…" : "Continue"}<ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Landing;
