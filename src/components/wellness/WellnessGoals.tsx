import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Goal, Plus, Trophy, Calendar } from "lucide-react";
import { toast } from "sonner";
import { format, addDays } from "date-fns";

const goalTypes = [
  { value: "exercise_sessions", label: "Exercise Sessions", unit: "sessions" },
  { value: "meditation_minutes", label: "Meditation Minutes", unit: "minutes" },
  { value: "sleep_hours", label: "Sleep Hours", unit: "hours" },
  { value: "healthy_meals", label: "Healthy Meals", unit: "meals" },
  { value: "rest_days", label: "Rest Days", unit: "days" },
];

export function WellnessGoals() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [goalType, setGoalType] = useState("");
  const [targetValue, setTargetValue] = useState("");

  const { data: goals, isLoading } = useQuery({
    queryKey: ["wellness-goals", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("player_wellness_goals")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const addGoalMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Not logged in");
      const deadline = format(addDays(new Date(), 7), "yyyy-MM-dd");
      const { error } = await supabase
        .from("player_wellness_goals")
        .insert({
          user_id: user.id,
          goal_type: goalType,
          target_value: parseInt(targetValue),
          deadline,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wellness-goals"] });
      setShowForm(false);
      setGoalType("");
      setTargetValue("");
      toast.success("Goal created! You have 7 days to complete it.");
    },
  });

  const completeGoalMutation = useMutation({
    mutationFn: async (goalId: string) => {
      const { error } = await supabase
        .from("player_wellness_goals")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", goalId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wellness-goals"] });
      toast.success("Goal completed! +50 XP bonus!");
    },
  });

  const getGoalLabel = (type: string) => {
    return goalTypes.find((g) => g.value === type)?.label || type;
  };

  const getGoalUnit = (type: string) => {
    return goalTypes.find((g) => g.value === type)?.unit || "";
  };

  if (isLoading) return <div>Loading goals...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Goal className="h-5 w-5" />
          Wellness Goals
        </CardTitle>
        <CardDescription>
          Set weekly wellness goals for bonus XP
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {goals && goals.length > 0 ? (
          <div className="space-y-3">
            {goals.map((goal) => {
              const progress = Math.min(100, (goal.current_value / goal.target_value) * 100);
              const isComplete = goal.current_value >= goal.target_value;
              return (
                <div key={goal.id} className="p-3 rounded-lg border">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-medium">{getGoalLabel(goal.goal_type)}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Due: {goal.deadline ? format(new Date(goal.deadline), "MMM d") : "No deadline"}
                      </p>
                    </div>
                    {isComplete ? (
                      <Button
                        size="sm"
                        onClick={() => completeGoalMutation.mutate(goal.id)}
                        disabled={completeGoalMutation.isPending}
                      >
                        <Trophy className="h-4 w-4 mr-1" />
                        Claim
                      </Button>
                    ) : (
                      <Badge variant="secondary">
                        {goal.current_value}/{goal.target_value} {getGoalUnit(goal.goal_type)}
                      </Badge>
                    )}
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            No active goals. Set a goal to earn bonus XP!
          </p>
        )}

        {showForm ? (
          <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
            <Select value={goalType} onValueChange={setGoalType}>
              <SelectTrigger>
                <SelectValue placeholder="Select goal type" />
              </SelectTrigger>
              <SelectContent>
                {goalTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              placeholder="Target value"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={() => addGoalMutation.mutate()}
                disabled={!goalType || !targetValue || addGoalMutation.isPending}
              >
                Create Goal
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button className="w-full" variant="outline" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add New Goal
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
