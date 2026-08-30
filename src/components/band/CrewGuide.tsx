import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  ArrowRight,
  Check,
  CircleDollarSign,
  HeartHandshake,
  Lightbulb,
  Lock,
  Music2,
  Plus,
  Shield,
  ShoppingBag,
  Shirt,
  Sparkles,
  Truck,
  Volume2,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface CrewRoleGuide {
  role: string;
  icon: LucideIcon;
  /** One short sentence a new player can understand. */
  benefit: string;
  /** Show crew roles are the ones that raise the Live Setup score. */
  boostsShow: boolean;
  priority: 1 | 2 | 3;
}

export const CREW_ROLE_GUIDES: CrewRoleGuide[] = [
  {
    role: "Front of House Engineer",
    icon: Volume2,
    benefit: "Makes your band sound better at every gig.",
    boostsShow: true,
    priority: 1,
  },
  {
    role: "Road Crew Chief",
    icon: Wrench,
    benefit: "Faster, cleaner stage setup so shows start well.",
    boostsShow: true,
    priority: 1,
  },
  {
    role: "Lighting Director",
    icon: Lightbulb,
    benefit: "Better looking shows, so crowds react more.",
    boostsShow: true,
    priority: 2,
  },
  {
    role: "Backline Technician",
    icon: Music2,
    benefit: "Keeps instruments working, fewer gig mishaps.",
    boostsShow: true,
    priority: 2,
  },
  {
    role: "Tour Manager",
    icon: Truck,
    benefit: "Smoother tours and fewer travel problems.",
    boostsShow: false,
    priority: 2,
  },
  {
    role: "Merch Director",
    icon: ShoppingBag,
    benefit: "Sells more merchandise at your shows.",
    boostsShow: false,
    priority: 3,
  },
  {
    role: "Security Lead",
    icon: Shield,
    benefit: "Fewer incidents at bigger, rowdier venues.",
    boostsShow: false,
    priority: 3,
  },
  {
    role: "Wardrobe Stylist",
    icon: Shirt,
    benefit: "Improves your image and press reaction.",
    boostsShow: false,
    priority: 3,
  },
];

export interface CrewCoverageEntry {
  role: string;
  hiredName: string | null;
  /** Cheapest available candidate the band can afford by fame, if any. */
  fameRequired: number | null;
  available: boolean;
  lowestSalary: number | null;
}

interface CrewGuideProps {
  bandFame: number;
  coverage: CrewCoverageEntry[];
  onHireRole: (role: string) => void;
}

const STEPS = [
  {
    icon: Plus,
    title: "1. Hire the basics",
    body: "Start with a sound engineer and a road crew chief. Two good people beat eight cheap ones.",
  },
  {
    icon: Sparkles,
    title: "2. Play gigs together",
    body: "Crew you keep get better as a team, which quietly lifts every show you play.",
  },
  {
    icon: CircleDollarSign,
    title: "3. Watch the wage bill",
    body: "Everyone you hire is paid per gig. Release anyone you are not really using.",
  },
];

export const CrewGuide = ({ bandFame, coverage, onHireRole }: CrewGuideProps) => {
  const coverageByRole = new Map(coverage.map((entry) => [entry.role, entry]));
  const ordered = [...CREW_ROLE_GUIDES].sort((a, b) => a.priority - b.priority);

  const hiredCount = ordered.filter((guide) => coverageByRole.get(guide.role)?.hiredName).length;
  const showRoles = ordered.filter((guide) => guide.boostsShow);
  const showCovered = showRoles.filter((guide) => coverageByRole.get(guide.role)?.hiredName).length;

  const nextSuggestion = ordered.find((guide) => {
    const entry = coverageByRole.get(guide.role);
    if (!entry || entry.hiredName) return false;
    if (!entry.available) return false;
    return entry.fameRequired === null || bandFame >= entry.fameRequired;
  });

  const nextLocked = ordered.find((guide) => {
    const entry = coverageByRole.get(guide.role);
    if (!entry || entry.hiredName || !entry.available) return false;
    return entry.fameRequired !== null && bandFame < entry.fameRequired;
  });
  const nextLockedEntry = nextLocked ? coverageByRole.get(nextLocked.role) : undefined;
  const lockProgress =
    nextLockedEntry?.fameRequired && nextLockedEntry.fameRequired > 0
      ? Math.min(100, (bandFame / nextLockedEntry.fameRequired) * 100)
      : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <HeartHandshake className="h-5 w-5 text-primary" /> Your crew, in plain English
        </CardTitle>
        <CardDescription>
          Crew are the staff behind your band. Fill the roles you need, keep them, and your gigs get better.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.title} className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <step.icon className="h-4 w-4 text-primary" />
                {step.title}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{step.body}</p>
            </div>
          ))}
        </div>

        <div className="rounded-lg border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">Role coverage</p>
              <p className="text-xs text-muted-foreground">
                {hiredCount} of {ordered.length} roles filled · {showCovered} of {showRoles.length} show roles that lift
                your gig quality
              </p>
            </div>
            <Badge variant={showCovered >= 2 ? "default" : "secondary"}>
              {showCovered >= 2 ? "Solid show crew" : "Show crew needs work"}
            </Badge>
          </div>
          <Progress value={(hiredCount / ordered.length) * 100} className="mt-2 h-2" />

          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {ordered.map((guide) => {
              const entry = coverageByRole.get(guide.role);
              const hired = Boolean(entry?.hiredName);
              const locked = !hired && entry?.fameRequired != null && bandFame < entry.fameRequired;
              const unavailable = !hired && !entry?.available;

              return (
                <div
                  key={guide.role}
                  className={`rounded-lg border p-2.5 ${hired ? "border-primary/50 bg-primary/5" : "bg-muted/20"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                      <guide.icon className="h-3.5 w-3.5 text-primary" />
                      {guide.role}
                    </div>
                    {hired ? (
                      <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                    ) : locked ? (
                      <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    ) : null}
                  </div>
                  <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{guide.benefit}</p>
                  {guide.boostsShow && (
                    <Badge variant="outline" className="mt-1.5 text-[10px]">
                      Improves gig quality
                    </Badge>
                  )}
                  <div className="mt-2 text-[11px]">
                    {hired ? (
                      <span className="font-medium">{entry?.hiredName}</span>
                    ) : unavailable ? (
                      <span className="text-muted-foreground">Nobody available right now</span>
                    ) : locked ? (
                      <span className="text-muted-foreground">
                        Needs {entry?.fameRequired?.toLocaleString()} fame
                      </span>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[11px]"
                        onClick={() => onHireRole(guide.role)}
                      >
                        Hire from ${entry?.lowestSalary?.toLocaleString() ?? "?"}/gig
                        <ArrowRight className="ml-1 h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {nextSuggestion && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
              <div>
                <p className="text-sm font-semibold">Suggested next hire: {nextSuggestion.role}</p>
                <p className="text-xs text-muted-foreground">{nextSuggestion.benefit}</p>
              </div>
            </div>
            <Button size="sm" onClick={() => onHireRole(nextSuggestion.role)}>
              Show candidates
            </Button>
          </div>
        )}

        {!nextSuggestion && nextLocked && nextLockedEntry?.fameRequired && (
          <div className="rounded-lg border p-3">
            <p className="text-sm font-semibold">Next unlock: {nextLocked.role}</p>
            <p className="text-xs text-muted-foreground">
              {bandFame.toLocaleString()} / {nextLockedEntry.fameRequired.toLocaleString()} fame — keep gigging to
              unlock them.
            </p>
            <Progress value={lockProgress} className="mt-2 h-2" />
          </div>
        )}

        <Accordion type="single" collapsible>
          <AccordionItem value="detail" className="border-b-0">
            <AccordionTrigger className="text-sm">How does crew change my results?</AccordionTrigger>
            <AccordionContent className="space-y-2 text-xs text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">Show roles</span> (sound, lights, stage, backline) feed
                into your Live Setup score, which is part of how well each gig is rated.
              </p>
              <p>
                <span className="font-medium text-foreground">Everything else</span> helps outside the performance
                score: touring smoothness, merch sales, safety and image.
              </p>
              <p>
                <span className="font-medium text-foreground">Cohesion</span> grows every gig a crew member plays with
                you, so loyalty pays off more than constantly swapping people.
              </p>
              <p>
                <span className="font-medium text-foreground">Stars and fame</span>: stronger crew ask for more fame
                before they will join, and cost more per gig.
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
};

export default CrewGuide;
