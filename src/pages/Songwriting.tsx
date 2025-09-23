import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { Progress } from "@/components/ui/progress";

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

const genres = ["Pop", "Rock", "Indie", "Electronic", "Hip-Hop", "R&B", "Country", "Folk"];

const chordProgressions = ["I–V–vi–IV", "ii–V–I", "vi–IV–I–V", "I–IV–V–IV", "iv–V–I"];

const BLOCK_DURATION_MINUTES = 15;
const MAX_WRITING_MINUTES = 180;
const BLOCK_DURATION_MS = BLOCK_DURATION_MINUTES * 60 * 1000;
const TOTAL_BLOCKS = MAX_WRITING_MINUTES / BLOCK_DURATION_MINUTES;

const computeQualityScore = (minutesSpent: number) =>
  Math.min(5000, Math.round((minutesSpent / MAX_WRITING_MINUTES) * 5000));

const formatTime = (milliseconds: number) => {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
};

const Songwriting = () => {
  const [title, setTitle] = useState("");
  const [theme, setTheme] = useState("");
  const [genre, setGenre] = useState("");
  const [chordProgression, setChordProgression] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const [isSongCreated, setIsSongCreated] = useState(false);
  const [minutesSpent, setMinutesSpent] = useState(0);
  const [qualityScore, setQualityScore] = useState(0);
  const [xpEarned, setXpEarned] = useState(0);
  const [songCompleted, setSongCompleted] = useState(false);
  const [completionAwarded, setCompletionAwarded] = useState(false);

  const [isWriting, setIsWriting] = useState(false);
  const [writingStartTime, setWritingStartTime] = useState<number | null>(null);
  const [writingElapsed, setWritingElapsed] = useState(0);

  const writingIntervalRef = useRef<ReturnType<typeof window.setInterval> | null>(null);
  const writingTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  const isFormReady = Boolean(title.trim() && theme && genre && chordProgression);

  const totalMinutesWithActiveBlock = useMemo(() => {
    if (!isWriting || !writingStartTime) {
      return minutesSpent;
    }

    const elapsedRatio = Math.min(writingElapsed / BLOCK_DURATION_MS, 1);
    return minutesSpent + elapsedRatio * BLOCK_DURATION_MINUTES;
  }, [isWriting, writingElapsed, writingStartTime, minutesSpent]);

  const progressValue = useMemo(
    () => Math.min(100, (totalMinutesWithActiveBlock / MAX_WRITING_MINUTES) * 100),
    [totalMinutesWithActiveBlock],
  );

  const writingCountdown = useMemo(
    () => formatTime(BLOCK_DURATION_MS - Math.min(writingElapsed, BLOCK_DURATION_MS)),
    [writingElapsed],
  );

  const qualityDescriptor = useMemo(() => {
    if (!isSongCreated) {
      return "No song started yet";
    }

    if (songCompleted) {
      return "Studio Masterpiece";
    }

    if (minutesSpent === 0) {
      return "Concept Sketch";
    }

    const qualityRatio = qualityScore / 5000;

    if (qualityRatio >= 0.8) {
      return "Radio Ready";
    }
    if (qualityRatio >= 0.6) {
      return "Polished Demo";
    }
    if (qualityRatio >= 0.4) {
      return "Emerging Groove";
    }
    if (qualityRatio >= 0.2) {
      return "Rough Draft";
    }

    return "Concept Sketch";
  }, [isSongCreated, minutesSpent, qualityScore, songCompleted]);

  const summary = useMemo(
    () => ({
      title: title.trim() || "Untitled idea",
      theme: theme ? themes.find((item) => item.value === theme)?.label ?? theme : "Select a theme to get started",
      genre: genre || "Choose a genre to define the sound",
      chordProgression: chordProgression || "Pick a chord progression to shape the mood",
      lyrics: lyrics.trim() || "Add optional lyric sketches when inspiration strikes.",
      minutesSpent,
      status: !isSongCreated ? "Awaiting creation" : songCompleted ? "Completed" : "In progress",
      xpEarned,
      qualityDescriptor,
    }),
    [title, theme, genre, chordProgression, lyrics, minutesSpent, isSongCreated, songCompleted, xpEarned, qualityDescriptor],
  );

  const clearWritingTimers = useCallback(() => {
    if (writingIntervalRef.current) {
      window.clearInterval(writingIntervalRef.current);
      writingIntervalRef.current = null;
    }
    if (writingTimeoutRef.current) {
      window.clearTimeout(writingTimeoutRef.current);
      writingTimeoutRef.current = null;
    }
  }, []);

  const handleBlockComplete = useCallback(() => {
    clearWritingTimers();
    setIsWriting(false);
    setWritingStartTime(null);
    setWritingElapsed(0);

    setMinutesSpent((previous) => {
      const updatedMinutes = Math.min(previous + BLOCK_DURATION_MINUTES, MAX_WRITING_MINUTES);
      const newQualityScore = computeQualityScore(updatedMinutes);
      setQualityScore(newQualityScore);

      setXpEarned((xp) => {
        let updatedXp = xp + 2;
        const reachedCompletion = updatedMinutes >= MAX_WRITING_MINUTES && !completionAwarded;
        if (reachedCompletion) {
          updatedXp += 3;
          setCompletionAwarded(true);
        }
        return updatedXp;
      });

      if (updatedMinutes >= MAX_WRITING_MINUTES) {
        setSongCompleted(true);
      }

      return updatedMinutes;
    });
  }, [clearWritingTimers, completionAwarded]);

  const handleSpendTime = useCallback(() => {
    if (!isSongCreated || isWriting || minutesSpent >= MAX_WRITING_MINUTES) {
      return;
    }

    const startTime = Date.now();
    setIsWriting(true);
    setWritingStartTime(startTime);
    setWritingElapsed(0);

    clearWritingTimers();

    writingIntervalRef.current = window.setInterval(() => {
      setWritingElapsed(Math.min(Date.now() - startTime, BLOCK_DURATION_MS));
    }, 1000);

    writingTimeoutRef.current = window.setTimeout(() => {
      handleBlockComplete();
    }, BLOCK_DURATION_MS);
  }, [clearWritingTimers, handleBlockComplete, isSongCreated, isWriting, minutesSpent]);

  useEffect(() => {
    return () => {
      clearWritingTimers();
    };
  }, [clearWritingTimers]);

  const handleCreateSong = () => {
    if (!isFormReady) {
      return;
    }

    setIsSongCreated(true);
    setLastSavedAt(new Date().toLocaleString());

    if (!songCompleted && minutesSpent > 0) {
      return;
    }

    setMinutesSpent(0);
    setQualityScore(0);
    setXpEarned(0);
    setSongCompleted(false);
    setCompletionAwarded(false);
    setIsWriting(false);
    setWritingStartTime(null);
    setWritingElapsed(0);
    clearWritingTimers();
  };

  const handleClear = () => {
    setTitle("");
    setTheme("");
    setGenre("");
    setChordProgression("");
    setLyrics("");
    setLastSavedAt(null);

    setIsSongCreated(false);
    setMinutesSpent(0);
    setQualityScore(0);
    setXpEarned(0);
    setSongCompleted(false);
    setCompletionAwarded(false);
    setIsWriting(false);
    setWritingStartTime(null);
    setWritingElapsed(0);
    clearWritingTimers();
  };

  const writingSessionsCompleted = minutesSpent / BLOCK_DURATION_MINUTES;

  const isSpendTimeDisabled = !isSongCreated || isWriting || minutesSpent >= MAX_WRITING_MINUTES;

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
            <Button type="button" onClick={handleCreateSong} disabled={!isFormReady}>
              {isSongCreated ? "Update song details" : "Create song"}
            </Button>
            <Button type="button" variant="outline" onClick={handleClear}>
              Clear fields
            </Button>
            <p className="text-sm text-muted-foreground">
              {isFormReady
                ? "Create the song to begin tracking writing time and quality."
                : "Complete the required selections above to enable creating the song."}
            </p>
          </CardFooter>
        </Card>

        <div className="flex flex-col gap-6">
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
                <p className="text-xs text-muted-foreground">Last updated {lastSavedAt}</p>
              </CardFooter>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Writing progress</CardTitle>
              <CardDescription>Real-time progress toward a finished song.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm font-medium">
                  <span>Writing completion</span>
                  <span>{Math.round(progressValue)}%</span>
                </div>
                <Progress value={progressValue} />
                <p className="text-xs text-muted-foreground">
                  {writingSessionsCompleted} / {TOTAL_BLOCKS} writing sessions logged ({Math.round(minutesSpent)} minutes of
                  {" "}
                  {MAX_WRITING_MINUTES}).
                </p>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Song status</span>
                  <span className="text-muted-foreground">{summary.status}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">Current quality</span>
                  <span className="text-muted-foreground">{summary.qualityDescriptor}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">XP earned here</span>
                  <span className="text-muted-foreground">{summary.xpEarned} XP</span>
                </div>
              </div>

              {isWriting ? (
                <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">
                  <p className="font-medium">Writing in progress</p>
                  <p className="text-muted-foreground">{writingCountdown} remaining in this 15-minute session.</p>
                </div>
              ) : (
                <div className="rounded-md border border-muted bg-muted/30 p-3 text-sm">
                  <p className="font-medium">
                    {songCompleted
                      ? "Song complete"
                      : isSongCreated
                        ? "Ready for the next 15-minute writing focus"
                        : "Create the song to start logging time"}
                  </p>
                  <p className="text-muted-foreground">
                    {songCompleted
                      ? "You've reached the three-hour cap. Additional writing will not increase quality."
                      : "Each focused 15-minute block boosts song quality and awards 2 XP."}
                  </p>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button type="button" onClick={handleSpendTime} disabled={isSpendTimeDisabled}>
                Spend 15 minutes writing
              </Button>
              <p className="text-xs text-muted-foreground text-center sm:text-right">
                Completing the song awards a bonus 3 XP on top of writing session gains.
              </p>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Songwriting;

