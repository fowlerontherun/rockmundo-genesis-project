import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useToast } from "@/components/ui/use-toast";
import { usePlayerStatus } from "@/hooks/usePlayerStatus";
import { ACTIVITY_STATUS_DURATIONS } from "@/utils/gameBalance";
import { formatDurationMinutes } from "@/utils/datetime";

const themes = [
  { value: "love", label: "Love" },
  { value: "loss", label: "Loss" },
  { value: "desire", label: "Desire" },
  { value: "rebellion", label: "Rebellion" },
  { value: "escapism", label: "Escapism" },
  { value: "nostalgia", label: "Nostalgia" },
  { value: "pain", label: "Pain" },
  { value: "aspiration", label: "Aspiration" },
];

const genres = [
  "Pop",
  "Rock",
  "Indie",
  "Electronic",
  "Hip-Hop",
  "R&B",
  "Country",
  "Folk",
];

const chordProgressions = [
  "I–V–vi–IV",
  "ii–V–I",
  "vi–IV–I–V",
  "I–IV–V–IV",
  "iv–V–I",
];

const Songwriting = () => {
  const [title, setTitle] = useState("");
  const [theme, setTheme] = useState("");
  const [genre, setGenre] = useState("");
  const [chordProgression, setChordProgression] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const { toast } = useToast();
  const { startTimedStatus } = usePlayerStatus();

  const isFormReady = Boolean(title.trim() && theme && genre && chordProgression);

  const summary = useMemo(
    () => ({
      title: title.trim() || "Untitled idea",
      theme: theme ? themes.find((item) => item.value === theme)?.label ?? theme : "Select a theme to get started",
      genre: genre || "Choose a genre to define the sound",
      chordProgression: chordProgression || "Pick a chord progression to shape the mood",
      lyrics: lyrics.trim() || "Add optional lyric sketches when inspiration strikes.",
    }),
    [title, theme, genre, chordProgression, lyrics],
  );

  const handleSave = () => {
    if (!isFormReady) return;
    setLastSavedAt(new Date().toLocaleString());
    const songwritingDurationMinutes = ACTIVITY_STATUS_DURATIONS.songwritingSession;
    startTimedStatus({
      status: "Songwriting",
      durationMinutes: songwritingDurationMinutes,
      metadata: {
        title: title.trim() || "Untitled idea",
        genre,
        source: "songwriting_lab",
      },
    });
    const songwritingDurationLabel = formatDurationMinutes(
      songwritingDurationMinutes,
    );

    toast({
      title: "Songwriting saved",
      description: `Songwriting stays active for about ${songwritingDurationLabel}. Keep refining your idea.`,
    });
  };

  const handleClear = () => {
    setTitle("");
    setTheme("");
    setGenre("");
    setChordProgression("");
    setLyrics("");
    setLastSavedAt(null);
  };

  return (
    <div className="container mx-auto px-4 py-10 space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Songwriting Lab</h1>
        <p className="text-muted-foreground">
          Capture the core ingredients of your next anthem. Lock in the vibe, outline the theme, and draft lyrics when
          inspiration hits.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Idea builder</CardTitle>
            <CardDescription>Required fields help anchor the direction of the song.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="song-title">Song title</Label>
              <Input
                id="song-title"
                placeholder="Give your song a working title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Theme (required)</Label>
              <Select value={theme} onValueChange={setTheme}>
                <SelectTrigger id="song-theme" aria-label="Select a theme">
                  <SelectValue placeholder="Choose a theme" />
                </SelectTrigger>
                <SelectContent>
                  {themes.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Genre (required)</Label>
              <Select value={genre} onValueChange={setGenre}>
                <SelectTrigger id="song-genre" aria-label="Select a genre">
                  <SelectValue placeholder="Select a genre" />
                </SelectTrigger>
                <SelectContent>
                  {genres.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Chord progression (required)</Label>
              <Select value={chordProgression} onValueChange={setChordProgression}>
                <SelectTrigger id="song-progression" aria-label="Select a chord progression">
                  <SelectValue placeholder="Choose a progression" />
                </SelectTrigger>
                <SelectContent>
                  {chordProgressions.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="song-lyrics">Lyrics (optional)</Label>
                <span className="text-xs text-muted-foreground">Use this area for freeform notes.</span>
              </div>
              <Textarea
                id="song-lyrics"
                placeholder="Jot down hooks, verses, or imagery — or leave blank for now."
                value={lyrics}
                onChange={(event) => setLyrics(event.target.value)}
                className="min-h-[160px]"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-wrap gap-3">
            <Button type="button" onClick={handleSave} disabled={!isFormReady}>
              Save idea
            </Button>
            <Button type="button" variant="outline" onClick={handleClear}>
              Clear fields
            </Button>
            <p className="text-sm text-muted-foreground">
              {isFormReady
                ? "Fill in the optional lyrics whenever you’re ready to flesh out the story."
                : "Complete the required selections above to enable saving."}
            </p>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>

            <CardTitle>Creative snapshot</CardTitle>
            <CardDescription>Preview of the current direction for this song idea.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Title</p>
              <p className="text-base font-medium text-foreground">{summary.title}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Theme</p>
              <p className="text-foreground">{summary.theme}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Genre</p>
              <p className="text-foreground">{summary.genre}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Chord progression</p>
              <p className="text-foreground">{summary.chordProgression}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Lyrics sketch</p>
              <p className="text-muted-foreground whitespace-pre-line">{summary.lyrics}</p>
            </div>
          </CardContent>
          {lastSavedAt && (
            <CardFooter>
              <p className="text-xs text-muted-foreground">Last saved {lastSavedAt}</p>
            </CardFooter>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Songwriting;
