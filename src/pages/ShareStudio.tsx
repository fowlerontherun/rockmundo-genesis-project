import { useNavigate } from "react-router-dom";
import { Award, BarChart3, CalendarDays, Disc3, Music2, Sparkles, Star, UserRound, Users } from "lucide-react";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
      <Card><CardHeader><CardTitle className="text-base">Share Gallery</CardTitle><CardDescription>Saved historical cards are the next step. They will use frozen moment snapshots so an old achievement, outfit, lineup or tour poster does not silently change when your live character or band changes later.</CardDescription></CardHeader></Card>
    </FMPageScaffold>
  );
}
