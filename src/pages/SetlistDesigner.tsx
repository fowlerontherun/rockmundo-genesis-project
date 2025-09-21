import { useState, type DragEvent } from "react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { CalendarDays, Flame, Music2, Sparkles } from "lucide-react";

const showTabs = [
  {
    key: "act",
    label: "Support Act",
    tagline: "Sprint from house lights to handshake moments in under 30 minutes.",
  },
  {
    key: "headliner",
    label: "Headliner Run",
    tagline: "Full-scale arena arc with room to breathe between set pieces.",
  },
  {
    key: "festivalHeadliner",
    label: "Festival Headliner",
    tagline: "Command the main stage with relentless pacing and marquee drops.",
  },
  {
    key: "acoustic",
    label: "Acoustic Lounge",
    tagline: "Stories-first session designed for stripped-back storytelling.",
  },
] as const;

type ShowType = typeof showTabs[number]["key"];

type SetlistItem = {
  id: string;
  type: "song" | "event";
  title: string;
  detail: string;
  duration?: string;
};

type SetlistBlueprint = {
  title: string;
  locale: string;
  description: string;
  productionNotes: string[];
  items: SetlistItem[];
};

type NewItemForm = {
  type: SetlistItem["type"];
  title: string;
  detail: string;
  duration: string;
};

const initialSetlists: Record<ShowType, SetlistBlueprint> = {
  act: {
    title: "Twilight Spark Warmup",
    locale: "Regional theatre circuit",
    description:
      "Designed for opening slots where momentum matters most – five hooks to earn the room before the headliner loads in.",
    productionNotes: [
      "House lights stay half-up through first chorus to keep arrivals moving toward the floor.",
      "Guitar tech to prep spare capo on monitor three before 'Neon Footprint'.",
      "Merch captain cues QR splash on lobby screen during 'Daybreak Wager'.",
    ],
    items: [
      {
        id: "act-1",
        type: "song",
        title: "Signal Flare",
        detail: "Immediate kick drum build synced with strobe chase to grab attention.",
        duration: "3:05",
      },
      {
        id: "act-2",
        type: "song",
        title: "Room Tone Riot",
        detail: "Call-and-response vocals to warm up early fans down front.",
        duration: "3:25",
      },
      {
        id: "act-3",
        type: "event",
        title: "Crowd Pulse Check",
        detail: "Lead invites floor to clap pattern while lighting sweeps the balcony.",
        duration: "0:45",
      },
      {
        id: "act-4",
        type: "song",
        title: "Neon Footprint",
        detail: "Synth bass drop timed with haze burst for quick mood shift.",
        duration: "2:58",
      },
      {
        id: "act-5",
        type: "song",
        title: "Daybreak Wager",
        detail: "Spotlight moment – encourage phones up for future promo reel.",
        duration: "3:40",
      },
      {
        id: "act-6",
        type: "event",
        title: "Backline Shout-Out",
        detail: "Brief intro of the crew while FOH resets for closer.",
        duration: "0:35",
      },
      {
        id: "act-7",
        type: "song",
        title: "Sparks on Arrival",
        detail: "Final chorus modulates up to hand off hyped crowd to headliner.",
        duration: "3:20",
      },
    ],
  },
  headliner: {
    title: "Night Arcade Headliner",
    locale: "Major market arenas",
    description:
      "Sixteen-song headline stretch balancing blockbuster sequences with breathers for narration and sponsor beats.",
    productionNotes: [
      "Automation captain confirms lift sync for 'Stage Lift Reveal' before doors.",
      "Wardrobe quick-change crew staged behind B-stage for 'Satellite Choir'.",
      "Pyro supervisor signs off CO₂ reload between 'Fireline Waltz' and 'Glass Horizon'.",
    ],
    items: [
      {
        id: "headliner-1",
        type: "song",
        title: "Ignition Verse",
        detail: "Opener with extended intro to sync with LED tunnel fly-through.",
        duration: "3:48",
      },
      {
        id: "headliner-2",
        type: "song",
        title: "Mirrorwire",
        detail: "Laser cage effect pulses on the downbeat of every chorus.",
        duration: "4:12",
      },
      {
        id: "headliner-3",
        type: "song",
        title: "Shatterproof Sky",
        detail: "Fan wristbands shift from blue to violet for post-chorus chant.",
        duration: "4:05",
      },
      {
        id: "headliner-4",
        type: "event",
        title: "Stage Lift Reveal",
        detail: "Hydraulic lift rises to unveil percussion line.",
        duration: "1:20",
      },
      {
        id: "headliner-5",
        type: "song",
        title: "Voltage Bloom",
        detail: "Pyro jets mirror guitar squeals on pre-chorus climb.",
        duration: "3:55",
      },
      {
        id: "headliner-6",
        type: "song",
        title: "Parallax Hearts",
        detail: "Stage runway lights ripple outward toward back bowl seating.",
        duration: "4:08",
      },
      {
        id: "headliner-7",
        type: "song",
        title: "Satellite Choir",
        detail: "Choir stems swell while drone wall films 360-degree sweep.",
        duration: "4:26",
      },
      {
        id: "headliner-8",
        type: "event",
        title: "Fan Chorus Cue",
        detail: "Host cues crowd to sing bridge while band preps acoustic break.",
        duration: "1:05",
      },
      {
        id: "headliner-9",
        type: "song",
        title: "Night Glider",
        detail: "Gimbal cam tracks along B-stage glide path for livestream moment.",
        duration: "3:52",
      },
      {
        id: "headliner-10",
        type: "song",
        title: "Signal & Noise",
        detail: "Breakdown features lighting blackout except for wristband pulses.",
        duration: "4:18",
      },
      {
        id: "headliner-11",
        type: "song",
        title: "City in Reverse",
        detail: "Video wall rewinds skyline footage while band moves to satellite stage.",
        duration: "4:32",
      },
      {
        id: "headliner-12",
        type: "song",
        title: "Radiant Faultline",
        detail: "Percussion-heavy sequence with cold spark fountains on final drop.",
        duration: "3:59",
      },
      {
        id: "headliner-13",
        type: "song",
        title: "Fireline Waltz",
        detail: "Ballroom-style lighting rig rotates overhead as duet unfolds.",
        duration: "4:10",
      },
      {
        id: "headliner-14",
        type: "event",
        title: "Crew Reset Interlude",
        detail: "Short video montage covers wardrobe change and guitar swap.",
        duration: "1:30",
      },
      {
        id: "headliner-15",
        type: "song",
        title: "Glass Horizon",
        detail: "Holographic shards hover mid-air for chorus hits.",
        duration: "4:14",
      },
      {
        id: "headliner-16",
        type: "song",
        title: "Pulse Meridian",
        detail: "Lighting tracks mimic heartbeat visual across entire arena bowl.",
        duration: "3:47",
      },
      {
        id: "headliner-17",
        type: "song",
        title: "Arcade Testament",
        detail: "Guitar solo trades with keytar feature at center thrust.",
        duration: "4:36",
      },
      {
        id: "headliner-18",
        type: "song",
        title: "Starfall Thesis",
        detail: "Celestial lighting rig descends with glow-in-the-dark confetti.",
        duration: "5:02",
      },
      {
        id: "headliner-19",
        type: "song",
        title: "Encore: Infinite Glow",
        detail: "Final bow timed with crowd selfie sweep and sponsor bumper.",
        duration: "4:50",
      },
    ],
  },
  festivalHeadliner: {
    title: "Solar Heights Festival Close",
    locale: "Sunset main stages",
    description:
      "Twenty-two high-impact songs engineered to conquer festival sprawl and keep drop-in fans locked through the finale.",
    productionNotes: [
      "Drone pilot files updated flight plan for crowd-safe intro sweep.",
      "Hydration reminder for pit security before 'Monsoon Parade'.",
      "SFX crew stages CO₂ cannons on risers three minutes before encore run.",
    ],
    items: [
      {
        id: "festivalHeadliner-1",
        type: "event",
        title: "Sunset Countdown",
        detail: "Festival MC leads countdown as LED sky shifts to dusk palette.",
        duration: "1:15",
      },
      {
        id: "festivalHeadliner-2",
        type: "song",
        title: "Beacon Rush",
        detail: "Jet lights sweep the crowd while intro synth arpeggio builds.",
        duration: "3:42",
      },
      {
        id: "festivalHeadliner-3",
        type: "song",
        title: "Skyline Runway",
        detail: "Steady beat for audience jump cues; cameras capture crane shot.",
        duration: "3:55",
      },
      {
        id: "festivalHeadliner-4",
        type: "song",
        title: "Echo Rally",
        detail: "Call-and-response hooks aimed at casual passersby.",
        duration: "4:01",
      },
      {
        id: "festivalHeadliner-5",
        type: "song",
        title: "Monsoon Parade",
        detail: "Water curtain arcs over thrust; ensure tarps protect wedges.",
        duration: "4:18",
      },
      {
        id: "festivalHeadliner-6",
        type: "song",
        title: "Aurora Chase",
        detail: "Lighting rig cycles through aurora gradients to paint skyline.",
        duration: "4:10",
      },
      {
        id: "festivalHeadliner-7",
        type: "event",
        title: "Crowd Surf Camera",
        detail: "Steadicam follows inflatable camera rig over front rows.",
        duration: "0:55",
      },
      {
        id: "festivalHeadliner-8",
        type: "song",
        title: "Lightning Manifesto",
        detail: "Double-time bridge cues pyro jets at downbeat hits.",
        duration: "3:36",
      },
      {
        id: "festivalHeadliner-9",
        type: "song",
        title: "Heatwave Letters",
        detail: "Backup dancers deploy reflective flags for golden hour shimmer.",
        duration: "3:48",
      },
      {
        id: "festivalHeadliner-10",
        type: "song",
        title: "Metro Bloom",
        detail: "Visuals pulse city skyline silhouettes across LED towers.",
        duration: "4:06",
      },
      {
        id: "festivalHeadliner-11",
        type: "song",
        title: "Fathom Lines",
        detail: "Bass drop triggers low fog roll across front thrust.",
        duration: "4:14",
      },
      {
        id: "festivalHeadliner-12",
        type: "song",
        title: "Satellite Sprint",
        detail: "Drone swarm loops stage perimeter to mirror lyrical imagery.",
        duration: "3:58",
      },
      {
        id: "festivalHeadliner-13",
        type: "song",
        title: "Thunder Gallery",
        detail: "Percussive breakdown with synchronized lighting strikes.",
        duration: "4:09",
      },
      {
        id: "festivalHeadliner-14",
        type: "song",
        title: "Electric Relic",
        detail: "Holographic artifacts hover mid-air during chorus hits.",
        duration: "4:02",
      },
      {
        id: "festivalHeadliner-15",
        type: "song",
        title: "Starlit Drums",
        detail: "Auxiliary percussion joins for polyrhythmic finale section.",
        duration: "3:51",
      },
      {
        id: "festivalHeadliner-16",
        type: "song",
        title: "Desert Halo",
        detail: "Wide camera crane reveals crowd lantern wave at outro.",
        duration: "4:20",
      },
      {
        id: "festivalHeadliner-17",
        type: "song",
        title: "Arc Light Anthem",
        detail: "Sponsor shout recorded for festival screens before drop.",
        duration: "4:04",
      },
      {
        id: "festivalHeadliner-18",
        type: "song",
        title: "Neon Pilgrimage",
        detail: "Marching beat invites crowd clap-along; pyro hits final chorus.",
        duration: "4:11",
      },
      {
        id: "festivalHeadliner-19",
        type: "song",
        title: "Reactor Choir",
        detail: "Choir stems swell with panoramic LED choir imagery.",
        duration: "4:24",
      },
      {
        id: "festivalHeadliner-20",
        type: "song",
        title: "Ocean Static",
        detail: "Cool-down groove paired with misting fans along barricade.",
        duration: "4:00",
      },
      {
        id: "festivalHeadliner-21",
        type: "song",
        title: "Gravity Relay",
        detail: "Extended bridge gives lighting team space for gradient sweep.",
        duration: "4:16",
      },
      {
        id: "festivalHeadliner-22",
        type: "song",
        title: "Afterlight Hymn",
        detail: "Audience phone lights requested; drone captures aerial mosaic.",
        duration: "4:27",
      },
      {
        id: "festivalHeadliner-23",
        type: "song",
        title: "Summit Encore",
        detail: "Guitar duel on B-stage with confetti storm finale.",
        duration: "4:38",
      },
      {
        id: "festivalHeadliner-24",
        type: "song",
        title: "Infinite Spark",
        detail: "Final synth swell cues festival-wide fireworks cascade.",
        duration: "4:46",
      },
    ],
  },
  acoustic: {
    title: "Gallery Room Acoustic",
    locale: "Pop-up gallery sessions",
    description:
      "Eight unplugged staples crafted for storytelling stops, radio visits, and VIP lounges with zero production footprint.",
    productionNotes: [
      "FOH trims reverb for room slapback before 'Midnight Postcard'.",
      "Merch rep collects attendee dedications during 'Lantern Verse'.",
      "Photographer circles quietly during 'Encore: Candleline' to capture candle shots.",
    ],
    items: [
      {
        id: "acoustic-1",
        type: "song",
        title: "Quiet Signal",
        detail: "Soft vocal entrance asks crowd for complete silence.",
        duration: "3:22",
      },
      {
        id: "acoustic-2",
        type: "song",
        title: "Lantern Verse",
        detail: "Invite fans to share dedications before final chorus.",
        duration: "3:40",
      },
      {
        id: "acoustic-3",
        type: "song",
        title: "Midnight Postcard",
        detail: "Fingerpicked guitar with soft shaker loop for texture.",
        duration: "3:18",
      },
      {
        id: "acoustic-4",
        type: "event",
        title: "Story Swap Interlude",
        detail: "Artist recounts origin story and invites quick Q&A.",
        duration: "2:10",
      },
      {
        id: "acoustic-5",
        type: "song",
        title: "Horizon Sketch",
        detail: "Add gentle pad from looping pedal to widen chorus.",
        duration: "3:35",
      },
      {
        id: "acoustic-6",
        type: "song",
        title: "Vinyl Dust",
        detail: "Percussive strums keep tempo while cajón joins on second verse.",
        duration: "3:28",
      },
      {
        id: "acoustic-7",
        type: "song",
        title: "Window Seat Hymn",
        detail: "Harmonies stacked live with looping pedal build.",
        duration: "3:50",
      },
      {
        id: "acoustic-8",
        type: "event",
        title: "Audience Chorus",
        detail: "Teach simple harmony; capture clip for socials.",
        duration: "1:45",
      },
      {
        id: "acoustic-9",
        type: "song",
        title: "Amber Letters",
        detail: "Add violin guest if available; otherwise lean on vocal duet.",
        duration: "3:41",
      },
      {
        id: "acoustic-10",
        type: "song",
        title: "Encore: Candleline",
        detail: "Close with candlelight app glow, no amplification.",
        duration: "4:02",
      },
    ],
  },
};

const createNewItemState = (): Record<ShowType, NewItemForm> => {
  return showTabs.reduce((acc, tab) => {
    acc[tab.key] = {
      type: "song",
      title: "",
      detail: "",
      duration: "",
    };
    return acc;
  }, {} as Record<ShowType, NewItemForm>);
};

const createEditingState = () => {
  return showTabs.reduce((acc, tab) => {
    acc[tab.key] = false;
    return acc;
  }, {} as Record<ShowType, boolean>);
};

const reorderItems = (list: SetlistItem[], startIndex: number, endIndex: number) => {
  if (startIndex === endIndex) {
    return list;
  }

  const updated = [...list];
  const [moved] = updated.splice(startIndex, 1);
  const targetIndex = Math.max(0, Math.min(endIndex, updated.length));
  updated.splice(targetIndex, 0, moved);
  return updated;
};

export default function SetlistDesigner() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<ShowType>("act");
  const [setlists, setSetlists] = useState(initialSetlists);
  const [isEditing, setIsEditing] = useState<Record<ShowType, boolean>>(createEditingState);
  const [newItems, setNewItems] = useState<Record<ShowType, NewItemForm>>(createNewItemState);

  const handleToggleEditing = (showType: ShowType) => {
    setIsEditing((prev) => ({
      ...prev,
      [showType]: !prev[showType],
    }));
  };

  const handleAddItem = (showType: ShowType) => {
    const form = newItems[showType];
    if (!form.title.trim()) {
      return;
    }

    const detail = form.detail.trim();
    const duration = form.duration.trim();

    setSetlists((prev) => ({
      ...prev,
      [showType]: {
        ...prev[showType],
        items: [
          ...prev[showType].items,
          {
            id: `${showType}-${Date.now()}`,
            type: form.type,
            title: form.title.trim(),
            detail: detail || (form.type === "song" ? "Newly drafted track." : "Custom production cue."),
            duration: duration || undefined,
          },
        ],
      },
    }));

    setNewItems((prev) => ({
      ...prev,
      [showType]: {
        ...prev[showType],
        title: "",
        detail: "",
        duration: "",
      },
    }));
  };

  const handleMoveItem = (showType: ShowType, fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) {
      return;
    }

    setSetlists((prev) => ({
      ...prev,
      [showType]: {
        ...prev[showType],
        items: reorderItems(prev[showType].items, fromIndex, toIndex),
      },
    }));
  };

  const handleDrop = (
    event: DragEvent<HTMLLIElement | HTMLUListElement>,
    showType: ShowType,
    targetIndex: number,
  ) => {
    event.preventDefault();

    const payload = event.dataTransfer.getData("text/plain");
    if (!payload) {
      return;
    }

    const [originType, originIndex] = payload.split(":");
    const fromIndex = Number(originIndex);

    if (originType !== showType || Number.isNaN(fromIndex)) {
      return;
    }

    handleMoveItem(showType, fromIndex, targetIndex);
  };

  const handleDragStart = (
    event: DragEvent<HTMLLIElement>,
    showType: ShowType,
    index: number,
  ) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", `${showType}:${index}`);
  };

  const handleSave = (showType: ShowType) => {
    const list = setlists[showType];
    toast({
      title: `${list.title} saved`,
      description: `Captured ${list.items.length} cues · ${list.items.filter((item) => item.type === "song").length} songs & ${list.items.filter((item) => item.type === "event").length} production moments.`,
    });

    setIsEditing((prev) => ({
      ...prev,
      [showType]: false,
    }));
  };

  return (
    <div className="container mx-auto max-w-6xl px-4 py-10 space-y-8">
      <header className="space-y-4">
        <Badge variant="secondary" className="uppercase tracking-wider">
          Production Sandbox
        </Badge>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Setlist Designer</h1>
          <p className="text-muted-foreground max-w-3xl">
            Experiment with how Rockmundo keeps touring teams aligned. Sketch songs, drop in fan surprises, and rehearse the transitions that turn a night into a show.
          </p>
        </div>
      </header>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as ShowType)}
        className="space-y-6"
      >
        <TabsList className="grid w-full gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {showTabs.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key} className="flex flex-col gap-1 py-3">
              <span className="font-semibold">{tab.label}</span>
              <span className="text-xs font-normal text-muted-foreground">{tab.tagline}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {showTabs.map((tab) => {
          const list = setlists[tab.key];
          const editing = isEditing[tab.key];
          const formState = newItems[tab.key];
          const songCount = list.items.filter((item) => item.type === "song").length;
          const eventCount = list.items.length - songCount;

          return (
            <TabsContent key={tab.key} value={tab.key} className="space-y-6">
              <Card className="border-dashed border-border/60">
                <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge variant="outline" className="uppercase tracking-wide">
                        {list.locale}
                      </Badge>
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Music2 className="h-3.5 w-3.5" /> {songCount} songs
                      </Badge>
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Sparkles className="h-3.5 w-3.5" /> {eventCount} moments
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <CardTitle className="text-2xl">{list.title}</CardTitle>
                      <CardDescription>{list.description}</CardDescription>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" className="gap-2">
                          <Flame className="h-4 w-4" /> Production notes
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg">
                        <DialogHeader>
                          <DialogTitle>Production cues for {list.title}</DialogTitle>
                          <DialogDescription>
                            Quick reminders shared with lighting, pyro, and fan engagement teams during pre-production.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3">
                          {list.productionNotes.map((note, index) => (
                            <div key={index} className="rounded-lg border border-border/50 bg-muted/40 p-3 text-sm">
                              {note}
                            </div>
                          ))}
                        </div>
                      </DialogContent>
                    </Dialog>
                    <Button
                      variant={editing ? "secondary" : "outline"}
                      onClick={() => handleToggleEditing(tab.key)}
                    >
                      {editing ? "Done editing" : "Edit setlist"}
                    </Button>
                    <Button onClick={() => handleSave(tab.key)} className="gap-2">
                      <CalendarDays className="h-4 w-4" /> Save setlist
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="space-y-6">
                  <section className="space-y-3">
                    <header className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold">Running order</h2>
                        <p className="text-sm text-muted-foreground">
                          Drag to resequence or use the move controls for a keyboard-friendly edit pass.
                        </p>
                      </div>
                      <Badge variant="outline">{list.items.length} entries</Badge>
                    </header>

                    <ul
                      role="list"
                      className="space-y-3"
                      onDragOver={(event) => editing && event.preventDefault()}
                      onDrop={(event) => editing && handleDrop(event, tab.key, list.items.length)}
                    >
                      {list.items.map((item, index) => (
                        <li
                          key={item.id}
                          draggable={editing}
                          onDragStart={(event) => editing && handleDragStart(event, tab.key, index)}
                          onDragOver={(event) => {
                            if (editing) {
                              event.preventDefault();
                              event.dataTransfer.dropEffect = "move";
                            }
                          }}
                          onDrop={(event) => editing && handleDrop(event, tab.key, index)}
                          className={`group rounded-lg border border-border/60 bg-card/40 p-4 transition hover:border-primary ${
                            editing ? "cursor-move" : "cursor-default"
                          }`}
                          aria-roledescription="Reorderable setlist item"
                        >
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="flex gap-4">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
                                {index + 1}
                              </div>
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge
                                    variant={item.type === "song" ? "secondary" : "outline"}
                                    className={item.type === "event" ? "border-dashed" : undefined}
                                  >
                                    {item.type === "song" ? "Song" : "Production"}
                                  </Badge>
                                  <h3 className="text-base font-semibold text-foreground">
                                    {item.title}
                                  </h3>
                                </div>
                                <p className="text-sm text-muted-foreground">{item.detail}</p>
                                {item.duration && (
                                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                    Duration {item.duration}
                                  </p>
                                )}
                              </div>
                            </div>

                            {editing && (
                              <div className="flex flex-wrap items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleMoveItem(tab.key, index, index - 1)}
                                  disabled={index === 0}
                                >
                                  Move up
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleMoveItem(tab.key, index, index + 1)}
                                  disabled={index === list.items.length - 1}
                                >
                                  Move down
                                </Button>
                              </div>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>

                  {editing && (
                    <section className="space-y-4">
                      <Separator />
                      <header className="space-y-1">
                        <h2 className="text-lg font-semibold">Add to this set</h2>
                        <p className="text-sm text-muted-foreground">
                          Sketch new moments while routing teams lock final inputs. Everything stays in this preview until you export to the master routing doc.
                        </p>
                      </header>

                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <div className="space-y-2">
                          <Label htmlFor={`${tab.key}-type`}>Entry type</Label>
                          <Select
                            value={formState.type}
                            onValueChange={(value: SetlistItem["type"]) =>
                              setNewItems((prev) => ({
                                ...prev,
                                [tab.key]: { ...prev[tab.key], type: value },
                              }))
                            }
                          >
                            <SelectTrigger id={`${tab.key}-type`}>
                              <SelectValue placeholder="Choose type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="song">Song</SelectItem>
                              <SelectItem value="event">Production moment</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor={`${tab.key}-title`}>Title</Label>
                          <Input
                            id={`${tab.key}-title`}
                            placeholder={formState.type === "song" ? "New song title" : "Production cue name"}
                            value={formState.title}
                            onChange={(event) =>
                              setNewItems((prev) => ({
                                ...prev,
                                [tab.key]: { ...prev[tab.key], title: event.target.value },
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`${tab.key}-duration`}>Duration</Label>
                          <Input
                            id={`${tab.key}-duration`}
                            placeholder="4:00"
                            value={formState.duration}
                            onChange={(event) =>
                              setNewItems((prev) => ({
                                ...prev,
                                [tab.key]: { ...prev[tab.key], duration: event.target.value },
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-2 md:col-span-3">
                          <Label htmlFor={`${tab.key}-detail`}>Notes</Label>
                          <Textarea
                            id={`${tab.key}-detail`}
                            placeholder="Describe the vibe, lighting, or fan interaction"
                            value={formState.detail}
                            onChange={(event) =>
                              setNewItems((prev) => ({
                                ...prev,
                                [tab.key]: { ...prev[tab.key], detail: event.target.value },
                              }))
                            }
                          />
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <Button onClick={() => handleAddItem(tab.key)} disabled={!formState.title.trim()}>
                          Add to running order
                        </Button>
                      </div>
                    </section>
                  )}
                </CardContent>

                <CardFooter className="flex flex-col items-start gap-3 border-t border-dashed border-border/60 bg-muted/30 p-6 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
                  <span>
                    Draft stage for crews – final versions sync with routing calendars once approved.
                  </span>
                  <span>
                    {list.items.length} total entries · {songCount} songs · {eventCount} production cues
                  </span>
                </CardFooter>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
