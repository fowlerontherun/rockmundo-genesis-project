import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface HabitSummaryProps {
  totalHabits: number;
  averageCompletionRate: number;
  longestStreak: number;
  weeklyCompletions: number;
}

export const HabitSummary = ({
  totalHabits,
  averageCompletionRate,
  longestStreak,
  weeklyCompletions,
}: HabitSummaryProps) => {
  const items = [
    {
      id: "total-habits",
      label: "Active Habits",
      value: totalHabits,
      helper: "habits in rotation",
    },
    {
      id: "completion-rate",
      label: "Avg. Completion",
      value: `${averageCompletionRate}%`,
      helper: "across the last 7 days",
    },
    {
      id: "longest-streak",
      label: "Longest Streak",
      value: `${longestStreak}d`,
      helper: "consistent daily completions",
    },
    {
      id: "weekly-completions",
      label: "Weekly Wins",
      value: weeklyCompletions,
      helper: "check-ins logged this week",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map(item => (
        <Card key={item.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {item.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{item.value}</div>
            <p className="text-xs text-muted-foreground">{item.helper}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default HabitSummary;
