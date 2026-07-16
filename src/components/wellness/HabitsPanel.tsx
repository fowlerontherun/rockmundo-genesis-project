import { useMemo } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Flame, CheckCircle2, Plus, X, Repeat } from "lucide-react";
import {
  useHabitTemplates,
  usePlayerHabits,
  useStartHabit,
  useCompleteHabit,
  useStopHabit,
} from "@/hooks/useWellnessHabits";

interface Props { profileId: string | null; }

const HabitsPanel = ({ profileId }: Props) => {
  const { data: templates = [] } = useHabitTemplates();
  const { data: habits = [] } = usePlayerHabits(profileId);
  const start = useStartHabit(profileId);
  const complete = useCompleteHabit(profileId);
  const stop = useStopHabit(profileId);

  const activeSlugs = useMemo(() => new Set(habits.map((h) => h.template_slug ?? "")), [habits]);
  const today = new Date().toISOString().slice(0, 10);

  const availableTemplates = templates.filter((t) => !activeSlugs.has(t.slug));

  const handleStart = async (slug: string) => {
    try {
      await start.mutateAsync(slug);
      toast.success("Habit added");
    } catch (e: any) { toast.error(e?.message ?? "Failed to add habit"); }
  };

  const handleComplete = async (habitId: string) => {
    try {
      const res = await complete.mutateAsync(habitId);
      if (!res.ok && res.reason === "already_done_today") {
        toast.info("Already logged today");
      } else {
        toast.success(`Streak: ${res.streak} day${res.streak === 1 ? "" : "s"}`);
      }
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Repeat className="h-4 w-4 text-primary" /> Daily Habits & Routines
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Build streaks for compounding bonuses. Longer streaks unlock bigger passive buffs.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {habits.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Your Habits</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {habits.map((h) => {
                const doneToday = h.last_completed_date === today;
                return (
                  <div key={h.id} className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium">{h.name}</span>
                        {h.current_streak > 0 && (
                          <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-600 dark:text-amber-400">
                            <Flame className="h-3 w-3" />{h.current_streak}
                          </Badge>
                        )}
                      </div>
                      <p className="line-clamp-1 text-[11px] text-muted-foreground">{h.description}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        size="sm"
                        variant={doneToday ? "outline" : "default"}
                        disabled={doneToday || complete.isPending}
                        onClick={() => handleComplete(h.id)}
                      >
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                        {doneToday ? "Done" : "Log"}
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => stop.mutate(h.id)} title="Stop habit">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {availableTemplates.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Add a Habit</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {availableTemplates.map((t) => (
                <div key={t.slug} className="flex items-center justify-between gap-2 rounded-md border p-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{t.name}</p>
                    <p className="line-clamp-1 text-[11px] text-muted-foreground">{t.description}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handleStart(t.slug)} disabled={start.isPending}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {habits.length === 0 && availableTemplates.length === 0 && (
          <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
            No habits available.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default HabitsPanel;
