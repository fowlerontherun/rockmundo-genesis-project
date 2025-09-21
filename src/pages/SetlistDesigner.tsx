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

type ShowType = "act" | "headliner" | "festivalHeadliner" | "acoustic";

const showTabs = [
  {
    key: "headliner" as const,
    label: "World Tour",
    tagline: "Stadium pacing with cinematic fan moments",
  },
  {
    key: "act" as const,
    label: "Arena Spectacle",
    tagline: "High-production arena night with synced visuals",
  },
  {
    key: "acoustic" as const,
    label: "Club Showcase",
    tagline: "Intimate rooms built around fan connection",
  },
  {
    key: "festivalHeadliner" as const,
    label: "Festival Circuit",
    tagline: "Rapid-fire festival slots with headline punch",
  },
] satisfies ReadonlyArray<{ key: ShowType; label: string; tagline: string }>;

const SONG_LIMITS: Record<ShowType, number> = {
  act: 5,
  headliner: 16,
  festivalHeadliner: 22,
  acoustic: 8,
};

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

export const initialSetlists: Record<ShowType, SetlistBlueprint> = {
  headliner: {
    title: "World Tour Kickoff",
    locale: "Continental stadium route",
    description:
      "Brings the stadium crowd from cinematic build to euphoric finale. Designed for immersive visuals and surprise fan dedications.",
    productionNotes: [
      "Pyro cues fire at 00:42 of Skyline Anthem. Ensure fire marshal sign-off before doors.",
      "Drone wall capture scheduled between tracks 3 and 4 for social stream.",
      "Fan dedication spotlight during 'Echoes of the City' – crew ready hand-held cameras.",
    ],
    items: [
      {
        id: "tour-1",
        type: "song",
        title: "Skyline Anthem",
        detail: "Explosive opener paired with stadium-wide pyro burst.",
        duration: "5:20",
      },
      {
        id: "tour-2",
        type: "event",
        title: "Fireworks Cascade",
        detail: "Fire curtain descends on final chorus with synchronized flame jets.",
        duration: "1:00",
      },
      {
        id: "tour-3",
        type: "song",
        title: "Echoes of the City",
        detail: "Fan dedication moment with roaming camera spotlight segments.",
        duration: "4:45",
      },
      {
        id: "tour-4",
        type: "event",
        title: "Crowd Wave",
        detail: "Interactive wave triggered via app push and lighting sweep.",
        duration: "0:45",
      },
      {
        id: "tour-5",
        type: "song",
        title: "Neon Rebellion",
        detail: "Synth-driven mid-set boost with laser choreography.",
        duration: "3:58",
      },
      {
        id: "tour-6",
        type: "song",
        title: "Stars Without Gravity",
        detail: "Encore ballad closing with confetti and augmented reality overlays.",
        duration: "6:10",
      },
    ],
  },
  act: {
    title: "Arena Pulse Sequence",
    locale: "Major market arenas",
    description:
      "Balances massive choruses with set-piece production so touring crews can rehearse transitions before automation locks in.",
    productionNotes: [
      "Followspot track rehearsal required pre-show for 'Silver Fuse'.",
      "Confetti reload after 'Voltage Drop' – stagehands 3 & 4 assigned.",
      "VIP riser meet & greet slot inserted before encore for sponsor content.",
    ],
    items: [
      {
        id: "arena-1",
        type: "song",
        title: "Voltage Drop",
        detail: "Opening guitar riff timed with LED wall flash and spark shower.",
        duration: "4:12",
      },
      {
        id: "arena-2",
        type: "song",
        title: "Silver Fuse",
        detail: "Crowd sing-along moment, encourage wristband color chase.",
        duration: "3:50",
      },
      {
        id: "arena-3",
        type: "event",
        title: "Laser Mosaic",
        detail: "360° light grid shifts to match choreography beat drops.",
        duration: "0:55",
      },
      {
        id: "arena-4",
        type: "song",
        title: "Gravity Wells",
        detail: "Rhythmic breakdown with percussive lighting stabs.",
        duration: "4:05",
      },
      {
        id: "arena-5",
        type: "event",
        title: "Fan Bridge Walk",
        detail: "Singer crosses B-stage bridge, invites fan for chorus cameo.",
        duration: "1:15",
      },
      {
        id: "arena-6",
        type: "song",
        title: "Hearts Awake",
        detail: "Finale confetti toss and pyro sparkle wall.",
        duration: "5:02",
      },
    ],
  },
  acoustic: {
    title: "Club Residency Flow",
    locale: "500-cap rooms",
    description:
      "Strips production back to raw energy, focusing on fan stories, tight transitions, and merch moments between encores.",
    productionNotes: [
      "Soundcheck doubles as meet & greet; crew to capture acoustic clip for socials.",
      "Merch drop announcement between tracks 2 and 3 via host.",
      "Staff ready polaroids for fan photo wall near exit.",
    ],
    items: [
      {
        id: "club-1",
        type: "song",
        title: "Midnight Arcade",
        detail: "Ambient intro blends into crowd chant to spark intimacy.",
        duration: "3:40",
      },
      {
        id: "club-2",
        type: "event",
        title: "Fan Story Spotlight",
        detail: "Short fan story shared on stage with acoustic riff underscoring.",
        duration: "2:00",
      },
      {
        id: "club-3",
        type: "song",
        title: "Velvet Static",
        detail: "Call-and-response chorus invites crowd harmonies.",
        duration: "4:08",
      },
      {
        id: "club-4",
        type: "song",
        title: "Basement Echo",
        detail: "Percussion-heavy breakdown with handheld lighting rigs.",
        duration: "3:15",
      },
      {
        id: "club-5",
        type: "event",
        title: "Merch Moment",
        detail: "Exclusive poster reveal with QR code projected on curtain.",
        duration: "1:05",
      },
      {
        id: "club-6",
        type: "song",
        title: "Singularity",
        detail: "Stripped-down encore featuring unplugged instrumentation.",
        duration: "4:30",
      },
    ],
  },
  festivalHeadliner: {
    title: "Sunrise Festival Sprint",
    locale: "Outdoor main stages",
    description:
      "Optimized for 45-minute headline slots that must hook casual passersby while rewarding core fans with signature closers.",
    productionNotes: [
      "Sunrise drone intro scheduled for golden hour – coordinate with festival ops.",
      "Hydrate crew before 'Desert Bloom' pyro due to high heat index.",
      "Crowd capture team rotates downstage left for 'Wild Horizon' confetti hit.",
    ],
    items: [
      {
        id: "festival-1",
        type: "event",
        title: "Dawn Intro Reel",
        detail: "LED sunrise animation synced with drone flyover.",
        duration: "1:10",
      },
      {
        id: "festival-2",
        type: "song",
        title: "Wild Horizon",
        detail: "Punchy opener targeted to hook festival roamers immediately.",
        duration: "3:55",
      },
      {
        id: "festival-3",
        type: "song",
        title: "Glass Rivers",
        detail: "Mid-set anthem with CO₂ cannons and call-back chorus.",
        duration: "4:25",
      },
      {
        id: "festival-4",
        type: "event",
        title: "Fan Cam Rush",
        detail: "Camera crew surges barricade for massive crowd pan.",
        duration: "0:50",
      },
      {
        id: "festival-5",
        type: "song",
        title: "Desert Bloom",
        detail: "Pyro arcs line the thrust as dusk lighting hits.",
        duration: "4:40",
      },
      {
        id: "festival-6",
        type: "song",
        title: "Gravity Anthem",
        detail: "Finale drop timed with festival-wide confetti burst.",
        duration: "5:05",
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

const createEditingState = (overrides?: Partial<Record<ShowType, boolean>>) => {
  return showTabs.reduce((acc, tab) => {
    acc[tab.key] = overrides?.[tab.key] ?? false;
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

type SetlistDesignerProps = {
  initialState?: Record<ShowType, SetlistBlueprint>;
  initialEditing?: Partial<Record<ShowType, boolean>>;
  initialActiveTab?: ShowType;
};

export default function SetlistDesigner({
  initialState,
  initialEditing,
  initialActiveTab,
}: SetlistDesignerProps = {}) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<ShowType>(initialActiveTab ?? "headliner");
  const [setlists, setSetlists] = useState(initialState ?? initialSetlists);
  const [isEditing, setIsEditing] = useState<Record<ShowType, boolean>>(() =>
    createEditingState(initialEditing),
  );
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

    const currentSongCount = setlists[showType].items.filter((item) => item.type === "song").length;
    const songLimit = SONG_LIMITS[showType];

    if (form.type === "song" && currentSongCount >= songLimit) {
      const tabLabel = showTabs.find((tab) => tab.key === showType)?.label ?? "This set";

      toast({
        title: "Song limit reached",
        description: `${tabLabel} can feature up to ${songLimit} songs. Convert the new idea to a production moment or remove a track before adding another song.`,
        variant: "destructive",
      });
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
          const songLimit = SONG_LIMITS[tab.key];
          const remainingSongSlots = Math.max(0, songLimit - songCount);
          const songLimitReached = songCount >= songLimit;

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

                      <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border/60 bg-muted/30 p-4 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-1 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <span>Song limit</span>
                            <Badge variant="outline" className="font-semibold">
                              {songLimit}
                            </Badge>
                            <Badge variant="secondary" className="font-semibold">
                              {songCount}/{songLimit}
                            </Badge>
                          </div>
                          <p className={songLimitReached ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
                            {songLimitReached
                              ? "Song limit reached. Convert the next addition to a production moment or remove a track to free up space."
                              : `${remainingSongSlots} song slot${remainingSongSlots === 1 ? "" : "s"} remaining in this set.`}
                          </p>
                        </div>
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
