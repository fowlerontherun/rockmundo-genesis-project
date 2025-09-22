import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const WRITING_BLOCK_OPTIONS = [15, 30, 60];
const MAX_MINUTES = 180;

const calculateQuality = (minutes: number) => Math.min(5000, Math.round((minutes / MAX_MINUTES) * 5000));

const Songwriting = () => {
  const [isSongCreated, setIsSongCreated] = useState(false);
  const [minutesSpent, setMinutesSpent] = useState(0);
  const [qualityScore, setQualityScore] = useState(0);
  const [selectedBlock, setSelectedBlock] = useState<string>(WRITING_BLOCK_OPTIONS[0].toString());
  const [showDebug, setShowDebug] = useState(false);

  const progressPercent = Math.min(100, (minutesSpent / MAX_MINUTES) * 100);
  const displayProgress = Math.round(progressPercent);
  const isSongComplete = minutesSpent >= MAX_MINUTES;

  const qualityLabel = useMemo(() => {
    if (!isSongCreated) {
      return "Not Started";
    }

    const ratio = qualityScore / 5000;

    if (ratio === 0) return "Blank Page";
    if (ratio < 0.25) return "Rough Draft";
    if (ratio < 0.5) return "Finding the Hook";
    if (ratio < 0.75) return "Polished Demo";
    if (ratio < 1) return "Stage Ready";
    return "Studio Ready";
  }, [isSongCreated, qualityScore]);

  const handleCreateSong = () => {
    setIsSongCreated(true);
    setMinutesSpent(0);
    setQualityScore(0);
    setSelectedBlock(WRITING_BLOCK_OPTIONS[0].toString());
  };

  const handleSpendTime = () => {
    if (!isSongCreated) return;

    const blockValue = Number(selectedBlock);
    if (!blockValue) return;

    setMinutesSpent((previousMinutes) => {
      const nextMinutes = Math.min(MAX_MINUTES, previousMinutes + blockValue);
      setQualityScore(calculateQuality(nextMinutes));
      return nextMinutes;
    });
  };

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold">Songwriting</h1>
        <p className="text-muted-foreground">Craft your next hit by investing focused writing time.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Songwriting Session</CardTitle>
            <CardDescription>
              Create a new song and log your dedicated writing blocks until the session is complete.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-lg border border-dashed border-muted-foreground/40 bg-muted/20 p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">Song Status</p>
                  <p className="text-lg font-semibold">
                    {isSongCreated ? (isSongComplete ? "Songwriting complete" : "Song in progress") : "No song created"}
                  </p>
                </div>
                <Button variant={isSongCreated ? "secondary" : "default"} onClick={handleCreateSong}>
                  {isSongCreated ? "Start New Song" : "Create Song"}
                </Button>
              </div>
              {!isSongCreated && (
                <p className="mt-4 text-sm text-muted-foreground">
                  Create a song to begin writing immediately.
                </p>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Label htmlFor="writing-block">Writing block</Label>
                <Select
                  value={selectedBlock}
                  onValueChange={setSelectedBlock}
                  disabled={!isSongCreated || isSongComplete}
                >
                  <SelectTrigger id="writing-block" className="w-[200px]">
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                  <SelectContent>
                    {WRITING_BLOCK_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option.toString()}>
                        {option} minutes
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleSpendTime} disabled={!isSongCreated || isSongComplete}>
                Spend Time Writing
              </Button>
            </div>
          </CardContent>
          {isSongComplete && (
            <CardFooter>
              <p className="text-sm font-medium text-primary">
                You have logged the full 180 minutes. This song is ready for its next steps!
              </p>
            </CardFooter>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Session Summary</CardTitle>
            <CardDescription>Review progress and quality as the song evolves.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Writing Time Logged</p>
              <p className="text-2xl font-semibold">{minutesSpent} / {MAX_MINUTES} minutes</p>
            </div>

            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Song Quality</p>
              <p className="text-lg font-semibold">{qualityLabel}</p>
              <p className="text-xs text-muted-foreground">
                Quality grows as you invest more focused writing blocks. The exact score remains behind the scenes.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
                <span>Progress</span>
                <span>{displayProgress}%</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </div>

            <div className="rounded-lg border border-dashed border-muted-foreground/40 p-4">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="debug-toggle" className="text-sm">
                  Developer debug details
                </Label>
                <Switch id="debug-toggle" checked={showDebug} onCheckedChange={setShowDebug} />
              </div>
              {showDebug && (
                <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                  <p>Hidden quality score: {qualityScore} / 5000</p>
                  <p>Completion: {displayProgress}%</p>
                </div>
              )}

            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Songwriting;
