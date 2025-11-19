import { useMemo, useState } from "react";
import {
  Calendar,
  Handshake,
  Megaphone,
  Mic2,
  Newspaper,
  NotebookPen,
  Sparkles,
  Tv,
} from "lucide-react";

import { MediaContactTable } from "@/components/pr/MediaContactTable";
import { OutreachPipeline } from "@/components/pr/OutreachPipeline";
import { PressReleaseForm } from "@/components/pr/PressReleaseForm";
import { PressReleaseList } from "@/components/pr/PressReleaseList";
import { SentimentWidget } from "@/components/pr/SentimentWidget";
import type { MediaContact, OutreachStage, PressRelease, PressReleaseFormValues, SentimentSnapshot } from "@/components/pr/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { usePrimaryBand } from "@/hooks/usePrimaryBand";
import { usePublicRelations } from "@/hooks/usePublicRelations";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const initialPressReleases: PressRelease[] = [
  {
    id: "1",
    title: "Announcing our summer tour across North America",
    channel: "Official Site",
    date: new Date().toISOString(),
    status: "published",
    sentiment: "positive",
    reach: 480000,
    notes: "Coordinated with ticketing partners and local press.",
  },
  {
    id: "2",
    title: "Studio update: collaborating with surprise guest producer",
    channel: "Newsletter",
    date: new Date().toISOString(),
    status: "scheduled",
    sentiment: "neutral",
    reach: 195000,
  },
];

const defaultContacts: MediaContact[] = [
  {
    id: "c1",
    name: "Jessie Li",
    outlet: "IndieWave Blog",
    role: "Senior Editor",
    email: "jessie@indiewave.fm",
    region: "West Coast",
    lastEngaged: "3 days ago",
    preferredChannel: "Email",
    sentiment: "positive",
  },
  {
    id: "c2",
    name: "Taylor Brooks",
    outlet: "SoundStage Radio",
    role: "Producer",
    email: "tbrooks@soundstage.fm",
    region: "National",
    lastEngaged: "1 week ago",
    preferredChannel: "Call",
    sentiment: "neutral",
  },
  {
    id: "c3",
    name: "Morgan Cruz",
    outlet: "City Beat TV",
    role: "Segment Booker",
    email: "mcruz@citybeat.tv",
    region: "NYC",
    lastEngaged: "Yesterday",
    preferredChannel: "Email",
    sentiment: "positive",
  },
];

const outreachStages: OutreachStage[] = [
  { id: "s1", label: "Prospecting", prospects: 18, conversionRate: 35, nextStep: "Shortlist feature fits" },
  { id: "s2", label: "Pitched", prospects: 12, conversionRate: 48, nextStep: "Share preview links" },
  { id: "s3", label: "Negotiating", prospects: 6, conversionRate: 62, nextStep: "Finalize deliverables" },
  { id: "s4", label: "Booked", prospects: 4, conversionRate: 80, nextStep: "Prep media kits" },
];

const sentimentSnapshot: SentimentSnapshot = {
  score: 74,
  trend: "up",
  summary: "Momentum is building after the tour announcement; keep nurturing radio contacts.",
  mentions: 1240,
};

const noteTone: Record<"campaign" | "appearance" | "offer", string> = {
  campaign: "bg-primary/10 text-primary",
  appearance: "bg-success/10 text-success",
  offer: "bg-warning/10 text-warning-foreground",
};

const PublicRelations = () => {
  const { data: bandData } = usePrimaryBand();
  const band = bandData?.bands;
  const { toast } = useToast();

  const generateId = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Date.now().toString();

  const {
    campaigns,
    campaignsLoading,
    appearances,
    appearancesLoading,
    offers,
    offersLoading,
    respondToOffer,
  } = usePublicRelations(band?.id);

  const [pressReleases, setPressReleases] = useState<PressRelease[]>(initialPressReleases);
  const [contacts] = useState<MediaContact[]>(defaultContacts);
  const [isSubmittingRelease, setIsSubmittingRelease] = useState(false);

  const totalReach = useMemo(
    () => campaigns.reduce((sum, campaign) => sum + (campaign.reach || 0), 0),
    [campaigns],
  );

  const pendingOffers = useMemo(
    () => offers.filter((offer) => offer.status === "pending").length,
    [offers],
  );

  const handlePressReleaseSubmit = (values: PressReleaseFormValues) => {
    setIsSubmittingRelease(true);
    setPressReleases((previous) => [
      {
        id: generateId(),
        reach: 0,
        sentiment: "neutral",
        ...values,
      },
      ...previous,
    ]);

    setTimeout(() => {
      setIsSubmittingRelease(false);
      toast({
        title: "Press release added",
        description: "Draft saved. Share it with your contacts when you're ready.",
      });
    }, 400);
  };

  if (!band) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>No Band Found</CardTitle>
            <CardDescription>Create or join a band to access PR features</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const overviewCards = [
    {
      label: "Active Campaigns",
      value: campaigns.length,
      icon: Megaphone,
      tone: "bg-primary/10 text-primary",
      isLoading: campaignsLoading,
    },
    {
      label: "Pending Offers",
      value: pendingOffers,
      icon: Handshake,
      tone: "bg-warning/15 text-warning-foreground",
      isLoading: offersLoading,
    },
    {
      label: "Audience Reach",
      value: totalReach,
      icon: Mic2,
      tone: "bg-success/10 text-success",
      isLoading: campaignsLoading,
    },
    {
      label: "Media Appearances",
      value: appearances.length,
      icon: Tv,
      tone: "bg-secondary/20 text-secondary-foreground",
      isLoading: appearancesLoading,
    },
  ];

  return (
    <div className="container mx-auto space-y-8 p-6">
      <header className="space-y-2">
        <Badge variant="outline" className="px-3 py-1 text-xs uppercase tracking-wide">
          Public Relations
        </Badge>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Media & PR HQ</h1>
            <p className="text-muted-foreground">Control how {band.name} shows up across press, radio, and TV.</p>
          </div>
          <Button variant="secondary" className="gap-2" onClick={() => toast({ title: "Media kit generated" })}>
            <Sparkles className="h-4 w-4" />
            Refresh media kit
          </Button>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-[2fr,1fr]">
        <div className="grid gap-4 sm:grid-cols-2">
          {overviewCards.map((card) => {
            const Icon = card.icon;
            return (
              <Card key={card.label} className="border-muted-foreground/20">
                <CardContent className="flex items-start justify-between gap-3 p-5">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">{card.label}</p>
                    {card.isLoading ? (
                      <Skeleton className="h-8 w-20" />
                    ) : (
                      <p className="text-3xl font-bold">
                        {card.label === "Audience Reach" ? card.value.toLocaleString() : card.value}
                      </p>
                    )}
                  </div>
                  <div className={cn("rounded-full p-2", card.tone)}>
                    <Icon className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <SentimentWidget snapshot={sentimentSnapshot} isLoading={campaignsLoading || offersLoading} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr,1fr]">
        <PressReleaseForm onSubmit={handlePressReleaseSubmit} isSubmitting={isSubmittingRelease} />
        <PressReleaseList releases={pressReleases} isLoading={false} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.4fr,1fr]">
        <MediaContactTable contacts={contacts} isLoading={false} />
        <OutreachPipeline stages={outreachStages} isLoading={campaignsLoading} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr,0.8fr]">
        <Card className="h-full">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Newspaper className="h-5 w-5" />
              <div>
                <CardTitle>Campaign Activity</CardTitle>
                <CardDescription>Monitor campaigns, offers, and appearances in one place.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {campaignsLoading && offersLoading && appearancesLoading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, index) => (
                  <Skeleton key={index} className="h-10 w-full" />
                ))}
              </div>
            ) : campaigns.length === 0 && offers.length === 0 && appearances.length === 0 ? (
              <EmptyState
                title="No PR activity yet"
                description="Launch a campaign or accept an appearance to see it tracked here."
                icon={Megaphone}
              />
            ) : (
              <div className="space-y-3">
                {campaigns.map((campaign) => (
                  <div key={campaign.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Megaphone className="h-4 w-4" />
                        <span className="capitalize">{campaign.campaign_type}</span>
                      </div>
                      <Badge variant="outline" className="capitalize">
                        {campaign.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-base font-semibold">{campaign.campaign_name}</p>
                    <p className="text-sm text-muted-foreground">
                      Reach: {campaign.reach.toLocaleString()} • Engagement: {campaign.engagement_rate}%
                    </p>
                  </div>
                ))}

                {offers.map((offer) => (
                  <div key={offer.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Handshake className="h-4 w-4" />
                        <span className="capitalize">{offer.media_type}</span>
                      </div>
                      <Badge className="capitalize" variant={offer.status === "pending" ? "secondary" : "outline"}>
                        {offer.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-base font-semibold">{offer.program_name}</p>
                    <p className="text-sm text-muted-foreground">{offer.network}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>{format(new Date(offer.proposed_date), "PPP")}</span>
                      {offer.status === "pending" && (
                        <div className="ml-auto flex gap-2">
                          <Button size="sm" className="bg-success" onClick={() => respondToOffer({ offerId: offer.id, accept: true })}>
                            Accept
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => respondToOffer({ offerId: offer.id, accept: false })}>
                            Decline
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {appearances.map((appearance) => (
                  <div key={appearance.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Tv className="h-4 w-4" />
                        <span className="capitalize">{appearance.media_type}</span>
                      </div>
                      <Badge variant="outline">{appearance.network}</Badge>
                    </div>
                    <p className="mt-1 text-base font-semibold">{appearance.program_name}</p>
                    <p className="text-sm text-muted-foreground">{format(new Date(appearance.air_date), "PPP")}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <NotebookPen className="h-5 w-5" />
              <div>
                <CardTitle>Notes</CardTitle>
                <CardDescription>Keep quick reminders for follow-ups and prep.</CardDescription>
              </div>
            </div>
            <Badge variant="outline">Team</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {[ 
              {
                id: "n1",
                label: "campaign",
                text: "Share tour dates with radio list once artwork is approved.",
                owner: "Eden",
              },
              { id: "n2", label: "appearance", text: "Send morning-show run-of-show to crew.", owner: "Rae" },
              { id: "n3", label: "offer", text: "Hold slot for live podcast pending travel check.", owner: "Milo" },
            ].map((note) => (
              <div key={note.id} className="flex items-start gap-3 rounded-lg border p-3">
                <Badge variant="secondary" className={cn("capitalize", noteTone[note.label])}>
                  {note.label}
                </Badge>
                <div>
                  <p className="text-sm text-foreground">{note.text}</p>
                  <p className="text-xs text-muted-foreground">Owner: {note.owner}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default PublicRelations;
