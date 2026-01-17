import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Target, Plus, Check, Clock, X, Trophy } from "lucide-react";
import { useCompanyGoals, useCreateCompanyGoal, useUpdateGoalProgress } from "@/hooks/useCompanyAdvanced";
import { GOAL_TYPES } from "@/types/company-advanced";
import { format } from "date-fns";
import { toast } from "sonner";

interface CompanyGoalsManagerProps {
  companyId: string;
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-info/10 text-info border-info/30',
  completed: 'bg-success/10 text-success border-success/30',
  failed: 'bg-destructive/10 text-destructive border-destructive/30',
  cancelled: 'bg-muted text-muted-foreground',
};

export function CompanyGoalsManager({ companyId }: CompanyGoalsManagerProps) {
  const { data: goals = [], isLoading } = useCompanyGoals(companyId);
  const createGoal = useCreateCompanyGoal();
  const updateProgress = useUpdateGoalProgress();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newGoal, setNewGoal] = useState({
    goal_type: 'revenue',
    title: '',
    description: '',
    target_value: 100000,
  });

  const handleCreateGoal = async () => {
    if (!newGoal.title) {
      toast.error("Please enter a goal title");
      return;
    }

    try {
      await createGoal.mutateAsync({
        company_id: companyId,
        goal_type: newGoal.goal_type as any,
        title: newGoal.title,
        description: newGoal.description,
        target_value: newGoal.target_value,
        current_value: 0,
        status: 'active',
      } as any);
      toast.success("Goal created!");
      setIsCreateOpen(false);
      setNewGoal({ goal_type: 'revenue', title: '', description: '', target_value: 100000 });
    } catch (error) {
      toast.error("Failed to create goal");
    }
  };

  const handleCompleteGoal = async (goalId: string, currentValue: number, targetValue: number) => {
    const status = currentValue >= targetValue ? 'completed' : 'failed';
    try {
      await updateProgress.mutateAsync({ goalId, currentValue, status });
      toast.success(status === 'completed' ? "Goal completed! 🎉" : "Goal marked as failed");
    } catch (error) {
      toast.error("Failed to update goal");
    }
  };

  const activeGoals = goals.filter(g => g.status === 'active');
  const completedGoals = goals.filter(g => g.status === 'completed');

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading goals...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Company Goals
            </CardTitle>
            <CardDescription>
              {activeGoals.length} active • {completedGoals.length} completed
            </CardDescription>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Set Goal
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Goal</DialogTitle>
                <DialogDescription>
                  Set a target for your business empire to achieve.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Goal Type</Label>
                  <Select
                    value={newGoal.goal_type}
                    onValueChange={(value) => setNewGoal({ ...newGoal, goal_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GOAL_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title">Goal Title</Label>
                  <Input
                    id="title"
                    placeholder="e.g., Reach $1M revenue"
                    value={newGoal.title}
                    onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="target">Target Value</Label>
                  <Input
                    id="target"
                    type="number"
                    min={1}
                    value={newGoal.target_value}
                    onChange={(e) => setNewGoal({ ...newGoal, target_value: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <Button onClick={handleCreateGoal} className="w-full" disabled={createGoal.isPending}>
                  {createGoal.isPending ? "Creating..." : "Create Goal"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {goals.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Target className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No goals set yet</p>
            <p className="text-sm">Create goals to track your empire's progress</p>
          </div>
        ) : (
          <div className="space-y-4">
            {goals.map((goal) => {
              const progress = Math.min(100, (goal.current_value / goal.target_value) * 100);
              const isComplete = goal.status === 'completed';

              return (
                <div
                  key={goal.id}
                  className={`p-4 rounded-lg border ${
                    isComplete ? 'bg-success/5 border-success/30' : 'bg-card'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-medium flex items-center gap-2">
                        {goal.title}
                        {isComplete && <Trophy className="h-4 w-4 text-warning" />}
                      </h4>
                      {goal.description && (
                        <p className="text-sm text-muted-foreground">{goal.description}</p>
                      )}
                    </div>
                    <Badge className={STATUS_STYLES[goal.status] || ''}>
                      {goal.status}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Progress</span>
                      <span>
                        {goal.current_value.toLocaleString()} / {goal.target_value.toLocaleString()}
                      </span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>

                  {goal.status === 'active' && (
                    <div className="flex items-center gap-2 mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCompleteGoal(goal.id, goal.current_value, goal.target_value)}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Mark Complete
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
