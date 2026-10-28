import { Link } from 'react-router-dom';
import { MapPin, Music2, Users, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

/** Navigation only. Discovery never grants contribution points. */
export function SceneDiscovery({ cityId, cityName }: { cityId: string; cityName: string }) {
  const activities = [
    { title: 'Meet local musicians', detail: 'Find players to form connections and plan future music projects.', to: '/social/players', icon: Users, action: 'Find musicians' },
    { title: 'Discover bands', detail: 'Explore bands and find artists you might support or collaborate with.', to: '/bands/browse', icon: Music2, action: 'Browse bands' },
    { title: 'Find performances', detail: 'Explore live opportunities. Only verified completed gigs can count.', to: '/gig-booking', icon: CalendarDays, action: 'Explore gigs' },
  ] as const;
  return (
    <section aria-label="Discover your city music scene" className="space-y-3">
      <div>
        <h3 className="flex items-center gap-2 text-xl font-bold"><MapPin className="h-5 w-5 text-primary" aria-hidden="true" /> Discover the {cityName} music scene</h3>
        <p className="text-sm text-muted-foreground">Find musicians, bands and music activities. Discovery and page visits do not award Scene Points; only eligible completed events verified by the game count.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {activities.map(({ title, detail, to, icon: Icon, action }) => (
          <Card key={title}>
            <CardContent className="space-y-3 p-4">
              <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
              <h4 className="font-semibold">{title}</h4>
              <p className="min-h-10 text-sm text-muted-foreground">{detail}</p>
              <Button asChild variant="outline" size="sm" className="w-full"><Link to={to}>{action}</Link></Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <Button variant="link" asChild className="px-0"><Link to={`/cities/${cityId}`}>Explore {cityName} city page</Link></Button>
    </section>
  );
}
