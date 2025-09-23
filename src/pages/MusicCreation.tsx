
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PenSquare, Wand2, Clock, Music, Sparkles, ListMusic, Trash2 } from "lucide-react";

const lyricPrompts = [
  "An anthem about leaving a safe hometown for the unknown lights of the city.",
  "A late-night confession to the one person who has always been in your corner.",
  "A post-show rush where the crowd keeps echoing the chorus back at you.",
  "A letter to your younger self that never stopped writing songs in their bedroom.",
  "A cinematic build that goes from whispered verse to a sky-shaking hook.",
];

const hookIdeas = [
  "Keep the lights on, I'm still chasing this feeling.",
  "If the world ends tonight, we'll go out singing.",
  "We're the wildfire dancing through the rain.",
  "Your name is the line that keeps returning.",
  "Turn the amps up loud, we'll outrun the doubts.",
];

const storyBeats = [
  "Verse 1 introduces the nightly grind of rehearsals and empty rooms.",
  "Pre-chorus sparks tension with a phone call offering a once-in-a-lifetime slot.",
  "Chorus celebrates the moment you finally step onto the main stage.",
  "Verse 2 reflects on the band's history and promises you made to each other.",
  "Bridge slows everything down for a vulnerable spotlight moment.",
];

const moods = ["Anthemic", "Brooding", "Dreamy", "Euphoric", "Gritty", "Hopeful", "Moody", "Triumphant"] as const;
const energyLevels = ["Low", "Dynamic", "High"] as const;
const songKeys = [
  "C Major",
  "G Major",
  "D Major",
  "A Major",
  "E Major",
  "F Major",
  "A Minor",
  "E Minor",
  "D Minor",
  "B Minor",
];

type SongSectionId = "verse" | "preChorus" | "chorus" | "bridge" | "breakdown" | "solo" | "outro";

interface SongSectionDefinition {
  id: SongSectionId;
  name: string;
  description: string;
  estimatedSeconds: number;
}

const songSections: SongSectionDefinition[] = [
  {
    id: "verse",
    name: "Verse",
    description: "Build the story and set the scene with detail-rich imagery.",
    estimatedSeconds: 45,
  },
  {
    id: "preChorus",
    name: "Pre-Chorus",
    description: "Tighten the tension and lead listeners into the hook.",
    estimatedSeconds: 20,
  },
  {
    id: "chorus",
    name: "Chorus",
    description: "Deliver the main message that everyone will sing back.",
    estimatedSeconds: 35,
  },
  {
    id: "bridge",
    name: "Bridge",
    description: "Flip the perspective or unleash an emotional twist.",
    estimatedSeconds: 30,
  },
  {
    id: "breakdown",
    name: "Breakdown",
    description: "Strip the production back for contrast and intimacy.",
    estimatedSeconds: 25,
  },
  {
    id: "solo",
    name: "Solo",
    description: "Let an instrument shine and reinforce the melodic theme.",
    estimatedSeconds: 25,
  },
  {
    id: "outro",
    name: "Outro",
    description: "Leave a lingering echo or final lyrical statement.",
    estimatedSeconds: 25,
  },
];

const sectionById = songSections.reduce<Record<SongSectionId, SongSectionDefinition>>((acc, section) => {
  acc[section.id] = section;
  return acc;
}, {} as Record<SongSectionId, SongSectionDefinition>);

const defaultStructure: SongSectionId[] = [
  "verse",
  "preChorus",
  "chorus",
  "verse",
  "preChorus",
  "chorus",
  "bridge",
  "chorus",
];

const getRandomItem = (items: string[]) => items[Math.floor(Math.random() * items.length)];

const MusicCreation = () => {
  const [lyrics, setLyrics] = useState("");
  const [tempo, setTempo] = useState(96);
  const [key, setKey] = useState<string>(songKeys[0]);
  const [mood, setMood] = useState<(typeof moods)[number]>("Anthemic");
  const [energy, setEnergy] = useState<(typeof energyLevels)[number]>("Dynamic");
  const [selectedSection, setSelectedSection] = useState<SongSectionId>("verse");
  const [structure, setStructure] = useState<SongSectionId[]>(defaultStructure);
  const [prompts, setPrompts] = useState({
    lyric: lyricPrompts[0],
    hook: hookIdeas[0],
    story: storyBeats[0],
  });

  const wordCount = useMemo(() => {
    if (!lyrics.trim()) {
      return 0;
    }
    return lyrics.trim().split(/\s+/).length;
  }, [lyrics]);

  const lineCount = useMemo(() => {
    if (!lyrics.trim()) {
      return 0;
    }
    return lyrics.trim().split(/\n/).length;
  }, [lyrics]);

  const estimatedDurationMinutes = useMemo(() => {
    const totalSeconds = structure.reduce((sum, sectionId) => sum + sectionById[sectionId].estimatedSeconds, 0);
    return Math.max(2, Math.round((totalSeconds / 60) * 10) / 10);
  }, [structure]);

  const structureSummary = useMemo(() => {
    return structure.reduce<Record<string, number>>((acc, sectionId) => {
      const keyName = sectionById[sectionId].name;
      acc[keyName] = (acc[keyName] ?? 0) + 1;
      return acc;
    }, {});
  }, [structure]);

  const updatePrompt = (type: keyof typeof prompts) => {
    if (type === "lyric") {
      setPrompts((prev) => ({ ...prev, lyric: getRandomItem(lyricPrompts) }));
    } else if (type === "hook") {
      setPrompts((prev) => ({ ...prev, hook: getRandomItem(hookIdeas) }));
    } else {
      setPrompts((prev) => ({ ...prev, story: getRandomItem(storyBeats) }));
    }
  };

  const handleAddSection = () => {
    setStructure((prev) => [...prev, selectedSection]);
  };

  const handleRemoveSection = (index: number) => {
    setStructure((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleEnergyChange = (value: string) => {
    if (energyLevels.includes(value as (typeof energyLevels)[number])) {
      setEnergy(value as (typeof energyLevels)[number]);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-stage p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-4xl font-bold text-foreground">Songwriting Studio</h1>
          <p className="text-lg text-muted-foreground">
            Shape your next release with guided prompts, structured sections, and lyrical tools.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="space-y-2 p-4">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Word Count</span>
                <PenSquare className="h-4 w-4" />
              </div>
              <p className="text-2xl font-semibold">{wordCount}</p>
              <p className="text-xs text-muted-foreground">Keep verses around 80–120 words for clarity.</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-2 p-4">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Sections</span>
                <ListMusic className="h-4 w-4" />
              </div>
              <p className="text-2xl font-semibold">{structure.length}</p>
              <p className="text-xs text-muted-foreground">Balance repetition with one standout twist.</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-2 p-4">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Estimated Length</span>
                <Clock className="h-4 w-4" />
              </div>
              <p className="text-2xl font-semibold">{estimatedDurationMinutes.toFixed(1)} min</p>
              <p className="text-xs text-muted-foreground">Aim between 2.5 – 4 minutes for radio-friendly cuts.</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-2 p-4">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Tempo</span>
                <Music className="h-4 w-4" />
              </div>
              <div className="flex items-baseline gap-2">
                <Input
                  type="number"
                  min={60}
                  max={180}
                  value={tempo}
                  onChange={(event) => setTempo(Number(event.target.value) || 0)}
                  className="w-20"
                  aria-label="Tempo in beats per minute"
                />
                <span className="text-sm text-muted-foreground">BPM</span>
              </div>
              <p className="text-xs text-muted-foreground">Most rock anthems thrive between 90 and 130 BPM.</p>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Lyric Notebook</CardTitle>
              <CardDescription>Capture verses, choruses, and stray lines in one focused workspace.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={lyrics}
                onChange={(event) => setLyrics(event.target.value)}
                placeholder="Verse 1\nPaint the scene with details, emotions, and movement..."
                className="min-h-[220px] resize-y"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  {lineCount} {lineCount === 1 ? "line" : "lines"} · {wordCount} {wordCount === 1 ? "word" : "words"}
                </span>
                <Button variant="ghost" size="sm" onClick={() => setLyrics("")}>
                  Clear notebook
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Creative Direction</CardTitle>
              <CardDescription>Lock in the vibe to guide production choices later.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mood">Primary Mood</Label>
                <Select value={mood} onValueChange={(value) => setMood(value as (typeof moods)[number])}>
                  <SelectTrigger id="mood">
                    <SelectValue placeholder="Choose a mood" />
                  </SelectTrigger>
                  <SelectContent>
                    {moods.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="energy">Energy Profile</Label>
                <Select value={energy} onValueChange={handleEnergyChange}>
                  <SelectTrigger id="energy">
                    <SelectValue placeholder="Select energy" />
                  </SelectTrigger>
                  <SelectContent>
                    {energyLevels.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="key">Song Key</Label>
                <Select value={key} onValueChange={setKey}>
                  <SelectTrigger id="key">
                    <SelectValue placeholder="Select key" />
                  </SelectTrigger>
                  <SelectContent>
                    {songKeys.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-primary/10 bg-background/60 p-3">
                  <p className="text-xs text-muted-foreground">Mood</p>
                  <p className="text-lg font-semibold">{mood}</p>
                </div>
                <div className="rounded-lg border border-primary/10 bg-background/60 p-3">
                  <p className="text-xs text-muted-foreground">Energy</p>
                  <p className="text-lg font-semibold">{energy}</p>
                </div>
                <div className="rounded-lg border border-primary/10 bg-background/60 p-3">
                  <p className="text-xs text-muted-foreground">Key</p>
                  <p className="text-lg font-semibold">{key}</p>
                </div>
                <div className="rounded-lg border border-primary/10 bg-background/60 p-3">
                  <p className="text-xs text-muted-foreground">Tempo</p>
                  <p className="text-lg font-semibold">{tempo} BPM</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Arrange Your Sections</CardTitle>
              <CardDescription>Build a roadmap before heading into the studio.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[180px] flex-1 space-y-2">
                  <Label htmlFor="section">Add Section</Label>
                  <Select value={selectedSection} onValueChange={(value) => setSelectedSection(value as SongSectionId)}>
                    <SelectTrigger id="section">
                      <SelectValue placeholder="Select a section" />
                    </SelectTrigger>
                    <SelectContent>
                      {songSections.map((section) => (
                        <SelectItem key={section.id} value={section.id}>
                          {section.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="button" onClick={handleAddSection} className="self-end">
                  Add to arrangement
                </Button>
              </div>

              <div className="space-y-3">
                {structure.map((sectionId, index) => {
                  const definition = sectionById[sectionId];
                  return (
                    <div
                      key={`${sectionId}-${index}`}
                      className="flex items-center justify-between rounded-lg border border-primary/10 bg-background/80 px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="h-7 w-7 items-center justify-center rounded-full p-0 text-sm">
                          {index + 1}
                        </Badge>
                        <div>
                          <p className="font-semibold">{definition.name}</p>
                          <p className="text-xs text-muted-foreground">{definition.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">~{definition.estimatedSeconds}s</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveSection(index)}
                          aria-label={`Remove ${definition.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {Object.entries(structureSummary).map(([name, count]) => (
                  <Badge key={name} variant="outline" className="border-dashed">
                    {name}: {count}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Prompt Generator</CardTitle>
              <CardDescription>Shuffle new angles whenever you feel stuck.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Lyric Prompt</h3>
                  <Button variant="ghost" size="sm" onClick={() => updatePrompt("lyric")}>
                    <Wand2 className="mr-2 h-4 w-4" />Shuffle
                  </Button>
                </div>
                <p className="rounded-lg border border-primary/10 bg-background/80 p-3 text-sm leading-relaxed">
                  {prompts.lyric}
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Hook Idea</h3>
                  <Button variant="ghost" size="sm" onClick={() => updatePrompt("hook")}>
                    <Wand2 className="mr-2 h-4 w-4" />Shuffle
                  </Button>
                </div>
                <p className="rounded-lg border border-primary/10 bg-background/80 p-3 text-sm leading-relaxed">
                  {prompts.hook}
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Story Beat</h3>
                  <Button variant="ghost" size="sm" onClick={() => updatePrompt("story")}>
                    <Wand2 className="mr-2 h-4 w-4" />Shuffle
                  </Button>
                </div>
                <p className="rounded-lg border border-primary/10 bg-background/80 p-3 text-sm leading-relaxed">
                  {prompts.story}
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card className="border-dashed border-primary/40">
            <CardHeader>
              <CardTitle>Ready for Production?</CardTitle>
              <CardDescription>Send your concept into the full Song Manager workflow.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                When your structure, lyrics, and direction feel locked, move into the Song Manager to handle recording sessions,
                marketing budgets, and release schedules.
              </p>
              <Button asChild className="gap-2">
                <Link to="/songs">
                  Open Song Manager
                  <Music className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Session Checklist</CardTitle>
              <CardDescription>Make sure you and the band are dialed before tracking.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <div className="rounded-lg border border-primary/10 bg-background/70 p-3">
                <p className="font-medium">Rhythm Section Locked</p>
                <p className="text-xs text-muted-foreground">Confirm groove, key changes, and dynamic builds.</p>
              </div>
              <div className="rounded-lg border border-primary/10 bg-background/70 p-3">
                <p className="font-medium">Lyric Consensus</p>
                <p className="text-xs text-muted-foreground">Share final draft with collaborators for approvals.</p>
              </div>
              <div className="rounded-lg border border-primary/10 bg-background/70 p-3">
                <p className="font-medium">Reference Tracks</p>
                <p className="text-xs text-muted-foreground">Queue 2–3 sonic references to align the production vibe.</p>
              </div>
              <div className="rounded-lg border border-primary/10 bg-background/70 p-3">
                <p className="font-medium">Studio Logistics</p>
                <p className="text-xs text-muted-foreground">Confirm schedule, session musicians, and gear needs.</p>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
};

export default MusicCreation;
