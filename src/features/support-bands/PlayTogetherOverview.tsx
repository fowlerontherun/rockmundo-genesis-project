import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Mail, Users } from 'lucide-react';
export type PlayTogetherSection = 'availability' | 'offers' | 'headliner' | 'friends';
export function PlayTogetherOverview({ enabled, touring, singleGigs, invitations, connections, onNavigate }: {
  enabled: boolean; touring: boolean; singleGigs: boolean; invitations?: number; connections?: number; onNavigate: (section: PlayTogetherSection) => void;
}) {
  return <section aria-label="Play Together shortcuts" className="mb-5 space-y-3 rounded-xl border bg-muted/20 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">What would you like to do?</h3><div className="flex flex-wrap gap-2">
      {!enabled ? <Badge variant="outline">Not advertising availability</Badge> : <>{touring && <Badge>Touring open</Badge>}{singleGigs && <Badge variant="secondary">Support gigs open</Badge>}{!touring && !singleGigs && <Badge variant="outline">No offer types enabled</Badge>}</>}
    </div></div>
    {!enabled && <p className="text-sm text-muted-foreground">Want other bands to find you? Enable support offers and save your availability. You can still invite bands to your own shows.</p>}
    <div className="grid gap-2 [&>div>svg]:hidden [&>div>p]:hidden sm:grid-cols-3 sm:gap-3 sm:[&>div>svg]:block sm:[&>div>p]:block">
      <div className="space-y-2 rounded-lg border bg-background p-3"><CalendarDays className="h-5 w-5 text-primary" /><p className="text-sm text-muted-foreground">Choose single gigs, touring, and where you’re willing to play.</p><Button variant="outline" className="h-auto min-h-11 w-full whitespace-normal" onClick={() => onNavigate('availability')}>Set availability</Button></div>
      <div className="space-y-2 rounded-lg border bg-background p-3"><Users className="h-5 w-5 text-primary" /><p className="text-sm text-muted-foreground">Find an eligible support act for a saved gig or invite one from Tour Manager.</p><Button variant="outline" className="h-auto min-h-11 w-full whitespace-normal" onClick={() => onNavigate('headliner')}>Find a support band</Button></div>
      <div className="space-y-2 rounded-lg border bg-background p-3"><Mail className="h-5 w-5 text-primary" /><p className="text-sm text-muted-foreground">{invitations === undefined ? 'Check gig invitations and tour proposals.' : invitations ? `${invitations} ${invitations === 1 ? 'invitation needs' : 'invitations need'} your reply.` : 'You’re up to date on booking replies.'}</p><Button className="h-auto min-h-11 w-full whitespace-normal" onClick={() => onNavigate('offers')}>Review invitations{invitations !== undefined && invitations > 0 && <Badge variant="secondary">{invitations}</Badge>}</Button></div>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3"><p className="text-xs text-muted-foreground">Shortlists are private. Friendships are mutual. Every booking still needs acceptance.</p><Button variant="ghost" size="sm" className="h-auto min-h-9 max-w-full flex-wrap whitespace-normal text-left" onClick={() => onNavigate('friends')}>Friends &amp; label suggestions{connections !== undefined && connections > 0 && <Badge variant="secondary">{connections} to review</Badge>}</Button></div>
  </section>;
}
