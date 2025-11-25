
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import {
  EurovisionEntry,
  EurovisionEventState,
  EurovisionLiveEntry,
  EurovisionResult,
  EurovisionSubmissionPayload,
  fetchEurovisionLiveShow,
  fetchEurovisionNationalPicks,
  fetchEurovisionResults,
  fetchEurovisionState,
  submitEurovisionEntry,
} from "@/lib/api/eurovision";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Award,
  CalendarRange,
  CheckCircle,
  Clock3,
  Crown,
  Flag,
  Headphones,
  Hourglass,
  Loader2,
  Music2,
  Play,
  Radio,
  Sparkles,
  Trophy,
} from "lucide-react";

const submissionSchema = z.object({
  artist: z.string().min(2, "Artist name is required"),
  songTitle: z.string().min(2, "Song title is required"),
  audioUrl: z
    .string()
    .min(10, "Provide a link to your audio file, upload, or stream")
    .regex(/^https?:\/\//i, "Use a valid link starting with http or https"),
  country: z.string().min(1, "Select the country you are representing"),
});

const statusColorMap: Record<string, string> = {
  complete: "bg-emerald-100 text-emerald-700",
  "in-progress": "bg-blue-100 text-blue-700",
  open: "bg-blue-100 text-blue-700",
  upcoming: "bg-amber-100 text-amber-800",
  pending: "bg-amber-100 text-amber-800",
  closed: "bg-slate-100 text-slate-700",
  locked: "bg-slate-100 text-slate-700",
};

const StatusBadge = ({ status }: { status: string }) => {
  const color = statusColorMap[status] ?? "bg-muted text-foreground";
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${color}`}>
      {status}
    </span>
  );
};

const renderTimeline = (state?: EurovisionEventState) => {
  if (!state) return null;
  const completed = state.timeline.filter((step) => step.status === "complete").length;
  const progressValue = Math.min(100, (completed / Math.max(state.timeline.length, 1)) * 100);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarRange className="h-5 w-5" />
          {state.year} event timeline
        </CardTitle>
        <CardDescription>Track how far the Eurovision season has progressed.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Progress value={progressValue} className="flex-1" />
          <Badge variant="outline">{Math.round(progressValue)}% complete</Badge>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {state.timeline.map((step) => (
            <div
              key={`${step.label}-${step.date}`}
              className="flex items-start justify-between rounded-lg border p-3"
            >
              <div>
                <p className="font-semibold">{step.label}</p>
                <p className="text-sm text-muted-foreground">{step.date}</p>
                {step.description && <p className="text-sm text-muted-foreground">{step.description}</p>}
              </div>
              <StatusBadge status={step.status} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

const Eurovision = () => {
  const { toast } = useToast();
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLabel, setPreviewLabel] = useState<string>("");
  const [remainingVotes, setRemainingVotes] = useState(5);
  const [spentVotes, setSpentVotes] = useState<Set<string>>(new Set());

  const submissionForm = useForm<z.infer<typeof submissionSchema>>({
    resolver: zodResolver(submissionSchema),
    defaultValues: {
      artist: "",
      songTitle: "",
      audioUrl: "https://",
      country: "",
    },
  });

  const { data: eventState, isLoading: stateLoading } = useQuery({
    queryKey: ["eurovision-state"],
    queryFn: fetchEurovisionState,
  });

  const { data: nationalPicks = [], isLoading: picksLoading } = useQuery({
    queryKey: ["eurovision-national-picks"],
    queryFn: fetchEurovisionNationalPicks,
  });

  const { data: liveShow = [], isLoading: liveLoading } = useQuery({
    queryKey: ["eurovision-live"],
    queryFn: fetchEurovisionLiveShow,
  });

  const { data: resultsData, isLoading: resultsLoading } = useQuery({
    queryKey: ["eurovision-results"],
    queryFn: fetchEurovisionResults,
  });

  useEffect(() => {
    if (resultsData?.year) {
      setSelectedYear(resultsData.year);
    }
  }, [resultsData?.year]);

  useEffect(() => {
    if (eventState?.voting) {
      setRemainingVotes(eventState.voting.remainingVotes ?? eventState.voting.maxVotes);
    }
  }, [eventState?.voting]);

  const handleSubmission = async (values: z.infer<typeof submissionSchema>) => {
    const payload: EurovisionSubmissionPayload = {
      artist: values.artist,
      songTitle: values.songTitle,
      audioUrl: values.audioUrl,
      country: values.country,
    };

    const response = await submitEurovisionEntry(payload);
    if (response.success) {
      toast({
        title: "Entry received",
        description: response.message,
      });
      submissionForm.reset({ artist: "", songTitle: "", audioUrl: "https://", country: "" });
    }
  };

  const handleVote = (entry: EurovisionLiveEntry) => {
    if (!eventState?.voting?.isOpen) {
      toast({
        title: "Voting is closed",
        description: "Public voting is currently unavailable for this show.",
        variant: "destructive",
      });
      return;
    }

    if (remainingVotes <= 0) {
      toast({
        title: "Vote limit reached",
        description: "You have used all available public votes for this show.",
        variant: "destructive",
      });
      return;
    }

    if (spentVotes.has(entry.country)) {
      toast({
        title: "Vote already cast",
        description: `You've already supported ${entry.country} during this show.`,
      });
      return;
    }

    const confirmed = window.confirm(`Send 1 vote to ${entry.artist} for ${entry.country}?`);
    if (!confirmed) return;

    setSpentVotes((prev) => new Set(prev).add(entry.country));
    setRemainingVotes((prev) => Math.max(prev - 1, 0));
    toast({
      title: "Vote recorded",
      description: `${entry.artist} just received your support. ${Math.max(remainingVotes - 1, 0)} votes remaining.`,
    });
  };

  const selectedLeaderboard = useMemo(() => {
    if (!resultsData?.leaderboard?.length || !selectedYear) return [] as EurovisionResult[];
    return resultsData.leaderboard
      .filter((result) => result.year === selectedYear)
      .sort((a, b) => a.rank - b.rank);
  }, [resultsData?.leaderboard, selectedYear]);

  const leaderWinner = selectedLeaderboard[0];

  const renderCountryChips = (countries: string[]) => (
    <div className="flex flex-wrap gap-2">
      {countries.map((country) => (
        <Badge key={country} variant="secondary" className="flex items-center gap-1">
          <Flag className="h-3 w-3" /> {country}
        </Badge>
      ))}
    </div>
  );

  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <Sparkles className="h-7 w-7" /> Eurovision Control Room
          </h1>
          <p className="text-muted-foreground">
            Plan submissions, follow national picks, vote live, and review results for the current Eurovision season.
          </p>
        </div>
        <Badge variant="outline" className="text-base">
          <Crown className="mr-1 h-4 w-4" /> {eventState?.year ?? "Upcoming"}
        </Badge>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="w-full flex-nowrap">
          <TabsTrigger value="overview" className="flex-1">Overview</TabsTrigger>
          <TabsTrigger value="submit" className="flex-1">Submit Song</TabsTrigger>
          <TabsTrigger value="picks" className="flex-1">National Picks</TabsTrigger>
          <TabsTrigger value="live" className="flex-1">Live Show/Voting</TabsTrigger>
          <TabsTrigger value="results" className="flex-1">Results</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Radio className="h-5 w-5" /> Status
                </CardTitle>
                <CardDescription>Live season snapshot pulled from the event state service.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {stateLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading event state...
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className="text-sm">
                        <CheckCircle className="mr-1 h-4 w-4" /> {eventState?.status}
                      </Badge>
                      <Badge variant="outline">{eventState?.currentPhase}</Badge>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <p className="text-sm font-semibold">Participating countries</p>
                      {renderCountryChips(eventState?.participatingCountries ?? [])}
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-semibold">Key dates</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {(eventState?.keyDates ?? []).map((date) => (
                          <div key={`${date.label}-${date.date}`} className="rounded-lg border p-2">
                            <p className="font-medium">{date.label}</p>
                            <p className="text-sm text-muted-foreground">{date.date}</p>
                            {date.status && <StatusBadge status={date.status} />}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
            {renderTimeline(eventState)}
          </div>
        </TabsContent>

        <TabsContent value="submit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Music2 className="h-5 w-5" /> Submit your entry
              </CardTitle>
              <CardDescription>
                Register your artist, song, and audio link. All countries are validated against the eligible roster.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...submissionForm}>
                <form className="grid gap-4 md:grid-cols-2" onSubmit={submissionForm.handleSubmit(handleSubmission)}>
                  <FormField
                    control={submissionForm.control}
                    name="artist"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Artist name</FormLabel>
                        <FormControl>
                          <Input placeholder="Midnight Atlas" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={submissionForm.control}
                    name="songTitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Song title</FormLabel>
                        <FormControl>
                          <Input placeholder="Eclipse Lights" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={submissionForm.control}
                    name="audioUrl"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Audio / upload link</FormLabel>
                        <FormControl>
                          <Textarea
                            rows={2}
                            placeholder="https://example.com/your-song.mp3 or a cloud upload link"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={submissionForm.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select country" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {(eventState?.eligibleCountries ?? []).map((country) => (
                              <SelectItem key={country} value={country}>
                                {country}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex items-end justify-end md:col-span-2">
                    <Button type="submit" disabled={submissionForm.formState.isSubmitting}>
                      {submissionForm.formState.isSubmitting && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Submit entry
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="picks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" /> National selections
              </CardTitle>
              <CardDescription>See which entries each broadcaster has locked in and which are still pending.</CardDescription>
            </CardHeader>
            <CardContent>
              {picksLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading national picks...
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {nationalPicks.map((entry) => (
                    <div key={entry.country} className="flex items-start justify-between rounded-lg border p-3">
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">{entry.country}</p>
                        <p className="font-semibold">{entry.artist}</p>
                        <p className="text-sm">{entry.song}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <StatusBadge status={entry.status ?? "pending"} />
                        {entry.status === "pending" ? (
                          <Badge variant="outline" className="flex items-center gap-1 text-xs">
                            <Hourglass className="h-3 w-3" /> Awaiting selection
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                            <CheckCircle className="h-3 w-3" /> Confirmed
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="live" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Headphones className="h-5 w-5" /> Live show & public voting
              </CardTitle>
              <CardDescription>
                Check the running order, preview each song, and cast up to {eventState?.voting?.maxVotes ?? 5} votes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
                <Badge variant={eventState?.voting?.isOpen ? "default" : "secondary"}>
                  {eventState?.voting?.isOpen ? "Voting open" : "Voting closed"}
                </Badge>
                <Badge variant="outline" className="flex items-center gap-1">
                  <Clock3 className="h-4 w-4" /> {remainingVotes} / {eventState?.voting?.maxVotes ?? 5} votes remaining
                </Badge>
                {eventState?.voting?.voteEndsAt && (
                  <p className="text-sm text-muted-foreground">Closes at {eventState.voting.voteEndsAt}</p>
                )}
              </div>
              {liveLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading live show data...
                </div>
              ) : (
                <div className="space-y-3">
                  {liveShow.map((entry) => (
                    <div key={`${entry.slot}-${entry.country}`} className="flex flex-col gap-2 rounded-lg border p-3 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary">#{entry.slot.toString().padStart(2, "0")}</Badge>
                        <div>
                          <p className="font-semibold">{entry.artist}</p>
                          <p className="text-sm text-muted-foreground">{entry.song}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Flag className="h-3 w-3" /> {entry.country}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Trophy className="h-3 w-3" /> {entry.votes.toLocaleString()} pts
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setPreviewUrl(entry.audioUrl ?? "");
                            setPreviewLabel(`${entry.artist} – ${entry.song}`);
                          }}
                        >
                          <Play className="mr-2 h-4 w-4" /> Preview
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleVote(entry)}
                          disabled={!eventState?.voting?.isOpen || remainingVotes <= 0 || spentVotes.has(entry.country)}
                        >
                          Vote
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {previewUrl && (
                <div className="rounded-lg border p-3">
                  <p className="mb-2 text-sm font-semibold">Now previewing: {previewLabel}</p>
                  <audio controls className="w-full" src={previewUrl} />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" /> Results & leaderboard
              </CardTitle>
              <CardDescription>Review the final scoreboard and jump between historical years.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm font-semibold">Season</p>
                <Select
                  value={selectedYear ? selectedYear.toString() : undefined}
                  onValueChange={(value) => setSelectedYear(Number(value))}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {(resultsData?.historicalYears ?? []).map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {resultsLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading leaderboard...
                </div>
              ) : selectedLeaderboard.length === 0 ? (
                <p className="text-muted-foreground">No leaderboard data available for the selected year.</p>
              ) : (
                <div className="space-y-4">
                  {leaderWinner && (
                    <div className="rounded-lg border bg-gradient-to-r from-amber-50 via-yellow-50 to-white p-4 shadow-sm">
                      <p className="text-sm font-semibold text-amber-700">Champion</p>
                      <p className="text-lg font-bold">{leaderWinner.artist}</p>
                      <p className="text-sm text-muted-foreground">{leaderWinner.song} — {leaderWinner.country}</p>
                      <Badge variant="secondary" className="mt-2 flex items-center gap-1">
                        <Crown className="h-4 w-4" /> {leaderWinner.totalVotes.toLocaleString()} votes
                      </Badge>
                    </div>
                  )}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Country</TableHead>
                        <TableHead>Artist</TableHead>
                        <TableHead>Song</TableHead>
                        <TableHead className="text-right">Votes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedLeaderboard.map((entry) => (
                        <TableRow key={`${entry.rank}-${entry.country}`} className={entry.rank === 1 ? "bg-amber-50" : ""}>
                          <TableCell className="font-semibold">{entry.rank}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Flag className="h-4 w-4" /> {entry.country}
                            </div>
                          </TableCell>
                          <TableCell>{entry.artist}</TableCell>
                          <TableCell>{entry.song}</TableCell>
                          <TableCell className="text-right font-semibold">{entry.totalVotes.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Eurovision;
