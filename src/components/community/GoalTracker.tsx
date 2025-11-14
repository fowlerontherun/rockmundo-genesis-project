import { useEffect, useMemo, useState } from "react";
import { Loader2, Trophy, Target, Rocket, CircleDashed } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { GoalProgressCard } from "./GoalProgressCard";
import { GoalTimeline } from "./GoalTimeline";
import type { MentorshipGoal, MentorshipGoalStatus } from "./types";

const STATUS_ORDER: MentorshipGoalStatus[] = ["in_progress", "not_started", "blocked", "completed"];

const STATUS_LABELS: Record<MentorshipGoalStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
  blocked: "Blocked",
};

interface GoalTrackerProps {
  goals: MentorshipGoal[];
  isLoading?: boolean;
}

export function GoalTracker({ goals, isLoading = false }: GoalTrackerProps) {
  const [statusFilter, setStatusFilter] = useState<"all" | MentorshipGoalStatus>("all");
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);

  const summary = useMemo(() => {
    if (!goals || goals.length === 0) {
      return {
        completed: 0,
        active: 0,
        blocked: 0,
        averageProgress: 0,
      };
    }

    const completed = goals.filter((goal) => goal.status === "completed").length;
    const active = goals.filter((goal) => goal.status === "in_progress").length;
    const blocked = goals.filter((goal) => goal.status === "blocked").length;
    const averageProgress = Math.round(goals.reduce((sum, goal) => sum + goal.progress, 0) / goals.length);

    return { completed, active, blocked, averageProgress };
  }, [goals]);

  const filteredGoals = useMemo(() => {
    if (statusFilter === "all") return goals;
    return goals.filter((goal) => goal.status === statusFilter);
  }, [goals, statusFilter]);

  useEffect(() => {
    if (filteredGoals.length === 0) {
      setSelectedGoalId(null);
      return;
    }
    if (!selectedGoalId || !filteredGoals.some((goal) => goal.id === selectedGoalId)) {
      const preferred = [...filteredGoals].sort((a, b) => b.progress - a.progress);
      setSelectedGoalId(preferred[0]?.id ?? null);
    }
  }, [filteredGoals, selectedGoalId]);

  const selectedGoal = filteredGoals.find((goal) => goal.id === selectedGoalId) ?? filteredGoals[0];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2.1fr),minmax(0,1fr)]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-xl">Mentorship Goals</CardTitle>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Target className="h-4 w-4" />
                <span>{goals.length} total goals</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <SummaryStat icon={Rocket} label="Active" value={summary.active} tone="text-primary" />
              <SummaryStat icon={Trophy} label="Completed" value={summary.completed} tone="text-emerald-500" />
              <SummaryStat icon={CircleDashed} label="Avg. progress" value={`${summary.averageProgress}%`} tone="text-muted-foreground" />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant={statusFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("all")}
              >
                All ({goals.length})
              </Button>
              {STATUS_ORDER.map((status) => {
                const count = goals.filter((goal) => goal.status === status).length;
                return (
                  <Button
                    key={status}
                    variant={statusFilter === status ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter(status)}
                    disabled={count === 0}
                  >
                    {STATUS_LABELS[status]} ({count})
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex min-h-[220px] items-center justify-center rounded-lg border">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredGoals.length === 0 ? (
          <Card>
            <CardContent className="flex h-40 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
              <Target className="h-6 w-6" />
              <p className="text-sm">No mentorship goals yet. Pair with a mentor to start shaping your progression arcs.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {filteredGoals.map((goal) => (
              <GoalProgressCard
                key={goal.id}
                goal={goal}
                isSelected={goal.id === selectedGoal?.id}
                onSelect={setSelectedGoalId}
              />
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Status breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {STATUS_ORDER.map((status) => {
              const count = goals.filter((goal) => goal.status === status).length;
              const percentage = goals.length > 0 ? Math.round((count / goals.length) * 100) : 0;
              return (
                <div key={status} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>{STATUS_LABELS[status]}</span>
                    <Badge variant="outline">{percentage}%</Badge>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
            <Separator />
            <div className="text-xs text-muted-foreground">
              Completion rate considers all goals with status "completed". Keep a steady cadence of check-ins to boost velocity.
            </div>
          </CardContent>
        </Card>

        {selectedGoal && (
          <GoalTimeline
            goalTitle={selectedGoal.title}
            status={selectedGoal.status}
            checkIns={selectedGoal.checkIns ?? []}
            supportNotes={selectedGoal.supportNotes}
          />
        )}
      </div>
    </div>
  );
}

interface SummaryStatProps {
  icon: typeof Rocket;
  label: string;
  value: number | string;
  tone?: string;
}

function SummaryStat({ icon: Icon, label, value, tone }: SummaryStatProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
      <Icon className={cn("h-5 w-5", tone)} />
      <div>
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
}
