import { useCallback, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Sparkles, Target } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

import { EventAnalytics } from "@/components/events/EventAnalytics";
import { EventLineupPlanner } from "@/components/events/EventLineupPlanner";
import { EventPricingStrategy } from "@/components/events/EventPricingStrategy";
import { EventSponsorManager } from "@/components/events/EventSponsorManager";
import { TicketTierManager } from "@/components/events/TicketTierManager";
import type {
  LineupSlot,
  PricingStrategyState,
  SponsorPackage,
  TicketTier,
} from "@/components/events/types";

const steps = [
  {
    title: "Event blueprint",
    description: "Set the vision, fundamentals, and required production scale.",
  },
  {
    title: "Program lineup",
    description: "Sequence artists, experiences, and stage flows.",
  },
  {
    title: "Sponsorship mix",
    description: "Map contributions, benefits, and activation focus.",
  },
  {
    title: "Pricing & tickets",
    description: "Calibrate pricing strategy and sync Supabase ticket tiers.",
  },
  {
    title: "Analytics",
    description: "Review projections, conversion pacing, and next steps.",
  },
] as const;

const generateId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const defaultPricingStrategy: PricingStrategyState = {
  basePrice: 85,
  dynamicPricing: true,
  breakEvenCost: 65000,
  marketingBudget: 12000,
  demandScore: 60,
};

const defaultEventDetails = {
  eventId: "",
  name: "",
  date: "",
  venue: "",
  capacity: 0,
  description: "",
  theme: "",
};

const EventBuilderPage = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [eventDetails, setEventDetails] = useState(defaultEventDetails);
  const [lineup, setLineup] = useState<LineupSlot[]>([]);
  const [sponsors, setSponsors] = useState<SponsorPackage[]>([]);
  const [pricing, setPricing] = useState<PricingStrategyState>(defaultPricingStrategy);
  const [ticketTiers, setTicketTiers] = useState<TicketTier[]>([]);

  const sponsorContribution = useMemo(
    () => sponsors.reduce((total, sponsor) => total + sponsor.contribution, 0),
    [sponsors],
  );
  const stageCount = useMemo(
    () => new Set(lineup.map((slot) => slot.stage.trim().toLowerCase()).filter(Boolean)).size,
    [lineup],
  );
  const lineupEnergyScore = useMemo(
    () => Math.min(100, lineup.length * 15 + stageCount * 10),
    [lineup.length, stageCount],
  );
  const planningConfidence = useMemo(() => {
    const tierMixScore = ticketTiers.length > 0 ? 20 : 0;
    const sponsorScore = sponsors.length * 10;
    const lineupScore = lineup.length * 5;
    return Math.min(100, 30 + tierMixScore + sponsorScore + lineupScore);
  }, [lineup.length, sponsors.length, ticketTiers.length]);

  const progressValue = ((currentStep + 1) / steps.length) * 100;

  const handleLineupChange = useCallback((updated: LineupSlot[]) => setLineup(updated), []);
  const handleSponsorsChange = useCallback((updated: SponsorPackage[]) => setSponsors(updated), []);
  const handleTiersChange = useCallback((updated: TicketTier[]) => setTicketTiers(updated), []);

  const currentStepLabel = steps[currentStep];

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <Card>
            <CardHeader className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl">Event blueprint</CardTitle>
                  <CardDescription>
                    Anchor the experience with a compelling story, venue parameters, and projected scale.
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="text-sm">
                  <Target className="mr-1 h-4 w-4" /> Confidence {planningConfidence}%
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="event-name">Event name</Label>
                    <Input
                      id="event-name"
                      value={eventDetails.name}
                      onChange={(event) => setEventDetails((prev) => ({ ...prev, name: event.target.value }))}
                      placeholder="Galactic Sound Summit"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="event-id">Event ID</Label>
                    <div className="flex gap-2">
                      <Input
                        id="event-id"
                        value={eventDetails.eventId}
                        onChange={(event) => setEventDetails((prev) => ({ ...prev, eventId: event.target.value }))}
                        placeholder="evt_2025_summit"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setEventDetails((prev) => ({ ...prev, eventId: generateId() }))}
                      >
                        Generate
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="event-date">Date</Label>
                      <Input
                        id="event-date"
                        type="date"
                        value={eventDetails.date}
                        onChange={(event) => setEventDetails((prev) => ({ ...prev, date: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="event-venue">Venue</Label>
                      <Input
                        id="event-venue"
                        value={eventDetails.venue}
                        onChange={(event) => setEventDetails((prev) => ({ ...prev, venue: event.target.value }))}
                        placeholder="Harborfront Amphitheater"
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="event-capacity">Target capacity</Label>
                      <Input
                        id="event-capacity"
                        type="number"
                        min={0}
                        value={eventDetails.capacity || ""}
                        onChange={(event) =>
                          setEventDetails((prev) => ({ ...prev, capacity: Number.parseInt(event.target.value) || 0 }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="event-theme">Experience theme</Label>
                      <Input
                        id="event-theme"
                        value={eventDetails.theme}
                        onChange={(event) => setEventDetails((prev) => ({ ...prev, theme: event.target.value }))}
                        placeholder="Midnight Future Bass"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="event-description">Narrative & promise</Label>
                    <Textarea
                      id="event-description"
                      value={eventDetails.description}
                      onChange={(event) => setEventDetails((prev) => ({ ...prev, description: event.target.value }))}
                      placeholder="A waterfront takeover blending immersive art, next-gen production, and global bass pioneers."
                      rows={4}
                    />
                  </div>
                </div>
                <div className="space-y-4 rounded-lg border p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">Planning snapshot</p>
                      <p className="text-xs text-muted-foreground">
                        Keep the blueprint updated so every team has the latest source of truth.
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      <CalendarDays className="mr-1 h-3.5 w-3.5" />
                      {eventDetails.date ? eventDetails.date : "Date TBD"}
                    </Badge>
                  </div>
                  <Separator />
                  <div className="space-y-3">
                    <div className="rounded-lg border p-3">
                      <p className="text-xs uppercase text-muted-foreground">Lineup readiness</p>
                      <p className="text-lg font-semibold">{lineupEnergyScore} / 100 energy score</p>
                      <p className="text-xs text-muted-foreground">{lineup.length} segments • {stageCount} stages mapped</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs uppercase text-muted-foreground">Sponsor traction</p>
                      <p className="text-lg font-semibold">${sponsorContribution.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{sponsors.length} partners in conversation</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs uppercase text-muted-foreground">Ticket architecture</p>
                      <p className="text-lg font-semibold">{ticketTiers.length} tiers scoped</p>
                      <p className="text-xs text-muted-foreground">Set the event ID to sync Supabase pricing data.</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      case 1:
        return <EventLineupPlanner lineup={lineup} onLineupChange={handleLineupChange} />;
      case 2:
        return <EventSponsorManager sponsors={sponsors} onSponsorsChange={handleSponsorsChange} />;
      case 3:
        return (
          <div className="space-y-6">
            <EventPricingStrategy
              strategy={pricing}
              onStrategyChange={setPricing}
              ticketTiers={ticketTiers}
              sponsorSupport={sponsorContribution}
              lineupEnergyScore={lineupEnergyScore}
            />
            <TicketTierManager eventId={eventDetails.eventId} onTiersChange={handleTiersChange} />
          </div>
        );
      case 4:
        return (
          <EventAnalytics
            eventName={eventDetails.name}
            eventDate={eventDetails.date}
            venue={eventDetails.venue}
            lineup={lineup}
            sponsors={sponsors}
            ticketTiers={ticketTiers}
            pricing={pricing}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto space-y-8 py-8">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Event builder</h1>
            <p className="text-muted-foreground">
              Build a multi-day experience with a single workflow tying together lineup design, monetization, and analytics.
            </p>
          </div>
          <Badge variant="outline" className="self-start md:self-auto">
            <Sparkles className="mr-1 h-4 w-4" /> Dynamic planning canvas
          </Badge>
        </div>
        <Progress value={progressValue} className="h-2" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="space-y-2">
          {steps.map((step, index) => (
            <Button
              key={step.title}
              variant={currentStep === index ? "default" : "outline"}
              className="w-full justify-start text-left"
              onClick={() => setCurrentStep(index)}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm ${
                    currentStep === index ? "bg-primary text-primary-foreground" : "bg-background"
                  }`}
                >
                  {index + 1}
                </div>
                <div>
                  <p className="font-semibold">{step.title}</p>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </div>
              </div>
            </Button>
          ))}
        </div>
        <div className="space-y-6">
          <div className="rounded-lg border p-4">
            <p className="text-sm font-semibold">{currentStepLabel.title}</p>
            <p className="text-sm text-muted-foreground">{currentStepLabel.description}</p>
          </div>
          {renderStep()}
          <div className="flex justify-between">
            <Button
              variant="ghost"
              onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
              disabled={currentStep === 0}
            >
              <ChevronLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            <Button
              onClick={() => setCurrentStep((prev) => Math.min(steps.length - 1, prev + 1))}
              disabled={currentStep === steps.length - 1}
            >
              Next <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventBuilderPage;
