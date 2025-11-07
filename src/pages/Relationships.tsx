import {
  friendshipTiers,
  relationshipStatuses,
  friendshipMilestones,
  playerProfileSections,
  communicationChannels,
  tradingOptions,
  collaborationOpportunities,
  socialSpaces,
  socialRewards,
  privacyControls,
  futureHooks,
  exampleFlowSteps,
  relationshipQuickActions,
} from "@/data/socialSystems";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  HeartHandshake,
  Users,
  Sparkles,
  Gift,
  MessageCircle,
  Trophy,
  MapPinHouse,
  Shield,
  Rocket,
  Workflow,
} from "lucide-react";

export default function Relationships() {
  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <header className="flex flex-col gap-4 border-b pb-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">Friendships & Social Systems</h1>
            <p className="text-muted-foreground max-w-3xl">
              Build meaningful relationships that power your musical career. Track affinity, unlock
              duo perks, manage collaborations, and celebrate milestones across RockMundo.
            </p>
          </div>
          <Badge variant="secondary" className="text-base">
            Social Framework 1.0
          </Badge>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr),minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HeartHandshake className="h-5 w-5" />
              Friendship Tiers & Affinity Meter
            </CardTitle>
            <CardDescription>
              Earn affinity by chatting, trading, gigging, or studying together to unlock new perks and
              collaboration power-ups.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Level</TableHead>
                  <TableHead>Affinity Range</TableHead>
                  <TableHead>Perks</TableHead>
                  <TableHead>Collaboration Upgrades</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {friendshipTiers.map((tier) => (
                  <TableRow key={tier.level}>
                    <TableCell className="font-medium">{tier.level}</TableCell>
                    <TableCell>{tier.range}</TableCell>
                    <TableCell>
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        {tier.perks.map((perk) => (
                          <li key={perk}>• {perk}</li>
                        ))}
                      </ul>
                    </TableCell>
                    <TableCell>
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        {tier.collaboration.map((upgrade) => (
                          <li key={upgrade}>• {upgrade}</li>
                        ))}
                      </ul>
                      {tier.notes && (
                        <p className="mt-3 text-xs text-primary">{tier.notes}</p>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Relationship Statuses
            </CardTitle>
            <CardDescription>
              Specialized bonds add new storylines, perks, and social reactions for your duo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {relationshipStatuses.map((status) => (
              <div key={status.name} className="rounded-lg border bg-muted/40 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl" aria-hidden>
                      {status.icon}
                    </span>
                    <div>
                      <p className="font-semibold">{status.name}</p>
                      <p className="text-xs text-muted-foreground">{status.reputation}</p>
                    </div>
                  </div>
                </div>
                <Separator className="my-3" />
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {status.unlocks.map((unlock) => (
                    <li key={unlock}>• {unlock}</li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr),minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Friendship Anniversaries & Milestones
            </CardTitle>
            <CardDescription>
              Celebrate your journey with milestone rewards and social shoutouts.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {friendshipMilestones.map((milestone) => (
              <div key={milestone.label} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-semibold">{milestone.label}</p>
                  <p className="text-sm text-muted-foreground">{milestone.reward}</p>
                </div>
                <Badge variant="outline">Milestone</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Workflow className="h-5 w-5" />
              Relationship Quick Actions
            </CardTitle>
            <CardDescription>
              Make smart moves faster with shortcuts available on every friend profile.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {relationshipQuickActions.map((action) => (
              <div key={action.label} className="flex items-start gap-3 rounded-lg border p-3">
                <action.icon className="mt-1 h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">{action.label}</p>
                  <p className="text-sm text-muted-foreground">{action.description}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Deep Player Profiles & Communication
          </CardTitle>
          <CardDescription>
            Unlock richer insights and tools once a friendship is formed.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          {playerProfileSections.map((section) => (
            <div key={section.title} className="rounded-lg border bg-muted/30 p-4">
              <h3 className="text-lg font-semibold">{section.title}</h3>
              <p className="text-sm text-muted-foreground">{section.description}</p>
              <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                {section.fields.map((field) => (
                  <li key={field}>• {field}</li>
                ))}
              </ul>
            </div>
          ))}
          <div className="md:col-span-2 rounded-lg border bg-muted/30 p-4">
            <h3 className="text-lg font-semibold">Communication Suite</h3>
            <p className="text-sm text-muted-foreground">
              Stay connected with robust messaging, reactions, and shared spaces.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {communicationChannels.map((channel) => (
                <div key={channel.name} className="rounded-lg border bg-background p-3 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-xl" aria-hidden>
                      {channel.icon}
                    </span>
                    <p className="font-medium">{channel.name}</p>
                  </div>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {channel.features.map((feature) => (
                      <li key={feature}>• {feature}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr),minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5" />
              Trading & Gifting Systems
            </CardTitle>
            <CardDescription>
              Strengthen alliances through secure trading, lending, and shared investments.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {tradingOptions.map((option) => (
              <div key={option.title} className="rounded-lg border bg-muted/30 p-4">
                <h3 className="font-semibold">{option.title}</h3>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {option.details.map((detail) => (
                    <li key={detail}>• {detail}</li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Collaboration Mechanics
            </CardTitle>
            <CardDescription>
              Turn friendships into creative opportunities and shared success.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {collaborationOpportunities.map((opportunity) => (
              <div key={opportunity.name} className="rounded-lg border bg-muted/30 p-4">
                <h3 className="font-semibold">{opportunity.name}</h3>
                <p className="text-sm text-muted-foreground">{opportunity.summary}</p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {opportunity.benefits.map((benefit) => (
                    <li key={benefit}>• {benefit}</li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr),minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPinHouse className="h-5 w-5" />
              Social Spaces & Events
            </CardTitle>
            <CardDescription>
              Hang out, relax, and celebrate achievements together beyond the stage.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {socialSpaces.map((space) => (
              <div key={space.name} className="rounded-lg border bg-muted/30 p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold">{space.name}</h3>
                  <Badge variant="outline">Hangout</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{space.tagline}</p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {space.activities.map((activity) => (
                    <li key={activity}>• {activity}</li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Social XP & Leaderboards
            </CardTitle>
            <CardDescription>
              Earn recognition for positive community interactions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {socialRewards.map((reward) => (
              <div key={reward.name} className="rounded-lg border bg-muted/30 p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold">{reward.name}</h3>
                  <Badge variant="secondary">Badge</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{reward.criteria}</p>
                <p className="mt-2 text-sm text-primary">{reward.reward}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr),minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Privacy & Boundaries
            </CardTitle>
            <CardDescription>
              Customize visibility and permissions to keep your network healthy.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {privacyControls.map((control) => (
              <div key={control.name} className="rounded-lg border bg-muted/30 p-4">
                <h3 className="font-semibold">{control.name}</h3>
                <p className="text-sm text-muted-foreground">{control.description}</p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {control.options.map((option) => (
                    <li key={option}>• {option}</li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5" />
              Future Expansion Hooks
            </CardTitle>
            <CardDescription>
              Build today with tomorrow's integrations in mind.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {futureHooks.map((hook) => (
              <div key={hook.name} className="rounded-lg border bg-muted/30 p-4">
                <h3 className="font-semibold">{hook.name}</h3>
                <p className="text-sm text-muted-foreground">{hook.description}</p>
                <p className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">Dependencies</p>
                <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                  {hook.dependencies.map((dependency) => (
                    <li key={dependency}>• {dependency}</li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Example Player Flow
          </CardTitle>
          <CardDescription>
            See how the systems connect during a real collaboration moment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {exampleFlowSteps.map((step, index) => (
              <li key={step} className="flex gap-3 rounded-lg border bg-muted/20 p-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
                  {index + 1}
                </div>
                <p className="text-sm text-muted-foreground">{step}</p>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
