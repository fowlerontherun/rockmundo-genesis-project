import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Music, Mic2, Globe, TrendingUp, Users, Radio, Trophy, Zap,
  PlayCircle, LogIn, AlertCircle, Sparkles, ChevronRight, Activity,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import logo from "@/assets/rockmundo-new-logo.png";
import brandWordmark from "@/assets/rockmundo-brand.png";
import heroImage from "@/assets/landing-hero.jpg";

const FEATURES = [
  { icon: Music, title: "Write & Record", body: "Compose songs, book studios, release singles, EPs and albums across 180 cities." },
  { icon: Mic2, title: "Live Performance", body: "Book gigs, open mics and stadium tours. Tune your setlist, hire crew, and read the crowd." },
  { icon: Users, title: "Form a Band", body: "Recruit members, manage chemistry, split royalties and handle the drama on the road." },
  { icon: Radio, title: "Media & PR", body: "Pitch to 235 radio stations, podcasts, magazines, newspapers and streaming playlists." },
  { icon: Globe, title: "Global Career", body: "Build regional fame across 20 tiers per country, with 20% spillover into neighbours." },
  { icon: Trophy, title: "Awards & Charts", body: "Climb weekly charts, get nominated, win trophies and enter the Hall of Immortals." },
  { icon: TrendingUp, title: "Run an Empire", body: "Found a label, sign artists, buy venues, launch merch lines and corporate subsidiaries." },
  { icon: Sparkles, title: "Live a Life", body: "Relationships, marriage, children, wellness, addictions, prison stints — full simulation." },
];

const STATS = [
  { label: "Cities", value: "180" },
  { label: "Radio Stations", value: "235" },
  { label: "Jobs", value: "1,700+" },
  { label: "Genres", value: "52" },
];

const TICKER = [
  "WK 24 · Charts roll over Monday 00:00 UTC",
  "LIVE · 1,284 careers active worldwide",
  "NEWS · Q3 Awards season opens in 14 in-game days",
  "TRANSFER · Indie label Vox Nova signs 3 new artists",
];

const isDev = import.meta.env.DEV;

const Landing = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-fm-bg text-fm-fg font-sans">
      {/* Top status bar — FM chrome */}
      <header className="sticky top-0 z-30 bg-fm-panel border-b border-fm-border">
        <div className="h-10 px-3 sm:px-4 flex items-center gap-3 max-w-[1400px] mx-auto">
          <div className="flex items-center gap-2 min-w-0">
            <img src={logo} alt="Rockmundo" className="h-7 w-7 object-contain shrink-0" width={28} height={28} />
            <span className="font-bebas text-xl tracking-[0.18em] leading-none pt-0.5">ROCKMUNDO</span>
            <span className="hidden sm:inline font-oswald text-[10px] uppercase tracking-[0.2em] text-fm-fg-muted border border-fm-border px-1.5 py-0.5 rounded-sm ml-1">
              Career Edition
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-1 text-xs uppercase tracking-wide text-fm-fg-muted ml-4">
            <a href="#overview" className="px-2 py-1 hover:text-fm-fg hover:bg-fm-panel-2 rounded-sm">Overview</a>
            <a href="#features" className="px-2 py-1 hover:text-fm-fg hover:bg-fm-panel-2 rounded-sm">Modules</a>
            <a href="#world" className="px-2 py-1 hover:text-fm-fg hover:bg-fm-panel-2 rounded-sm">The World</a>
            <Link to="/about" className="px-2 py-1 hover:text-fm-fg hover:bg-fm-panel-2 rounded-sm">About</Link>
          </nav>
          <div className="flex-1" />
          <div className="hidden md:flex items-center gap-2 text-[10px] uppercase tracking-widest text-fm-fg-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-fm-good animate-pulse" />
            Servers · Live
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {isDev && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs uppercase tracking-wide hover:bg-fm-panel-2"
                onClick={() => navigate("/dashboard")}
                title="Dev-only: enters the app as a guest with mock data"
              >
                <PlayCircle className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Demo</span>
              </Button>
            )}
            <Button
              size="sm"
              className="h-7 px-3 bg-fm-accent hover:bg-fm-accent/90 text-fm-bg font-semibold uppercase tracking-wide text-xs"
              onClick={() => setOpen(true)}
            >
              <LogIn className="h-3.5 w-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Log in</span>
            </Button>
          </div>
        </div>
        {/* Ticker */}
        <div className="h-6 bg-fm-bg border-t border-fm-border overflow-hidden">
          <div className="h-full max-w-[1400px] mx-auto px-3 sm:px-4 flex items-center gap-6 text-[10px] uppercase tracking-widest text-fm-fg-muted whitespace-nowrap overflow-x-auto scrollbar-none">
            {TICKER.map((t, i) => (
              <span key={i} className="flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-fm-accent" />
                {t}
              </span>
            ))}
          </div>
        </div>
      </header>

      {/* Hero — FM dashboard slab */}
      <section id="overview" className="relative border-b border-fm-border">
        <img
          src={heroImage}
          alt="Concert stage with crowd and stage lights"
          width={1920}
          height={1080}
          className="absolute inset-0 w-full h-full object-cover opacity-20"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-fm-bg/70 via-fm-bg/85 to-fm-bg" />
        <div className="relative max-w-[1400px] mx-auto px-3 sm:px-4 py-10 md:py-16 grid md:grid-cols-[1.4fr_1fr] gap-6 items-stretch">
          {/* Left: brief */}
          <div className="bg-fm-panel/80 border border-fm-border rounded-sm p-5 md:p-8 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-fm-accent mb-3">
              <Activity className="h-3 w-3" />
              Season 2026 · Open Beta · v1.1.394
            </div>
            <h1 className="font-bebas text-5xl md:text-7xl tracking-[0.04em] leading-[0.95] mb-3">
              The music career simulator,
              <br />
              <span className="text-fm-accent">managed like a sport.</span>
            </h1>
            <p className="text-sm md:text-base text-fm-fg-muted mb-6 max-w-xl">
              Rockmundo is a deep, persistent simulation of a musician's life — from busking on a
              street corner to selling out stadiums, running a label and shaping the global charts.
              Built with the density and discipline of a top-tier sports manager.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                size="lg"
                className="bg-fm-accent hover:bg-fm-accent/90 text-fm-bg font-semibold uppercase tracking-wide"
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
                  className="border-fm-border bg-fm-panel-2 hover:bg-fm-panel text-fm-fg uppercase tracking-wide font-semibold"
                  onClick={() => navigate("/dashboard")}
                >
                  <PlayCircle className="h-4 w-4 mr-2" />
                  Demo (Dev)
                </Button>
              ) : (
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-fm-border bg-fm-panel-2 hover:bg-fm-panel text-fm-fg uppercase tracking-wide font-semibold"
                >
                  <Link to="/auth">
                    <Sparkles className="h-4 w-4 mr-2" />
                    New Career
                  </Link>
                </Button>
              )}
            </div>
            {isDev && (
              <p className="text-[10px] uppercase tracking-widest text-fm-fg-muted mt-4">
                Demo bypasses auth and runs against mock data · dev builds only
              </p>
            )}
          </div>

          {/* Right: KPI panel */}
          <div className="bg-fm-panel/80 border border-fm-border rounded-sm p-4 backdrop-blur-sm flex flex-col">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-fm-border">
              <span className="text-[10px] uppercase tracking-widest text-fm-fg-muted">World Snapshot</span>
              <span className="text-[10px] uppercase tracking-widest text-fm-good">● Live</span>
            </div>
            <div className="grid grid-cols-2 gap-px bg-fm-border flex-1">
              {STATS.map(s => (
                <div key={s.label} className="bg-fm-panel p-4 flex flex-col justify-between">
                  <div className="text-[10px] uppercase tracking-widest text-fm-fg-muted">{s.label}</div>
                  <div className="text-3xl font-bold text-fm-fg tabular-nums">{s.value}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-fm-border grid grid-cols-3 gap-2 text-center text-[10px] uppercase tracking-widest">
              <div>
                <div className="text-fm-good font-bold text-sm">+12%</div>
                <div className="text-fm-fg-muted">Sign-ups</div>
              </div>
              <div>
                <div className="text-fm-accent font-bold text-sm">WK 24</div>
                <div className="text-fm-fg-muted">Chart cycle</div>
              </div>
              <div>
                <div className="text-fm-warn font-bold text-sm">1:4</div>
                <div className="text-fm-fg-muted">Time scale</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Modules grid — FM tile pattern */}
      <section id="features" className="border-b border-fm-border">
        <div className="max-w-[1400px] mx-auto px-3 sm:px-4 py-10 md:py-16">
          <div className="flex items-end justify-between mb-6 pb-3 border-b border-fm-border">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-fm-accent mb-1">Module 01</div>
              <h2 className="font-bebas text-3xl md:text-5xl tracking-[0.04em]">Career, Fully Simulated</h2>
            </div>
            <div className="hidden md:block text-xs text-fm-fg-muted max-w-md text-right">
              Every system feeds the next. Songs feed charts, charts feed tours, tours feed your label,
              your label feeds your empire.
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-fm-border border border-fm-border rounded-sm overflow-hidden">
            {FEATURES.map((f, i) => (
              <div key={f.title} className="bg-fm-panel p-4 hover:bg-fm-panel-2 transition-colors group">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] uppercase tracking-widest text-fm-fg-muted">
                    M01·{String(i + 1).padStart(2, "0")}
                  </span>
                  <f.icon className="h-4 w-4 text-fm-accent" />
                </div>
                <h3 className="font-bold text-sm uppercase tracking-wide mb-1.5">{f.title}</h3>
                <p className="text-xs text-fm-fg-muted leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* World panel */}
      <section id="world" className="border-b border-fm-border bg-fm-panel/40">
        <div className="max-w-[1400px] mx-auto px-3 sm:px-4 py-10 md:py-16 grid md:grid-cols-2 gap-6 items-stretch">
          <div className="bg-fm-panel border border-fm-border rounded-sm p-5 md:p-8">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-fm-accent mb-3">
              <Zap className="h-3 w-3" /> Module 02 · Living World
            </div>
            <h2 className="font-bebas text-3xl md:text-5xl tracking-[0.04em] mb-3">
              A world that doesn't wait for you
            </h2>
            <p className="text-sm text-fm-fg-muted mb-5">
              NPC artists release songs, fans get older, mayors get elected, festivals happen on a
              fixed calendar, and the charts roll over every week — whether you're playing or not.
            </p>
            <ul className="divide-y divide-fm-border border-y border-fm-border text-xs">
              {[
                ["TIME", "1 in-game year = 120 real days, shared global clock"],
                ["ECON", "Weekly charts, monthly tax cycles, yearly mayoral elections"],
                ["SOCIAL", "Multiplayer band recruitment, jam sessions, song trading"],
                ["LIFE", "Permadeath with limited resurrections, children, inheritance"],
              ].map(([k, v]) => (
                <li key={k} className="flex items-center gap-3 py-2">
                  <span className="text-[10px] uppercase tracking-widest text-fm-accent w-14 shrink-0">{k}</span>
                  <span className="text-fm-fg-muted">{v}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-fm-panel border border-fm-border rounded-sm overflow-hidden flex flex-col">
            <div className="px-4 h-9 flex items-center justify-between border-b border-fm-border bg-fm-panel-2">
              <span className="text-[10px] uppercase tracking-widest text-fm-fg-muted">Match Day · Stadium View</span>
              <span className="text-[10px] uppercase tracking-widest text-fm-good">● Recording</span>
            </div>
            <img
              src={heroImage}
              alt="Rockmundo gameplay snapshot"
              width={1280}
              height={720}
              loading="lazy"
              className="w-full h-full object-cover flex-1"
            />
          </div>
        </div>
      </section>

      {/* CTA slab */}
      <section className="border-b border-fm-border">
        <div className="max-w-[1400px] mx-auto px-3 sm:px-4 py-12 md:py-16 text-center">
          <div className="text-[10px] uppercase tracking-widest text-fm-accent mb-2">Next Cycle</div>
          <h2 className="font-bebas text-3xl md:text-5xl tracking-[0.04em] mb-3">Ready to plug in?</h2>
          <p className="text-sm text-fm-fg-muted mb-6 max-w-xl mx-auto">
            The next chart cycle starts soon. Sign in and write your first song.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
            <Button
              size="lg"
              className="bg-fm-accent hover:bg-fm-accent/90 text-fm-bg font-semibold uppercase tracking-wide"
              onClick={() => setOpen(true)}
            >
              <LogIn className="h-4 w-4 mr-2" /> Log in
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-fm-border bg-fm-panel-2 hover:bg-fm-panel text-fm-fg uppercase tracking-wide font-semibold"
            >
              <Link to="/auth">Create account</Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="bg-fm-panel border-t border-fm-border">
        <div className="max-w-[1400px] mx-auto px-3 sm:px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] uppercase tracking-widest text-fm-fg-muted">
          <div className="flex items-center gap-2">
            <img src={logo} alt="" className="h-4 w-4 object-contain" />
            © {new Date().getFullYear()} Rockmundo · v1.1.394
          </div>
          <Link to="/about" className="hover:text-fm-fg">About · Press · Contact</Link>
        </div>
      </footer>

      {/* Login dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md bg-fm-panel border-fm-border text-fm-fg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 uppercase tracking-wide text-base">
              <LogIn className="h-5 w-5 text-fm-accent" />
              Continue Career
            </DialogTitle>
            <DialogDescription className="text-fm-fg-muted">
              Enter your manager credentials. New here?{" "}
              <Link to="/auth" className="underline text-fm-fg" onClick={() => setOpen(false)}>
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
              <Label htmlFor="landing-email" className="text-[10px] uppercase tracking-widest text-fm-fg-muted">Email</Label>
              <Input
                id="landing-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="bg-fm-bg border-fm-border"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="landing-password" className="text-[10px] uppercase tracking-widest text-fm-fg-muted">Password</Label>
                <Link
                  to="/auth"
                  className="text-[10px] uppercase tracking-widest text-fm-fg-muted hover:text-fm-fg"
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
                onChange={e => setPassword(e.target.value)}
                className="bg-fm-bg border-fm-border"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              {isDev && (
                <Button
                  type="button"
                  variant="ghost"
                  className="hover:bg-fm-panel-2 uppercase tracking-wide text-xs"
                  onClick={() => {
                    setOpen(false);
                    navigate("/dashboard");
                  }}
                >
                  <PlayCircle className="h-4 w-4 mr-1.5" />
                  Skip · Demo
                </Button>
              )}
              <Button
                type="submit"
                disabled={loading}
                className="bg-fm-accent hover:bg-fm-accent/90 text-fm-bg font-semibold uppercase tracking-wide"
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
