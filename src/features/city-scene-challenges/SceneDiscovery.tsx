import { Link } from 'react-router-dom';
import { MapPin, Music2, Users, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

/** Only builds navigation. Verification and filtering stay on existing servers. */
export function getSceneDiscoveryLinks(cityId: string, cityName: string) {
  return {
    // Advanced discovery applies visible-city and block/privacy rules on the server.
    musicians: `/social/players/discover?${new URLSearchParams({ mode: 'musicians', city: cityName })}`,
    // Band directory filters the registered home_city_id, not touring location.
    bands: `/bands/browse?${new URLSearchParams({ city: cityId })}`,
  };
}

/** Navigation only. Discovery never grants contribution points. */
export function SceneDiscovery({ cityId, cityName }: { cityId: string; cityName: string }) {
  const links = getSceneDiscoveryLinks(cityId, cityName);
  const activities = [
    { title: 'Find local musicians', detail: 'Search musicians who publicly show their city and find future collaborators.', to: links.musicians, icon: Users, action: 'Find local musicians' },
    { title: 'Discover home-city bands', detail: 'Explore active bands registered in this city, not visiting or touring bands.', to: links.bands, icon: Music2, action: 'Browse local bands' },
    { title: 'Find performances', detail: 'Explore live opportunities. Only verified completed gigs can count.', to: '/gig-booking', icon: CalendarDays, action: 'Explore gigs' },
  ] as const;
  return (
    <section aria-label="Discover your city music scene" className="space-y-3">
      <div>
        <h3 className="flex items-center gap-2 text-xl font-bold"><MapPin className="h-5 w-5 text-primary" aria-hidden="true" /> Discover the {cityName} music scene</h3>
        <p className="text-sm text-muted-foreground">Find musicians whose city is public, and bands based here. Gig booking is a separate game-wide page. Discovery and page visits do not award Scene Points; only eligible completed events verified by the game count.</p>
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
