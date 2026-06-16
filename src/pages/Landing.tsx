import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Music, Mic2, Globe, TrendingUp, Users, Radio, Trophy, Zap,
  PlayCircle, LogIn, AlertCircle, Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import logo from "@/assets/rockmundo-new-logo.png";
import heroImage from "@/assets/landing-hero.jpg";

const FEATURES = [
  { icon: Music, title: "Write & Record", body: "Compose songs, book studios, release singles, EPs and albums across 180 cities." },
  { icon: Mic2, title: "Live Performance", body: "Book gigs, open mics and stadium tours. Tune your setlist, hire crew, and read the crowd." },
  { icon: Users, title: "Form a Band", body: "Recruit members, manage chemistry, split royalties and handle the drama on the road." },
  { icon: Radio, title: "Media & PR", body: "Pitch to 235 radio stations, podcasts, magazines, newspapers and streaming playlists." },
  { icon: Globe, title: "Global Career", body: "Build regional fame across 20 tiers per country, with a 20% spillover into neighbors." },
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
    <div className="min-h-screen bg-background text-foreground">
      {/* Top nav */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-background/70 border-b border-border/50">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={logo} alt="Rockmundo logo" className="h-8 w-8 object-contain" width={32} height={32} />
            <span className="font-bold tracking-tight">Rockmundo</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#world" className="hover:text-foreground transition-colors">The World</a>
            <Link to="/about" className="hover:text-foreground transition-colors">About</Link>
          </nav>
          <div className="flex items-center gap-2">
            {isDev && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/dashboard")}
                title="Dev-only: enters the app as a guest with mock data"
              >
                <PlayCircle className="h-4 w-4 mr-1.5" />
                Demo
              </Button>
            )}
            <Button size="sm" onClick={() => setOpen(true)}>
              <LogIn className="h-4 w-4 mr-1.5" />
              Log in
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <img
          src={heroImage}
          alt="Concert stage with crowd and stage lights"
          width={1920}
          height={1080}
          className="absolute inset-0 w-full h-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/60 to-background" />
        <div className="relative container mx-auto px-4 pt-20 pb-24 md:pt-32 md:pb-40 text-center max-w-4xl">
          <Badge variant="secondary" className="mb-4">Open beta · v1.1.391</Badge>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4">
            Live the music industry.
            <br />
            <span className="bg-gradient-to-r from-primary to-pink-500 bg-clip-text text-transparent">
              One gig at a time.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Rockmundo is a deep, persistent simulation of a musician's life — from busking on a street
            corner to selling out stadiums, running a label and shaping the global charts.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button size="lg" onClick={() => setOpen(true)} className="w-full sm:w-auto">
              <LogIn className="h-5 w-5 mr-2" />
              Log in to play
            </Button>
            {isDev ? (
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate("/dashboard")}
                className="w-full sm:w-auto"
              >
                <PlayCircle className="h-5 w-5 mr-2" />
                Try the Demo (Dev Mode)
              </Button>
            ) : (
              <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
                <Link to="/auth">
                  <Sparkles className="h-5 w-5 mr-2" />
                  Create an account
                </Link>
              </Button>
            )}
          </div>
          {isDev && (
            <p className="text-xs text-muted-foreground mt-4">
              Demo mode bypasses auth and runs against mock data. Visible only in dev builds.
            </p>
          )}
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-y border-border/50 bg-card/30">
        <div className="container mx-auto px-4 py-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {STATS.map(s => (
            <div key={s.label}>
              <div className="text-3xl font-bold text-primary">{s.value}</div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="container mx-auto px-4 py-16 md:py-24">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">A career, fully simulated</h2>
          <p className="text-muted-foreground">
            Every system feeds the next. Your songs feed the charts, your charts feed your tours,
            your tours feed your label, your label feeds your empire.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map(f => (
            <Card key={f.title} className="hover:border-primary/40 transition-colors">
              <CardContent className="p-5">
                <f.icon className="h-6 w-6 text-primary mb-3" />
                <h3 className="font-semibold mb-1">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* World */}
      <section id="world" className="bg-card/30 border-y border-border/50">
        <div className="container mx-auto px-4 py-16 md:py-24 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <Zap className="h-8 w-8 text-primary mb-3" />
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">A living world that doesn't wait for you</h2>
            <p className="text-muted-foreground mb-4">
              NPC artists release songs, fans get older, mayors get elected, festivals happen on a fixed
              calendar, and the charts roll over every week — whether you're playing or not.
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>· 1 in-game year = 120 real days, on a shared global clock.</li>
              <li>· Weekly charts, monthly tax cycles, yearly mayoral elections.</li>
              <li>· Multiplayer band recruitment, jam sessions and song trading.</li>
              <li>· Permadeath with limited resurrections, children, and inheritance.</li>
            </ul>
          </div>
          <div className="rounded-lg overflow-hidden border border-border/50 shadow-xl">
            <img
              src={heroImage}
              alt="Rockmundo gameplay snapshot"
              width={1280}
              height={720}
              loading="lazy"
              className="w-full h-auto object-cover"
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-16 md:py-24 text-center max-w-2xl">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Ready to plug in?</h2>
        <p className="text-muted-foreground mb-6">
          The next chart cycle starts soon. Sign in and write your first song.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button size="lg" onClick={() => setOpen(true)}>
            <LogIn className="h-5 w-5 mr-2" />
            Log in
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/auth">Create an account</Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border/50 py-8 text-center text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} Rockmundo · v1.1.391 · <Link to="/about" className="hover:text-foreground">About</Link></p>
      </footer>

      {/* Login dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogIn className="h-5 w-5 text-primary" />
              Log in to Rockmundo
            </DialogTitle>
            <DialogDescription>
              Enter your email and password. New here?{" "}
              <Link to="/auth" className="underline text-foreground" onClick={() => setOpen(false)}>
                Create an account
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
              <Label htmlFor="landing-email">Email</Label>
              <Input
                id="landing-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="landing-password">Password</Label>
                <Link
                  to="/auth"
                  className="text-xs text-muted-foreground hover:text-foreground"
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
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              {isDev && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setOpen(false);
                    navigate("/dashboard");
                  }}
                >
                  <PlayCircle className="h-4 w-4 mr-1.5" />
                  Skip · Demo
                </Button>
              )}
              <Button type="submit" disabled={loading}>
                {loading ? "Signing in…" : "Log in"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Landing;
