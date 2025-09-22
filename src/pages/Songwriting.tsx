import { type FormEvent, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";

const themeOptions = [
  { value: "love", label: "Love & Relationships" },
  { value: "heartbreak", label: "Heartbreak & Healing" },
  { value: "growth", label: "Personal Growth" },
  { value: "party", label: "Party & Celebration" },
  { value: "society", label: "Social Commentary" },
  { value: "adventure", label: "Travel & Adventure" },
  { value: "dreams", label: "Dreams & Ambition" },
  { value: "resilience", label: "Resilience & Hope" },
] as const;

const genreOptions = [
  "Pop",
  "Rock",
  "Indie",
  "Electronic",
  "Hip-Hop",
  "R&B",
  "Country",
  "Folk",
] as const;

const progressionOptions = [
  "I–V–vi–IV",
  "ii–V–I",
  "vi–IV–I–V",
  "I–IV–V–IV",
  "iv–V–I",
] as const;

const Songwriting = () => {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [theme, setTheme] = useState<string | undefined>();
  const [lyrics, setLyrics] = useState("");
  const [genre, setGenre] = useState<string | undefined>();
  const [progression, setProgression] = useState<string | undefined>();

  const isCreateDisabled = useMemo(
    () =>
      !title.trim() ||
      !theme ||
      !genre ||
      !progression,
    [genre, progression, theme, title],
  );

  const selectedThemeLabel = useMemo(
    () => themeOptions.find((option) => option.value === theme)?.label,
    [theme],
  );

  const handleCreateSong = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isCreateDisabled) {
      return;
    }

    toast({
      title: "Song draft created",
      description: "Your songwriting blueprint has been generated.",
    });
  };

  const handleClear = () => {
    setTitle("");
    setTheme(undefined);
    setLyrics("");
    setGenre(undefined);
    setProgression(undefined);
  };

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Songwriting Workshop</h1>
        <p className="text-muted-foreground">
          Craft the next anthem by pairing strong themes, genre direction, and
          harmonic movement.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card asChild>
          <form onSubmit={handleCreateSong} className="space-y-6">
            <CardHeader>
              <CardTitle>Song Blueprint</CardTitle>
              <CardDescription>
                Define the creative direction of your track with focused inputs.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="song-title">Song Title</Label>
                <Input
                  id="song-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Enter a standout title"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="song-theme">Song Theme</Label>
                  <Select
                    value={theme}
                    onValueChange={setTheme}
                  >
                    <SelectTrigger id="song-theme">
                      <SelectValue placeholder="Select a core theme" />
                    </SelectTrigger>
                    <SelectContent>
                      {themeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="song-genre">Genre Direction</Label>
                  <Select value={genre} onValueChange={setGenre}>
                    <SelectTrigger id="song-genre">
                      <SelectValue placeholder="Choose a genre" />
                    </SelectTrigger>
                    <SelectContent>
                      {genreOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="song-progression">Chord Progression</Label>
                <Select
                  value={progression}
                  onValueChange={setProgression}
                >
                  <SelectTrigger id="song-progression">
                    <SelectValue placeholder="Select a harmonic map" />
                  </SelectTrigger>
                  <SelectContent>
                    {progressionOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Choose a classic progression to anchor your songwriting session.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="song-lyrics">Lyric Sketch</Label>
                <Textarea
                  id="song-lyrics"
                  value={lyrics}
                  onChange={(event) => setLyrics(event.target.value)}
                  placeholder="Capture hooks, verses, or imagery to explore later"
                  className="min-h-[140px]"
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={handleClear}>
                Clear
              </Button>
              <Button type="submit" disabled={isCreateDisabled}>
                Create Song
              </Button>
            </CardFooter>
          </form>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Live Summary</CardTitle>
            <CardDescription>
              Preview how your selections shape the songwriting brief.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                Title
              </p>
              <p className="text-lg font-semibold">
                {title.trim() || "Untitled Composition"}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {selectedThemeLabel ? (
                <Badge variant="secondary">{selectedThemeLabel}</Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  Theme pending
                </Badge>
              )}
              {genre ? (
                <Badge variant="secondary">{genre}</Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  Genre pending
                </Badge>
              )}
              {progression ? (
                <Badge variant="secondary">{progression}</Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  Progression pending
                </Badge>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Lyric Direction
              </p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {lyrics.trim() ||
                  "Use the lyric sketch to note imagery, emotional beats, or melodic cues."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Songwriting;
