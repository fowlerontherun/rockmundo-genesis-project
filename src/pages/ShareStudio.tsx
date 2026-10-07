import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Award, BarChart3, CalendarDays, Disc3, Music2, Sparkles, Star, Trash2, UserRound, Users } from "lucide-react";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShareMomentSheet } from "@/features/shareable-moments/ShareMomentSheet";
import { deleteShareMomentSnapshot, listShareMomentSnapshots, type ShareMomentSnapshot } from "@/features/shareable-moments/gallery";
import type { ShareMoment } from "@/features/shareable-moments/types";

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
  const [gallery, setGallery] = useState<ShareMomentSnapshot[]>([]);
  const [selected, setSelected] = useState<ShareMoment | null>(null);
  useEffect(() => { void listShareMomentSnapshots().then(setGallery).catch(() => setGallery([])); }, []);
  const removeSnapshot = async (id: string) => { await deleteShareMomentSnapshot(id); setGallery((items) => items.filter((item) => item.id !== id)); };
  return (
    <FMPageScaffold title="Share Studio" subtitle="Turn your RockMundo career into social-ready graphics." icon={Sparkles} backTo="/social">
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Live V1</Badge><Badge variant="outline">Square</Badge><Badge variant="outline">Story</Badge><Badge variant="outline">Landscape</Badge>
          </div>
          <CardTitle className="text-2xl">Your career is the content</CardTitle>
          <CardDescription className="max-w-2xl">Choose a RockMundo moment below. The source page supplies the real avatar, artwork, logo and stats; Share Studio keeps every card on the same branded export system.</CardDescription>
        </CardHeader>
      </Card>
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
          {gallery.length === 0 ? <p className="text-sm text-muted-foreground">Share a RockMundo card and it will appear here.</p> : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {gallery.map((item) => <div key={item.id} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2"><div><Badge variant="outline" className="mb-2 capitalize">{item.moment_type.replaceAll("_", " ")}</Badge><p className="font-medium">{item.headline}</p><p className="text-xs text-muted-foreground">Last shared {new Date(item.last_shared_at).toLocaleDateString()}</p></div><Button size="icon" variant="ghost" aria-label="Remove saved share" onClick={() => void removeSnapshot(item.id)}><Trash2 className="h-4 w-4" /></Button></div>
                <Button size="sm" variant="secondary" className="mt-3 w-full" onClick={() => setSelected(item.snapshot)}>Open & share again</Button>
              </div>)}
            </div>
          )}
        </CardContent>
      </Card>
      <ShareMomentSheet moment={selected} open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }} />
    </FMPageScaffold>
  );
}
