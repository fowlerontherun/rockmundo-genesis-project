import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  Award,
  BookOpen,
  Briefcase,
  Calendar,
  DollarSign,
  Guitar,
  Heart,
  HelpCircle,
  MapPin,
  Mic,
  Music,
  Package,
  Plane,
  Radio,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";

const Section = ({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) => (
  <section className="relative overflow-hidden rounded-xl border border-border bg-card">
    <span className="absolute inset-y-0 left-0 w-[3px] bg-primary/80" aria-hidden />
    <div className="space-y-2.5 px-4 py-3 pl-5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <h3 className="text-[15px] font-semibold text-foreground">{title}</h3>
      </div>
      <div className="space-y-2 text-[13px] leading-relaxed text-muted-foreground">{children}</div>
    </div>
  </section>
);

const Bullets = ({ items }: { items: React.ReactNode[] }) => (
  <ul className="space-y-1.5">
    {items.map((item, index) => (
      <li key={index} className="flex gap-2">
        <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-primary/70" />
        <span className="text-foreground/85">{item}</span>
      </li>
    ))}
  </ul>
);

const Access = ({ path }: { path: string }) => (
  <p className="text-[12px] text-muted-foreground">
    Access · <span className="font-medium text-foreground/90">{path}</span>
  </p>
);

const TABS = [
  ["overview", "Overview"],
  ["music", "Music"],
  ["live", "Live"],
  ["skills", "Skills"],
  ["career", "Career"],
  ["world", "World"],
] as const;

export const HowToPlayDialog = () => {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" title="How to play">
          <HelpCircle className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] max-w-5xl gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border bg-card px-6 pb-4 pt-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="mb-1 text-[11px] font-medium text-muted-foreground">Player guide · refreshed September 2026</p>
              <DialogTitle className="text-[22px] font-semibold tracking-tight">How to play RockMundo</DialogTitle>
              <p className="mt-1 max-w-2xl text-[12.5px] text-muted-foreground">
                Build a music career by developing skills, creating songs, preparing properly, performing,
                releasing music and growing an audience. Most systems share the same calendar, money,
                location and wellness rules, so planning matters as much as raw stats.
              </p>
            </div>
            <Badge variant="secondary" className="hidden md:inline-flex">Current systems</Badge>
          </div>
        </DialogHeader>

        <ScrollArea className="h-[72vh]">
          <div className="px-6 py-5">
            <Tabs defaultValue="overview">
              <TabsList className="mb-5 flex h-auto w-full flex-wrap justify-start gap-1 bg-muted/60 p-1">
                {TABS.map(([value, label]) => (
                  <TabsTrigger key={value} value={value} className="px-3 py-1.5 text-[12px]">
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="overview" className="mt-0 space-y-3">
                <Section icon={Trophy} title="The main career loop">
                  <Bullets items={[
                    "Learn and specialise in the skills that support the kind of musician you want to become.",
                    "Write songs, practise them, rehearse with your band and record prepared material.",
                    "Play busking slots, open mics, Battle of the Bands, gigs, tours and festivals.",
                    "Release singles, EPs and albums, then support them with media, social activity and live shows.",
                    "Use feedback, charts, finances and audience growth to decide what to do next.",
                  ]} />
                </Section>

                <Section icon={Calendar} title="Calendar, location and conflicts">
                  <Bullets items={[
                    "Travel, rehearsals, recordings, lessons, work and performances all take time.",
                    "You cannot be in two places at once, and group activities depend on the availability of the members involved.",
                    "Check the city, start time and travel window before committing to an important booking.",
                    "Avoid stacking major activities too tightly around gigs, tours and recording sessions.",
                  ]} />
                </Section>

                <Section icon={Heart} title="Wellness affects everything">
                  <Bullets items={[
                    "Health, energy, fatigue and other wellness states can reduce performance or block demanding actions.",
                    "Recovery is a normal part of career planning, especially before tours, recording sessions and important shows.",
                    "The game gives player-facing feedback when your condition is the reason an activity is limited.",
                  ]} />
                </Section>
              </TabsContent>

              <TabsContent value="music" className="mt-0 space-y-3">
                <Section icon={Music} title="Songwriting and repertoire">
                  <Access path="Music → Songwriting" />
                  <Bullets items={[
                    "Write alone or collaborate with other players where the songwriting flow supports it.",
                    "Songs can move through writing, personal practice, band repertoire, rehearsal, recording, release and live performance.",
                    "Optional songwriting mini-games can improve the hands-on experience, but they do not replace the normal songwriting flow.",
                    "Cover songs use a separate rights and royalty workflow when you want to record another artist's material.",
                  ]} />
                </Section>

                <Section icon={Activity} title="Practice, rehearsals and jam sessions">
                  <Bullets items={[
                    "Practice improves your own readiness and can help you become more familiar with material.",
                    "Band rehearsals prepare shared repertoire and build cohesion before shows.",
                    "Jam sessions are broader band-development sessions that support chemistry, familiarity and musicianship.",
                    "Interactive practice, songwriting, rehearsal and recording mini-games are optional ways to earn extra progress and feedback.",
                  ]} />
                </Section>

                <Section icon={Package} title="Recording, releases and stock">
                  <Access path="Music → Recording / Releases" />
                  <Bullets items={[
                    "Studio quality, preparation, the performers involved and production choices all influence recording outcomes.",
                    "Create singles, EPs or albums from recorded material and choose the formats and distribution that fit your campaign.",
                    "Physical formats are stock-limited: sales cannot exceed the inventory you have manufactured.",
                    "Labels can invest in marketing campaigns that increase demand, so make sure stock and campaign spend are planned together.",
                    "Streaming and physical sales are different audience signals and can move differently over the life of a release.",
                  ]} />
                </Section>
              </TabsContent>

              <TabsContent value="live" className="mt-0 space-y-3">
                <Section icon={Mic} title="Early live opportunities">
                  <Bullets items={[
                    "Busking and open mics are useful low-pressure ways to start building live experience and local recognition.",
                    "Battle of the Bands runs in cities on a repeating schedule and is aimed at eligible developing bands.",
                    "Competitive and booked shows both reward preparation rather than simply owning high-quality songs.",
                  ]} />
                </Section>

                <Section icon={Guitar} title="Gigs and setlists">
                  <Access path="Band → Live / Perform" />
                  <Bullets items={[
                    "Build setlists from songs your band can actually access and perform.",
                    "Song readiness, member attendance, chemistry, relevant skills, equipment, crew and show preparation all matter.",
                    "Gig preparation surfaces help you spot weak songs, missing equipment and readiness problems before show time.",
                    "Do not rely on published hidden percentages: the game deliberately keeps exact outcome weights behind the curtain.",
                  ]} />
                </Section>

                <Section icon={Plane} title="Tours and festivals">
                  <Bullets items={[
                    "Touring connects multiple gigs, travel legs, accommodation, production and finances into one plan.",
                    "Festival performance uses the same core preparation principles as gigs, with additional scheduling and event context.",
                    "Player-run festivals add setup, site, stages, lineup, ticketing, sponsorship and operational decisions.",
                  ]} />
                </Section>
              </TabsContent>

              <TabsContent value="skills" className="mt-0 space-y-3">
                <Section icon={BookOpen} title="Skills, XP and education">
                  <Access path="Education / Skills" />
                  <Bullets items={[
                    "Develop instrument, performance, songwriting, production, business and support skills over time.",
                    "Universities now differ in quality and prestige, so the same kind of course can cost more, take a different amount of time and award different XP depending on where you study.",
                    "University quality has the stronger learning effect; prestige also contributes and can raise tuition.",
                    "You can drop out of an active university course when your plans change instead of being locked in until completion.",
                    "YouTube learning includes filtering and subscriptions so you can more easily return to the skills and channels you are developing.",
                  ]} />
                </Section>

                <Section icon={Sparkles} title="Progress without one meta build">
                  <p>
                    RockMundo is balanced around several systems interacting at once. A specialist can be excellent at a role,
                    while a broader character can be more flexible. Use the feedback from recordings, rehearsals, gigs and learning
                    to decide what is worth improving next.
                  </p>
                </Section>
              </TabsContent>

              <TabsContent value="career" className="mt-0 space-y-3">
                <Section icon={Users} title="Bands, recruitment and roles">
                  <Access path="Band → Members / Recruitment" />
                  <Bullets items={[
                    "Create recruitment adverts for the musicians you need, review applications and take adverts down when the role is filled.",
                    "Invitations and band roles should be based on the actual instrument and role skills used by the game.",
                    "Band activities such as rehearsals, recordings, setlists and touring use shared band context rather than separate duplicate systems.",
                  ]} />
                </Section>

                <Section icon={Briefcase} title="Work, media and promotion">
                  <Bullets items={[
                    "Jobs provide income while you build your music career, but scheduled work still competes for calendar time.",
                    "PR and promotional offers have their own dates and times, so availability and location still matter.",
                    "Media, social activity and live shows can all support a release campaign without guaranteeing a specific result.",
                  ]} />
                </Section>

                <Section icon={DollarSign} title="Money and shared finances">
                  <Bullets items={[
                    "Personal funds, bank accounts and band funds are separate and should be used deliberately.",
                    "Band recordings and band activity should normally be paid from band money, with personal funding only where the booking flow allows it.",
                    "Physical releases, touring, promotion, equipment and festivals can all create meaningful cash commitments, so keep an eye on the finance views rather than only the headline balance.",
                  ]} />
                </Section>
              </TabsContent>

              <TabsContent value="world" className="mt-0 space-y-3">
                <Section icon={MapPin} title="Cities, travel and local opportunity">
                  <Bullets items={[
                    "Most opportunities belong to a real in-game city: studios, venues, jobs, universities and events all depend on where you are.",
                    "Travel blocks calendar time, so route planning is part of gig and tour preparation.",
                    "Local fame and audience growth can differ from city to city, which makes touring useful for expanding your reach.",
                  ]} />
                </Section>

                <Section icon={Radio} title="Charts, awards and World Pulse">
                  <Bullets items={[
                    "RockMundo has multiple chart views for different time periods, formats and markets; they are intended to answer different questions rather than duplicate one another.",
                    "World Pulse summarises wider movement across streams, sales and other audience signals.",
                    "Seasonal chart moments such as the Christmas Number 1 are part of the world calendar and can trigger additional feedback and events during the run-up.",
                  ]} />
                </Section>

                <Section icon={Award} title="Use the Compendium for the detail">
                  <p>
                    This dialog is the quick-start version. The Compendium contains deeper guides for releases, recording,
                    education, bands, festivals, tours, charts, finances, promotion, equipment and other systems while keeping
                    exploit-prone hidden formulas private.
                  </p>
                </Section>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
