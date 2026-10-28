import { Link } from 'react-router-dom';
import { Disc3, Guitar, Music2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { citySceneGigBookingHref } from './sceneCityGigLink';

const communityActivities = [
  {
    title: 'Play live',
    description: 'A completed, verified gig performance can help your monthly city mural.',
    route: '/gig-booking',
    button: 'Explore gigs',
    Icon: Guitar,
    accent: 'from-blue-900 to-indigo-950',
  },
  {
    title: 'Finish a recording',
    description: 'Completed studio sessions count when the game verifies the result.',
    route: '/recording-studio',
    button: 'Find a studio',
    Icon: Disc3,
    accent: 'from-orange-800 to-rose-950',
  },
  {
    title: 'Rehearse together',
    description: "Finish a verified band rehearsal to support your city's music scene.",
    route: '/rehearsals',
    button: 'Book rehearsal',
    Icon: Music2,
    accent: 'from-emerald-900 to-teal-950',
  },
] as const;

/** The monthly objective combines server-verified activity types, not clicks or bookings. */
export function SceneMonthlyActions({ cityId }: { cityId?: string }) {
  return (
    <section className="space-y-3" aria-label="Ways to support the monthly city mural">
      <div>
        <h4 className="text-base font-bold">Build the monthly mural together</h4>
        <p className="text-xs text-muted-foreground">
          Try these activities. Only completed events accepted by the City Scene verifier
          contribute; booking or opening a page never earns scene points.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {communityActivities.map(({ title, description, route, button, Icon, accent }) => (
          <Card key={title} className="overflow-hidden">
            <div className={`flex h-20 items-center justify-center bg-gradient-to-br ${accent} text-white`}>
              <Icon className="h-9 w-9" aria-hidden="true" strokeWidth={1.6} />
            </div>
            <CardContent className="space-y-2 p-3">
              <p className="text-sm font-semibold">{title}</p>
              <p className="min-h-14 text-xs text-muted-foreground">{description}</p>
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link to={route === '/gig-booking' ? citySceneGigBookingHref(cityId) : route}>{button}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
