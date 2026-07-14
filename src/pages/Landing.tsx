import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Music,
  Mic2,
  Globe,
  TrendingUp,
  Users,
  Radio,
  Trophy,
  Sparkles,
  PlayCircle,
  LogIn,
  AlertCircle,
  ChevronRight,
  Activity,
  ServerCrash,
  MessageCircle,
  Mail,
  CheckCircle2,
  Rocket,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import logo from "@/assets/rockmundo-new-logo.png";
import heroImage from "@/assets/landing-hero.jpg";
import { version } from "@/components/VersionHeader";
import { useSiteConfig } from "@/hooks/useSiteConfig";

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
    body: "Pitch to 235 radio stations, podcasts, magazines, newspapers and streaming playlists.",
  },
  {
    icon: Globe,
    title: "Global Career",
    body: "Build regional fame across 20 tiers per country, with 20% spillover into neighbours.",
  },
  {
    icon: Trophy,
    title: "Awards & Charts",
    body: "Climb weekly charts, get nominated, win trophies and enter the Hall of Immortals.",
  },
  {
    icon: TrendingUp,
    title: "Run an Empire",
    body: "Found a label, sign artists, buy venues, launch merch lines and corporate subsidiaries.",
  },
  {
    icon: Sparkles,
    title: "Live a Life",
    body: "Relationships, marriage, children, wellness, addictions, prison stints — full simulation.",
  },
];

const STATS = [
  { label: "Cities", value: "180" },
  { label: "Radio Stations", value: "235" },
  { label: "Jobs", value: "1,700+" },
  { label: "Genres", value: "52" },
];

const isDev = import.meta.env.DEV;
const DEFAULT_DISCORD_URL = "https://discord.gg/lovable-dev";

const Landing = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { data: siteConfig } = useSiteConfig();
  const serverStatus = siteConfig?.server.status ?? "up";
  const serverMessage = siteConfig?.server.message ?? "";
  const announcement = siteConfig?.announcement;


  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
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
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-card/90 backdrop-blur-sm border-b border-border/40">
        <div className="h-14 px-3 sm:px-6 flex items-center gap-3 max-w-6xl mx-auto">
          <Link to="/" className="flex items-center gap-2 min-w-0">
            <img
              src={logo}
              alt="RockMundo"
              className="h-8 w-8 object-contain shrink-0"
              width={32}
              height={32}
            />
            <span className="font-bebas text-xl tracking-wide leading-none pt-0.5">
              ROCKMUNDO
            </span>
          </Link>
          <Badge
            variant="outline"
            className="hidden sm:inline-flex bg-warning/10 text-warning border-warning/30 text-[10px] px-1.5 py-0 font-oswald"
          >
            Beta V1
          </Badge>
          <div className="flex-1" />
          <Link
            to="/about"
            className="hidden sm:inline-block text-xs font-oswald text-muted-foreground hover:text-foreground px-2 py-1"
          >
            About
          </Link>
          {isDev && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 px-2 text-xs font-oswald tracking-wide"
              onClick={() => navigate("/home")}
              title="Dev-only: enters the app as a guest with mock data"
            >
              <PlayCircle className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Demo</span>
            </Button>
          )}
          <Button
            size="sm"
            className="h-9 px-3 sm:px-4 font-oswald tracking-wide text-xs"
            onClick={() => setOpen(true)}
          >
            <LogIn className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Log in</span>
          </Button>
        </div>
      </header>

      {/* Server status + Beta V2 announcement banners */}
      {/* Server status + announcement banners (admin-controlled) */}
      {(serverStatus === "down" || serverStatus === "degraded") && (
        <div className={`${serverStatus === "down" ? "bg-destructive/15 border-destructive/40 text-destructive" : "bg-yellow-500/10 border-yellow-500/40 text-yellow-500"} border-b`}>
          <div className="max-w-6xl mx-auto px-3 sm:px-6 py-2.5 flex items-start sm:items-center gap-2.5 text-xs sm:text-sm font-oswald">
            <ServerCrash className="h-4 w-4 mt-0.5 sm:mt-0 shrink-0" />
            <div className="flex-1 leading-snug">
              <span className="font-semibold mr-1.5">
                Server status · {serverStatus === "down" ? "Down" : "Degraded"}
              </span>
              <span className="opacity-90">{serverMessage}</span>
            </div>
          </div>
        </div>
      )}
      {announcement?.enabled && (announcement.title || announcement.body) && (
        <div className="bg-primary/10 border-b border-primary/30">
          <div className="max-w-6xl mx-auto px-3 sm:px-6 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2 text-xs sm:text-sm font-oswald">
            <div className="flex items-start sm:items-center gap-2 flex-1 leading-snug">
              <Rocket className="h-4 w-4 mt-0.5 sm:mt-0 shrink-0 text-primary" />
              <span>
                {announcement.title && (
                  <span className="font-semibold text-primary mr-1.5">
                    {announcement.title}
                  </span>
                )}
                {announcement.body && (
                  <span className="text-foreground/90">{announcement.body}</span>
                )}
              </span>
            </div>
            {announcement.cta_label && announcement.cta_url && (
              <div className="flex items-center gap-2 sm:shrink-0">
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="h-7 px-2.5 font-oswald tracking-wide text-[10px]"
                >
                  <a href={announcement.cta_url || DEFAULT_DISCORD_URL} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="h-3.5 w-3.5 mr-1" /> {announcement.cta_label}
                  </a>
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hero */}
      <section
        id="overview"
        className="relative border-b border-border/40 overflow-hidden"
      >
        <img
          src={heroImage}
          alt="Concert stage with crowd and stage lights"
          width={1920}
          height={1080}
          className="absolute inset-0 w-full h-full object-cover opacity-25"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/85 to-background" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 md:py-20">
          <div className="text-center mb-8 sm:mb-10">
            <img
              src={logo}
              alt="RockMundo"
              className="h-24 sm:h-32 md:h-40 w-auto mx-auto object-contain drop-shadow-2xl mb-5"
            />
            <div className="flex items-center justify-center gap-2 text-[10px] sm:text-xs font-oswald text-primary mb-4">
              <Activity className="h-3 w-3" />
              Season 2026 · Open Beta · v{version}
            </div>
            <h1 className="font-bebas text-4xl sm:text-6xl md:text-7xl tracking-wide leading-[0.95] mb-4">
              Live the dream.
              <br />
              <span className="text-primary">Build a music career.</span>
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto font-oswald">
              RockMundo is a deep, persistent simulation of a musician's life —
              from busking on a street corner to selling out arenas, running a
              label and shaping the global charts.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto sm:max-w-none">
            <Button
              size="lg"
              className="font-oswald tracking-wide w-full sm:w-auto"
              onClick={() => setOpen(true)}
            >
              <LogIn className="h-4 w-4 mr-2" />
              Continue Career
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
            {isDev ? (
              <Button
                size="lg"
                variant="outline"
                className="font-oswald tracking-wide w-full sm:w-auto"
                onClick={() => navigate("/home")}
              >
                <PlayCircle className="h-4 w-4 mr-2" />
                Demo (Dev)
              </Button>
            ) : (
              <Button
                asChild
                size="lg"
                variant="outline"
                className="font-oswald tracking-wide w-full sm:w-auto"
              >
                <Link to="/auth">
                  <Sparkles className="h-4 w-4 mr-2" />
                  New Career
                </Link>
              </Button>
            )}
          </div>

          {/* World snapshot stats */}
          <div className="mt-10 sm:mt-14 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto">
            {STATS.map((s) => (
              <Card
                key={s.label}
                className="bg-card/80 backdrop-blur-sm border-border/40"
              >
                <CardContent className="p-4 text-center">
                  <div className="text-[10px] sm:text-xs font-oswald text-muted-foreground mb-1">
                    {s.label}
                  </div>
                  <div className="text-2xl sm:text-3xl font-bebas tracking-wide text-foreground tabular-nums">
                    {s.value}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-b border-border/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <div className="text-center mb-8 sm:mb-10">
            <div className="text-[10px] sm:text-xs font-oswald text-primary mb-2">
              What you can do
            </div>
            <h2 className="font-bebas text-3xl sm:text-4xl md:text-5xl tracking-wide">
              A career, fully simulated
            </h2>
            <p className="text-sm text-muted-foreground max-w-xl mx-auto mt-3 font-oswald">
              Every system feeds the next. Songs feed charts, charts feed tours,
              tours feed your label, your label feeds your empire.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {FEATURES.map((f) => (
              <Card
                key={f.title}
                className="bg-card/80 backdrop-blur-sm border-border/40 hover:border-primary/40 transition-colors"
              >
                <CardContent className="p-4">
                  <f.icon className="h-5 w-5 text-primary mb-3" />
                  <h3 className="font-bebas text-lg tracking-wide mb-1.5">
                    {f.title}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed font-oswald">
                    {f.body}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Living world */}
      <section id="world" className="border-b border-border/40 bg-card/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <div className="text-center mb-8">
            <div className="text-[10px] sm:text-xs font-oswald text-primary mb-2">
              The world
            </div>
            <h2 className="font-bebas text-3xl sm:text-4xl md:text-5xl tracking-wide mb-3">
              A world that doesn't wait for you
            </h2>
            <p className="text-sm text-muted-foreground max-w-xl mx-auto font-oswald">
              NPC artists release songs, fans get older, mayors get elected,
              festivals happen on a fixed calendar, and the charts roll over
              every week — whether you're playing or not.
            </p>
          </div>
          <Card className="bg-card/80 backdrop-blur-sm border-border/40 max-w-3xl mx-auto">
            <CardContent className="p-0">
              <ul className="divide-y divide-border/40">
                {[
                  [
                    "TIME",
                    "1 in-game year = 120 real days, shared global clock",
                  ],
                  [
                    "ECONOMY",
                    "Weekly charts, monthly tax cycles, yearly mayoral elections",
                  ],
                  [
                    "SOCIAL",
                    "Multiplayer band recruitment, jam sessions, song trading",
                  ],
                  [
                    "LIFE",
                    "Permadeath with limited resurrections, children, inheritance",
                  ],
                ].map(([k, v]) => (
                  <li
                    key={k}
                    className="flex items-center gap-3 sm:gap-4 px-4 py-3"
                  >
                    <span className="text-[10px] sm:text-xs font-oswald text-primary w-16 sm:w-20 shrink-0">
                      {k}
                    </span>
                    <span className="text-sm text-muted-foreground font-oswald">
                      {v}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA */}
      <section className="border-b border-border/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 text-center">
          <div className="text-[10px] sm:text-xs font-oswald text-primary mb-2">
            Next cycle
          </div>
          <h2 className="font-bebas text-3xl sm:text-4xl md:text-5xl tracking-wide mb-3">
            Ready to plug in?
          </h2>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto mb-6 font-oswald">
            The next chart cycle starts soon. Sign in and write your first song.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto sm:max-w-none">
            <Button
              size="lg"
              className="font-oswald tracking-wide w-full sm:w-auto"
              onClick={() => setOpen(true)}
            >
              <LogIn className="h-4 w-4 mr-2" /> Log in
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="font-oswald tracking-wide w-full sm:w-auto"
            >
              <Link to="/auth">Create account</Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="bg-card/50 border-t border-border/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] sm:text-xs font-oswald text-muted-foreground">
          <div className="flex items-center gap-2">
            <img src={logo} alt="" className="h-4 w-4 object-contain" />©{" "}
            {new Date().getFullYear()} RockMundo · v{version}
          </div>
          <Link to="/about" className="hover:text-foreground">
            About · Press · Contact
          </Link>
        </div>
      </footer>

      {/* Login dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-sm border-border/40">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-bebas tracking-wide text-xl">
              <LogIn className="h-5 w-5 text-primary" />
              Continue Career
            </DialogTitle>
            <DialogDescription className="font-oswald">
              Enter your credentials. New here?{""}
              <Link
                to="/auth"
                className="underline text-foreground"
                onClick={() => setOpen(false)}
              >
                Start a new career
              </Link>
              .
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleLogin} className="space-y-3">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-1.5">
              <Label
                htmlFor="landing-email"
                className="text-xs font-oswald text-muted-foreground"
              >
                Email
              </Label>
              <Input
                id="landing-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="landing-password"
                  className="text-xs font-oswald text-muted-foreground"
                >
                  Password
                </Label>
                <Link
                  to="/auth"
                  className="text-xs font-oswald text-muted-foreground hover:text-foreground"
                  onClick={() => setOpen(false)}
                >
                  Forgot?
                </Link>
              </div>
              <Input
                id="landing-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              {isDev && (
                <Button
                  type="button"
                  variant="ghost"
                  className="font-oswald tracking-wide text-xs"
                  onClick={() => {
                    setOpen(false);
                    navigate("/home");
                  }}
                >
                  <PlayCircle className="h-4 w-4 mr-1.5" />
                  Skip · Demo
                </Button>
              )}
              <Button
                type="submit"
                disabled={loading}
                className="font-oswald tracking-wide"
              >
                {loading ? "Signing in…" : "Continue"}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default Landing;
