import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Award, BarChart3, CalendarDays, Disc3, Music2, Sparkles, Star, Trash2, UserRound, Users, Plus, ArrowRight } from "lucide-react";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShareMomentSheet } from "@/features/shareable-moments/ShareMomentSheet";
import { AvatarShareStudio } from "@/features/shareable-moments/CharacterShareStudio";
import type { CharacterProfileShareMoment } from "@/features/shareable-moments/characterProfile";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { usePrimaryBand } from "@/hooks/usePrimaryBand";
import { deleteShareMomentSnapshot, listShareMomentSnapshots, type ShareMomentSnapshot } from "@/features/shareable-moments/gallery";
import type { ShareMoment } from "@/features/shareable-moments/types";
import { trackShareAnalyticsEvent } from "@/features/shareable-moments/analytics";

const creators = [
  { title: "Gig Poster", description: "Promote a scheduled show with venue, date, ticket price and live ticket demand.", action: "Choose a gig", path: "/schedule?shareCreate=gig", icon: Music2, badge: "Live poster" },
  { title: "Tour Poster", description: "Build a route-aware tour poster from your real booked stops and dates.", action: "Choose a tour", path: "/band/tours?shareCreate=tour", icon: CalendarDays, badge: "Route poster" },
  { title: "Release Poster", description: "Create Coming Soon or Out Now artwork from your singles, EPs and albums.", action: "Choose a release", path: "/music/releases?shareCreate=release", icon: Disc3, badge: "Release art" },
  { title: "Band Promo", description: "Create a reusable band identity card with logo, genre, fame and current stats.", action: "Open band", path: "/band?shareCreate=band", icon: Users, badge: "Band identity" },
  { title: "Character Promo", description: "Put your current Avatar V1 look at the centre of a career promo card.", action: "Open profile", path: "/character?shareCreate=character", icon: UserRound, badge: "Avatar V1" },
];

const moments = [
  { title: "Character", description: "Show your Avatar V1, career identity and current look.", action: "Open profile", path: "/character", icon: UserRound },
  { title: "Band / Artist", description: "Share your logo, genre, fame, chemistry and band identity.", action: "Open band", path: "/band", icon: Users },
  { title: "Releases", description: "Promote singles, EPs and albums with their cover artwork.", action: "Open releases", path: "/music/releases", icon: Disc3 },
  { title: "Charts", description: "Celebrate song and release chart positions, including #1 moments.", action: "Open charts", path: "/career/charts", icon: BarChart3 },
  { title: "Achievements", description: "Turn major achievements into Avatar V1 milestone cards.", action: "Open achievements", path: "/career/achievements", icon: Award },
  { title: "Gigs", description: "Share completed gig results with your Avatar V1 and performance stats.", action: "Open gigs", path: "/band/gigs", icon: Music2 },
  { title: "Tours", description: "Create tour announcement posters with dates and production details.", action: "Open tours", path: "/band/tours", icon: CalendarDays },
  { title: "Festivals", description: "Share public festival posters with confirmed lineup and ticket momentum.", action: "Browse festivals", path: "/world/festivals", icon: Star },
];

export default function ShareStudio() {
  const navigate = useNavigate();
  const { profile } = useActiveProfile();
  const { data: primaryBand } = usePrimaryBand();
  const [gallery, setGallery] = useState<ShareMomentSnapshot[]>([]);
  const [galleryError, setGalleryError] = useState<string | null>(null);
  const [galleryLoading, setGalleryLoading] = useState(true);
  const [selected, setSelected] = useState<ShareMoment | null>(null);
  const [characterPromo, setCharacterPromo] = useState<CharacterProfileShareMoment | null>(null);
  const reloadGallery = async () => {
    setGalleryLoading(true); setGalleryError(null);
    try { setGallery(await listShareMomentSnapshots()); }
    catch { setGalleryError("Could not load your saved shares. Please retry."); }
    finally { setGalleryLoading(false); }
  };
  useEffect(() => { trackShareAnalyticsEvent("share_studio_opened", { channel: "studio" }); void reloadGallery(); }, []);
  const createIdentityPromo = (title: string) => {
    if (title === "Character Promo" && profile) {
      setCharacterPromo({ version: 1, type: "character_profile", id: `promo:${profile.id}`, eyebrow: "ROCKMUNDO ARTIST", headline: profile.display_name || profile.username || "RockMundo artist", subheadline: "Building a music career in RockMundo", metrics: [{ label: "Career level", value: String(profile.level || 1) }, { label: "Fame", value: Number(profile.fame || 0).toLocaleString() }, { label: "Fans", value: Number(profile.fans || 0).toLocaleString() }], destinationUrl: `${window.location.origin}/player/${profile.id}`, visualTheme: "spotlight", visualLayout: "hero", createdAt: new Date().toISOString() });
      return true;
    }
    const band = primaryBand?.bands;
    if (title === "Band Promo" && band) {
      setSelected({ version: 1, type: "band_profile", id: `promo:${band.id}`, eyebrow: "BAND PROFILE", headline: band.name, subheadline: band.genre || "RockMundo band", metrics: [{ label: "Fame", value: Number(band.fame || 0).toLocaleString() }, { label: "Fans", value: Number(band.weekly_fans || 0).toLocaleString() }], artworkUrl: band.logo_url || null, destinationUrl: `${window.location.origin}/band/${band.id}`, referralCode: null, visualTheme: "spotlight", visualLayout: "hero", createdAt: new Date().toISOString() });
      return true;
    }
    return false;
  };

  const removeSnapshot = async (id: string) => {
    try { await deleteShareMomentSnapshot(id); setGallery((items) => items.filter((item) => item.id !== id)); }
    catch { setGalleryError("Could not delete this saved share. Please retry."); }
  };
  return (
    <FMPageScaffold title="Share Studio" subtitle="Turn your RockMundo career into social-ready graphics." icon={Sparkles} backTo="/social">
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Live V1</Badge><Badge variant="outline">Square</Badge><Badge variant="outline">Story</Badge><Badge variant="outline">Landscape</Badge>
          </div>
          <CardTitle className="text-2xl">Your career is the content</CardTitle>
          <CardDescription className="max-w-2xl">Create promotional posters here or browse shareable career moments below. Source pages supply the real avatar, artwork, logo and stats; every card uses the same branded export system.</CardDescription>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2"><Plus className="h-5 w-5 text-primary" /><CardTitle>Create a poster</CardTitle></div>
          <CardDescription>Start with what you want to promote. RockMundo will pull the real game data into the poster editor for you.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {creators.map(({ title, description, action, path, icon: Icon, badge }) => (
              <button key={title} type="button" onClick={() => { if (!createIdentityPromo(title)) navigate(path); }} className="group rounded-xl border bg-card p-4 text-left transition hover:border-primary/50 hover:bg-primary/[0.03]">
                <div className="mb-3 flex items-center justify-between gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><Icon className="h-5 w-5 text-primary" /></span><Badge variant="outline">{badge}</Badge></div>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-1 min-h-10 text-sm text-muted-foreground">{description}</p>
                <span className="mt-4 flex items-center gap-1 text-sm font-medium text-primary">{action}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
      <CardHeader className="px-0 pb-0"><CardTitle className="text-lg">Browse shareable moments</CardTitle><CardDescription>Jump to a game area to celebrate results, charts and achievements.</CardDescription></CardHeader>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {moments.map(({ title, description, action, path, icon: Icon }) => (
          <Card key={title} className="flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Icon className="h-5 w-5 text-primary" /><CardTitle className="text-base">{title}</CardTitle></div><Badge variant="secondary">Shareable</Badge></div>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto"><Button className="w-full" variant="outline" onClick={() => navigate(path)}>{action}</Button></CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Share Gallery</CardTitle><CardDescription>Your successfully shared career moments are frozen here so they can be reopened later without changing with live game data.</CardDescription></CardHeader>
        <CardContent>
          {galleryError && <div role="alert" className="mb-3 text-sm text-destructive">{galleryError} <Button size="sm" variant="outline" onClick={() => void reloadGallery()}>Retry</Button></div>}
          {galleryLoading ? <p className="text-sm text-muted-foreground">Loading saved shares…</p> : galleryError && gallery.length === 0 ? null : gallery.length === 0 ? <p className="text-sm text-muted-foreground">Share a RockMundo card and it will appear here.</p> : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {gallery.map((item) => <div key={item.id} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2"><div><Badge variant="outline" className="mb-2 capitalize">{item.moment_type.replaceAll("_", " ")}</Badge><p className="font-medium">{item.headline}</p><p className="text-xs text-muted-foreground">Last shared {new Date(item.last_shared_at).toLocaleDateString()}</p></div><Button size="icon" variant="ghost" aria-label="Remove saved share" onClick={() => void removeSnapshot(item.id)}><Trash2 className="h-4 w-4" /></Button></div>
                <Button size="sm" variant="secondary" className="mt-3 w-full" onClick={() => setSelected(item.snapshot)}>Open & share again</Button>
              </div>)}
            </div>
          )}
        </CardContent>
      </Card>
      {characterPromo && <AvatarShareStudio moment={characterPromo} open={true} onOpenChange={(open) => { if (!open) setCharacterPromo(null); }} />}
      <ShareMomentSheet moment={selected} open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }} />
    </FMPageScaffold>
  );
}
