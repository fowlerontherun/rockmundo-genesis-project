import { CheckCircle2, Flame, RefreshCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { HabitTrackerEntry } from "@/lib/api/wellness";

export interface HabitWithStatus extends HabitTrackerEntry {
  completedToday: boolean;
  completionRate: number;
  weeklyCompletions: number;
}

interface HabitListProps {
  habits: HabitWithStatus[];
  onToggleHabit: (habitId: string, completed: boolean) => void;
}

const formatLastCompletedDate = (value?: string | null) => {
  if (!value) {
    return "No entries yet";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(parsed);
};

const formatFrequency = (habit: HabitTrackerEntry) => {
  if (habit.frequency === "daily") {
    return "Daily";
  }

  if (habit.frequency === "weekly") {
    return `${habit.targetPerWeek}x weekly`;
  }

  return "Custom";
};

export const HabitList = ({ habits, onToggleHabit }: HabitListProps) => {
  if (!habits.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No habits yet</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Add a habit to start tracking your daily rituals and routines.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {habits.map(habit => (
        <Card key={habit.id}>
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-lg font-semibold">{habit.name}</CardTitle>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{formatFrequency(habit)}</Badge>
                {habit.category ? <Badge variant="outline">{habit.category}</Badge> : null}
              </div>
            </div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Flame className="h-4 w-4 text-orange-500" />
              <span>{habit.streak} day streak</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {habit.description ? (
              <p className="text-sm text-muted-foreground">{habit.description}</p>
            ) : null}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span>Weekly completion</span>
                <span className="font-medium">{habit.completionRate}%</span>
              </div>
              <Progress value={habit.completionRate} aria-label="Weekly habit completion" />
              <p className="text-xs text-muted-foreground">
                {habit.weeklyCompletions} of {habit.targetPerWeek} target check-ins this week
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <RefreshCcw className="h-4 w-4" />
                <span>
                  Last completed: {formatLastCompletedDate(habit.lastCompletedDate)}
                </span>
              </div>
              <Button
                variant={habit.completedToday ? "secondary" : "default"}
                onClick={() => onToggleHabit(habit.id, !habit.completedToday)}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {habit.completedToday ? "Undo today" : "Mark today complete"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default HabitList;
