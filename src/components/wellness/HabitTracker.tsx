import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Plus, Flame, CheckCircle2, Target } from "lucide-react";
import { toast } from "sonner";
import { format, subDays, isSameDay } from "date-fns";

export function HabitTracker() {
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();
  const [newHabit, setNewHabit] = useState("");
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: habits, isLoading } = useQuery({
    queryKey: ["player-habits", profileId],
    queryFn: async () => {
      if (!profileId) return [];
      const { data, error } = await supabase
        .from("player_habits")
        .select("*")
        .eq("user_id", profileId)
        .eq("is_active", true)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!profileId,
  });

  const { data: completions } = useQuery({
    queryKey: ["habit-completions", profileId],
    queryFn: async () => {
      if (!profileId) return [];
      // Get completions for the last 7 days
      const startDate = format(subDays(new Date(), 7), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("player_habit_completions")
        .select("habit_id, completed_date")
        .gte("completed_date", startDate);
      if (error) throw error;
      return data || [];
    },
    enabled: !!profileId,
  });

  const addHabitMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!profileId) throw new Error("No active profile");
      const { error } = await supabase
        .from("player_habits")
        .insert({ user_id: profileId, name, category: "custom" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["player-habits"] });
      setNewHabit("");
      toast.success("Habit added!");
    },
  });

  const toggleCompletionMutation = useMutation({
    mutationFn: async ({ habitId, completed }: { habitId: string; completed: boolean }) => {
      if (completed) {
        const { error } = await supabase
          .from("player_habit_completions")
          .insert({ habit_id: habitId, completed_date: today });
        if (error) throw error;

        // Award health and energy for completing a habit
        if (profileId) {
          const habit = habits?.find(h => h.id === habitId);
          const category = habit?.category || 'custom';
          
          // Determine stat boosts based on habit category
          let healthBoost = 1;
          let energyBoost = 2;
          if (category === 'fitness') { healthBoost = 3; energyBoost = 3; }
          else if (category === 'health') { healthBoost = 4; energyBoost = 1; }
          else if (category === 'mental') { healthBoost = 2; energyBoost = 4; }
          else if (category === 'music') { healthBoost = 0; energyBoost = 2; }

          const { data: profile } = await supabase
            .from("profiles")
            .select("health, energy")
            .eq("id", profileId)
            .single();

          if (profile) {
            const newHealth = Math.min(100, (profile.health ?? 100) + healthBoost);
            const newEnergy = Math.min(100, (profile.energy ?? 100) + energyBoost);
            await supabase
              .from("profiles")
              .update({ health: newHealth, energy: newEnergy })
              .eq("id", profileId);
          }
        }
      } else {
        const { error } = await supabase
          .from("player_habit_completions")
          .delete()
          .eq("habit_id", habitId)
          .eq("completed_date", today);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["habit-completions"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Habit tracked! Stats updated.");
    },
  });

  const isCompletedToday = (habitId: string) => {
    return completions?.some(
      (c) => c.habit_id === habitId && c.completed_date === today
    );
  };

  const getStreak = (habitId: string) => {
    if (!completions) return 0;
    const habitCompletions = completions
      .filter((c) => c.habit_id === habitId)
      .map((c) => new Date(c.completed_date))
      .sort((a, b) => b.getTime() - a.getTime());

    let streak = 0;
    let checkDate = new Date();
    
    for (const completion of habitCompletions) {
      if (isSameDay(completion, checkDate) || isSameDay(completion, subDays(checkDate, 1))) {
        streak++;
        checkDate = subDays(completion, 1);
      } else {
        break;
      }
    }
    return streak;
  };

  const completedToday = habits?.filter((h) => isCompletedToday(h.id)).length || 0;
  const totalHabits = habits?.length || 0;
  const completionRate = totalHabits > 0 ? (completedToday / totalHabits) * 100 : 0;

  if (isLoading) return <div>Loading habits...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Daily Habits
        </CardTitle>
        <CardDescription>
          Track your daily wellness habits
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress summary */}
        <div className="p-3 rounded-lg bg-muted/50">
          <div className="flex justify-between text-sm mb-2">
            <span>Today's Progress</span>
            <span className="font-bold">{completedToday}/{totalHabits}</span>
          </div>
          <Progress value={completionRate} className="h-2" />
        </div>

        {/* Habit list */}
        <div className="space-y-2">
          {habits?.map((habit) => {
            const completed = isCompletedToday(habit.id);
            const streak = getStreak(habit.id);
            return (
              <div
                key={habit.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  completed ? "bg-green-500/10 border-green-500/30" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={completed}
                    onCheckedChange={(checked) =>
                      toggleCompletionMutation.mutate({ habitId: habit.id, completed: !!checked })
                    }
                  />
                  <div>
                    <p className={`font-medium ${completed ? "line-through text-muted-foreground" : ""}`}>
                      {habit.name}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">{habit.category}</p>
                  </div>
                </div>
                {streak > 0 && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Flame className="h-3 w-3 text-orange-500" />
                    {streak} day{streak !== 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
            );
          })}
        </div>

        {/* Add new habit */}
        <div className="flex gap-2">
          <Input
            placeholder="Add a new habit..."
            value={newHabit}
            onChange={(e) => setNewHabit(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && newHabit && addHabitMutation.mutate(newHabit)}
          />
          <Button
            size="icon"
            onClick={() => newHabit && addHabitMutation.mutate(newHabit)}
            disabled={!newHabit || addHabitMutation.isPending}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {completionRate === 100 && (
          <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-green-500/10 text-green-600">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-medium">All habits completed today!</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
