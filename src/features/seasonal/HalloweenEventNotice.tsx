import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Gift, PartyPopper, Sparkles, Trophy } from "lucide-react";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  HALLOWEEN_2026_NAME,
  halloweenDismissalKey,
  halloweenEndLabel,
  halloweenEventPhase,
  halloweenRemainingLabel,
} from "./halloween2026";

function useActiveHalloween() {
  const { data } = useSiteConfig();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const event = data?.halloween;
  return {
    event,
    isActive: halloweenEventPhase(event, now) === "active",
    remaining: event ? halloweenRemainingLabel(event, now) : "",
  };
}

function EventDetails({ endsAt }: { endsAt: string }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      <p>The Haunted Stage is live! Every character receives a free, permanent <strong>Haunted Pumpkin Hat 2026</strong> for their Avatar V1 wardrobe.</p>
      <ul className="space-y-2" aria-label="Halloween event rewards">
        <li className="flex items-start gap-2"><Gift className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" /> Equip the hat in the Avatar Designer before performing.</li>
        <li className="flex items-start gap-2"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" /> Each eligible completed gig earns a random +5%, +10% or +15% performance boost.</li>
        <li className="flex items-start gap-2"><Trophy className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" /> Your first eligible gig earns 500 bonus XP and the permanent Pumpkin Headliner 2026 achievement.</li>
      </ul>
      <p className="flex items-center gap-2 font-medium">
        <CalendarDays className="h-4 w-4 text-orange-400" />
        Ends {endsAt} (UK time)
      </p>
      <p className="text-xs text-muted-foreground">The Pumpkin Hat is yours to keep and wear after Halloween. Event performance and XP rewards stop when the event ends.</p>
    </div>
  );
}

/** Presented once per playable character's first login during the event. */
export function HalloweenLoginAnnouncement({ userId, profileId }: { userId?: string | null; profileId?: string | null }) {
  const { event, isActive } = useActiveHalloween();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isActive || !userId || !profileId) {
      setOpen(false);
      return;
    }
    const key = halloweenDismissalKey(userId, profileId);
    try {
      setOpen(window.localStorage.getItem(key) !== "seen");
    } catch {
      // Storage-restricted browsers still see the in-session announcement.
      setOpen(true);
    }
  }, [isActive, userId, profileId]);

  const dismiss = () => {
    setOpen(false);
    if (userId && profileId) {
      try { window.localStorage.setItem(halloweenDismissalKey(userId, profileId), "seen"); }
      catch { /* Display must remain usable without localStorage. */ }
    }
  };

  if (!isActive || !event || !userId || !profileId) return null;
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) dismiss(); }}>
      <DialogContent className="w-[calc(100vw-2rem)] max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="mx-auto mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-orange-500/15 sm:mx-0" aria-hidden="true">
            <PartyPopper className="h-6 w-6 text-orange-400" />
          </div>
          <DialogTitle className="font-bebas text-2xl tracking-wide">{HALLOWEEN_2026_NAME} is live!</DialogTitle>
          <DialogDescription>
            24 October – 1 November 2026 · A limited-time Halloween gig event
          </DialogDescription>
        </DialogHeader>
        <EventDetails endsAt={halloweenEndLabel(event)} />
        <div className="flex flex-wrap gap-2">
          <Button asChild onClick={dismiss}>
            <Link to="/avatar-designer">Equip my Pumpkin Hat</Link>
          </Button>
          <Button type="button" variant="outline" onClick={dismiss}>Maybe later</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Stays available after the one-time login announcement is dismissed. */
export function HalloweenDashboardBanner() {
  const { event, isActive, remaining } = useActiveHalloween();
  const [detailsOpen, setDetailsOpen] = useState(false);
  if (!isActive || !event) return null;
  return (
    <section aria-label="Active Halloween event" className="rounded-xl border border-orange-500/40 bg-orange-500/10 p-3 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 font-semibold"><PartyPopper className="h-4 w-4 text-orange-400" /> {HALLOWEEN_2026_NAME}</h2>
          <p className="text-sm text-muted-foreground">
            Wear your free Pumpkin Hat at gigs for a random performance boost, 500 XP and an exclusive achievement.
          </p>
          <p className="text-xs font-semibold text-orange-400">{remaining} · Ends {halloweenEndLabel(event)} UK time</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm"><Link to="/avatar-designer">Equip hat</Link></Button>
          <Button size="sm" variant="outline" onClick={() => setDetailsOpen(true)}>Event details</Button>
        </div>
      </div>
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{HALLOWEEN_2026_NAME}</DialogTitle>
            <DialogDescription>Halloween gig rewards and event deadline</DialogDescription>
          </DialogHeader>
          <EventDetails endsAt={halloweenEndLabel(event)} />
          <Button asChild onClick={() => setDetailsOpen(false)}><Link to="/avatar-designer">Equip Pumpkin Hat</Link></Button>
        </DialogContent>
      </Dialog>
    </section>
  );
}

/** A compact, independent strip for the public landing and sign-in pages. */
export function HalloweenPublicBanner({ showLoginLink = true }: { showLoginLink?: boolean }) {
  const { event, isActive, remaining } = useActiveHalloween();
  if (!isActive || !event) return null;
  return (
    <div role="status" className="border border-orange-500/30 bg-orange-500/10 px-3 py-2.5 text-sm">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
        <p><strong className="text-orange-400">{HALLOWEEN_2026_NAME} is live!</strong> Wear the free Pumpkin Hat for gig boosts and a one-time 500 XP reward. {remaining} (UK).</p>
        {showLoginLink && <Link to="/auth" className="font-semibold text-orange-400 underline underline-offset-2">Log in to participate</Link>}
      </div>
    </div>
  );
}
