import { useEffect, useMemo, useState } from "react";
import {
  fetchMediaPrTasks,
  fetchMediaReputationEvents,
  fetchMediaReputationTrend,
  type MediaPrTask,
  type MediaPrTaskPriority,
  type MediaPrTaskStatus,
  type MediaReputationEvent,
  type MediaReputationTrendPoint,
} from "@/lib/api/reputation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import ReputationTimeline from "@/components/reputation/ReputationTimeline";
import type { ReputationTimelineEvent } from "@/components/reputation/ReputationTimeline";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Gauge,
  RadioTower,
  Target,
  TrendingUp,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const statusOptions: Array<{ value: MediaPrTaskStatus | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "planning", label: "Planning" },
  { value: "production", label: "In Production" },
  { value: "live", label: "Live" },
  { value: "completed", label: "Completed" },
];

const priorityStyles: Record<MediaPrTaskPriority, string> = {
  high: "bg-destructive/10 text-destructive border-destructive/30",
  medium: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  low: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
};

const statusBadgeStyles: Record<MediaPrTaskStatus, string> = {
  planning: "bg-muted/50 text-muted-foreground",
  production: "bg-blue-500/10 text-blue-600",
  live: "bg-emerald-500/10 text-emerald-600",
  completed: "bg-muted text-muted-foreground",
};

const dueDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const shortDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});

const formatDueDate = (isoDate: string) => {
  try {
    return dueDateFormatter.format(new Date(isoDate));
  } catch (error) {
    return isoDate;
  }
};

const formatTimelineLabel = (isoDate: string) => {
  try {
    return shortDateFormatter.format(new Date(isoDate));
  } catch (error) {
    return isoDate;
  }
};

const formatReach = (value: number) => `${value.toFixed(1)}M`;

const formatRelativeDueDate = (isoDate: string) => {
  try {
    return formatDistanceToNow(new Date(isoDate), { addSuffix: true });
  } catch (error) {
    return "Date pending";
  }
};

const TaskTableView = ({ tasks }: { tasks: MediaPrTask[] }) => {
  if (!tasks.length) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        No tasks in this view yet. Add a new activation or adjust filters to see more workstreams.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border/60">
      <Table>
        <TableHeader className="bg-muted/30">
          <TableRow>
            <TableHead className="w-[280px]">Task</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Channel</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Reputation Impact</TableHead>
            <TableHead>Reach</TableHead>
            <TableHead>Due</TableHead>
            <TableHead className="w-[140px]">Progress</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => (
            <TableRow key={task.id}>
              <TableCell>
                <div className="space-y-2">
                  <div>
                    <p className="font-semibold text-foreground">{task.title}</p>
                    <p className="text-sm text-muted-foreground">{task.summary}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline" className={statusBadgeStyles[task.status]}>
                      {task.status === "production" ? "In production" : task.status === "live" ? "Live" : task.status}
                    </Badge>
                    {task.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="font-medium text-foreground">{task.owner}</div>
                <div className="text-xs text-muted-foreground">Lead</div>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="border-border/60 bg-background/60">
                  {task.channel}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={priorityStyles[task.priority]}>
                  {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="font-medium text-foreground">{task.reputationImpact >= 0 ? "+" : ""}{task.reputationImpact}</div>
                <div className="text-xs text-muted-foreground">Projected delta</div>
              </TableCell>
              <TableCell>
                <div className="font-medium text-foreground">{formatReach(task.reachEstimate)}</div>
                <div className="text-xs text-muted-foreground">Earned media</div>
              </TableCell>
              <TableCell>
                <div className="font-medium text-foreground">{formatDueDate(task.dueDate)}</div>
                <div className="text-xs text-muted-foreground">{formatRelativeDueDate(task.dueDate)}</div>
              </TableCell>
              <TableCell>
                <div className="space-y-2">
                  <Progress value={task.completion} className="h-2" />
                  <p className="text-xs text-muted-foreground">{task.completion}% ready</p>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

const chartConfig = {
  score: {
    label: "Reputation score",
    color: "hsl(var(--chart-1))",
  },
  earnedMedia: {
    label: "Earned media reach (M)",
    color: "hsl(var(--chart-2))",
  },
  sentimentPercent: {
    label: "Audience sentiment",
    color: "hsl(var(--chart-3))",
  },
} satisfies ChartConfig;

const MediaReputationPage = () => {
  const [tasks, setTasks] = useState<MediaPrTask[]>([]);
  const [trend, setTrend] = useState<MediaReputationTrendPoint[]>([]);
  const [events, setEvents] = useState<MediaReputationEvent[]>([]);
  const [statusFilter, setStatusFilter] = useState<MediaPrTaskStatus | "all">("all");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      setIsLoading(true);
      try {
        const [taskData, trendData, eventData] = await Promise.all([
          fetchMediaPrTasks(),
          fetchMediaReputationTrend(),
          fetchMediaReputationEvents(),
        ]);

        if (!isMounted) {
          return;
        }

        setTasks(taskData);
        setTrend(trendData);
        setEvents(eventData);
      } catch (error) {
        console.error("Failed to load media reputation data", error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const trendWithSentiment = useMemo(
    () =>
      trend.map((point) => ({
        ...point,
        sentimentPercent: Math.round(point.sentiment * 100),
      })),
    [trend],
  );

  const currentScore = trend.at(-1)?.score ?? 0;
  const previousScore = trend.at(-2)?.score ?? currentScore;
  const scoreDelta = currentScore - previousScore;

  const averageSentiment = trend.length
    ? trend.reduce((acc, point) => acc + point.sentiment, 0) / trend.length
    : 0;
  const sentimentPercent = Math.round(averageSentiment * 100);

  const completionRate = tasks.length
    ? Math.round(
        (tasks.filter((task) => task.status === "completed").length / tasks.length) * 100,
      )
    : 0;

  const activeTasks = tasks.filter((task) => task.status !== "completed");
  const highImpactInitiatives = activeTasks.filter((task) => task.reputationImpact >= 4).length;
  const activeChannels = useMemo(() => new Set(tasks.map((task) => task.channel)).size, [tasks]);

  const upcomingTasks = useMemo(() => {
    return activeTasks
      .slice()
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 4);
  }, [activeTasks]);

  const timelineEvents = useMemo<ReputationTimelineEvent[]>(
    () =>
      events
        .slice()
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [events],
  );

  return (
    <div className="space-y-8 pb-12">
      <header className="space-y-3">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          <RadioTower className="h-4 w-4" /> Media Reputation Control
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">PR Command Center</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Track priority media activations, sentiment swings, and timeline commitments to protect and grow the brand.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/70 px-4 py-2 text-sm">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            <span className="font-medium text-foreground">Current score {currentScore}</span>
            <span className={scoreDelta >= 0 ? "text-emerald-600" : "text-red-600"}>
              {scoreDelta >= 0 ? "+" : ""}
              {scoreDelta.toFixed(1)} vs last
            </span>
          </div>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-border/60 bg-background/70">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <Gauge className="h-4 w-4" /> Reputation momentum
            </div>
            <CardTitle className="text-2xl font-semibold text-foreground">{currentScore}</CardTitle>
            <CardDescription>Rolling media score across all channels</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {scoreDelta >= 0 ? "Up" : "Down"} {Math.abs(scoreDelta).toFixed(1)} points vs last update
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-background/70">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" /> Delivery health
            </div>
            <CardTitle className="text-2xl font-semibold text-foreground">{completionRate}%</CardTitle>
            <CardDescription>PR programs delivered or on-track</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {tasks.length - activeTasks.length} of {tasks.length} initiatives complete
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-background/70">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <Target className="h-4 w-4" /> High impact
            </div>
            <CardTitle className="text-2xl font-semibold text-foreground">{highImpactInitiatives}</CardTitle>
            <CardDescription>Active stories driving ≥4pt reputation lift</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Operating across {activeChannels} core media channels
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-background/70">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <AlertTriangle className="h-4 w-4" /> Sentiment watch
            </div>
            <CardTitle className="text-2xl font-semibold text-foreground">{sentimentPercent}%</CardTitle>
            <CardDescription>Average audience sentiment this cycle</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Monitoring {events.length} tracked reputation events
          </CardContent>
        </Card>
      </section>

      <section className="rounded-lg border border-border/60 bg-background/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Trendline</p>
            <h2 className="text-lg font-semibold text-foreground">Reputation and earned media trajectory</h2>
          </div>
          <div className="text-xs text-muted-foreground">
            <div>Sentiment shown as dashed line</div>
            <div>Earned media expressed in millions</div>
          </div>
        </div>
        <div className="mt-4 h-[320px] w-full">
          <ChartContainer config={chartConfig} className="h-full w-full">
            <AreaChart data={trendWithSentiment} margin={{ left: 12, right: 16, top: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="media-reputation" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-score)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--color-score)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={16}
                tickFormatter={formatTimelineLabel}
              />
              <YAxis
                yAxisId="score"
                tickLine={false}
                axisLine={false}
                width={60}
                tickMargin={8}
                domain={["dataMin - 4", "dataMax + 4"]}
              />
              <YAxis
                yAxisId="earned"
                orientation="right"
                tickLine={false}
                axisLine={false}
                width={72}
                tickFormatter={(value) => `${Number(value).toFixed(1)}M`}
              />
              <ChartTooltip
                cursor={{ strokeDasharray: "4 4" }}
                content={
                  <ChartTooltipContent
                    formatter={(value, name) => {
                      if (name === "earnedMedia") {
                        return [`${Number(value).toFixed(1)}M`, "Earned media reach"];
                      }

                      if (name === "sentimentPercent") {
                        return [`${value}%`, "Sentiment"];
                      }

                      return [String(value), "Reputation score"];
                    }}
                    labelFormatter={(label) => formatDueDate(String(label))}
                  />
                }
              />
              <Area
                type="monotone"
                dataKey="score"
                yAxisId="score"
                stroke="var(--color-score)"
                strokeWidth={2}
                fill="url(#media-reputation)"
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="earnedMedia"
                yAxisId="earned"
                stroke="var(--color-earnedMedia)"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="sentimentPercent"
                yAxisId="score"
                stroke="var(--color-sentimentPercent)"
                strokeDasharray="6 4"
                strokeWidth={2}
                dot={false}
              />
            </AreaChart>
          </ChartContainer>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card className="border-border/60 bg-background/70">
          <CardContent className="pt-6">
            <Tabs value={statusFilter} onValueChange={(value) => setStatusFilter(value as MediaPrTaskStatus | "all")}> 
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">PR workload</p>
                  <h2 className="text-lg font-semibold text-foreground">Campaign execution board</h2>
                </div>
                <TabsList className="grid w-full gap-1 sm:grid-cols-3 lg:max-w-[560px] lg:grid-cols-5">
                  {statusOptions.map((option) => (
                    <TabsTrigger key={option.value} value={option.value} className="text-xs">
                      {option.label}
                      {option.value === "all"
                        ? ` (${tasks.length})`
                        : ` (${tasks.filter((task) => task.status === option.value).length})`}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
              {statusOptions.map((option) => (
                <TabsContent key={option.value} value={option.value} className="mt-6 space-y-4">
                  {isLoading ? (
                    <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                      Syncing latest task data...
                    </div>
                  ) : (
                    <TaskTableView
                      tasks={
                        option.value === "all"
                          ? tasks
                          : tasks.filter((task) => task.status === option.value)
                      }
                    />
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-background/70">
          <CardHeader>
            <CardTitle className="text-lg">Upcoming commitments</CardTitle>
            <CardDescription>Deadlines and coordination beats to monitor closely.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {upcomingTasks.length ? (
              upcomingTasks.map((task) => (
                <div key={task.id} className="rounded-lg border border-border/50 bg-muted/10 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-foreground">{task.title}</p>
                      <p className="text-xs text-muted-foreground">{task.summary}</p>
                    </div>
                    <Badge variant="outline" className={priorityStyles[task.priority]}>
                      {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" /> {formatDueDate(task.dueDate)}
                    </span>
                    <span>({formatRelativeDueDate(task.dueDate)})</span>
                    <span className="flex items-center gap-1">
                      <RadioTower className="h-3.5 w-3.5" /> {task.channel}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                All commitments are delivered—reallocate resources to future storytelling opportunities.
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <Card className="border-border/60 bg-background/70">
        <CardHeader>
          <CardTitle className="text-lg">Reputation timeline</CardTitle>
          <CardDescription>Signature wins, pivots, and reputation events across PR channels.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {isLoading && !timelineEvents.length ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Loading timeline events...
            </div>
          ) : (
            <ReputationTimeline events={timelineEvents} />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MediaReputationPage;
