import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { AdminRoute } from "@/components/AdminRoute";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { BookOpen, Plus, Trash2, GripVertical, Save } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TutorialStep {
  id: string;
  step_key: string;
  title: string;
  description: string;
  target_element: string | null;
  target_route: string | null;
  order_index: number;
  category: string;
  is_active: boolean;
}

const categories = [
  { value: "getting_started", label: "Getting Started" },
  { value: "band", label: "Band" },
  { value: "performance", label: "Performance" },
  { value: "music", label: "Music" },
  { value: "social", label: "Social" },
  { value: "economy", label: "Economy" },
];

const TutorialsAdmin = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<TutorialStep | null>(null);
  const [formData, setFormData] = useState({
    step_key: "",
    title: "",
    description: "",
    target_element: "",
    target_route: "",
    order_index: 0,
    category: "getting_started",
    is_active: true,
  });

  const { data: steps, isLoading } = useQuery({
    queryKey: ["tutorial-steps"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutorial_steps")
        .select("*")
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data as TutorialStep[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (editingStep) {
        const { error } = await supabase
          .from("tutorial_steps")
          .update(data)
          .eq("id", editingStep.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("tutorial_steps")
          .insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tutorial-steps"] });
      toast({ title: "Success", description: editingStep ? "Tutorial step updated" : "Tutorial step created" });
      resetForm();
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("tutorial_steps")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tutorial-steps"] });
      toast({ title: "Deleted", description: "Tutorial step removed" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("tutorial_steps")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tutorial-steps"] });
    },
  });

  const resetForm = () => {
    setFormData({
      step_key: "",
      title: "",
      description: "",
      target_element: "",
      target_route: "",
      order_index: (steps?.length || 0) + 1,
      category: "getting_started",
      is_active: true,
    });
    setEditingStep(null);
    setIsDialogOpen(false);
  };

  const openEditDialog = (step: TutorialStep) => {
    setEditingStep(step);
    setFormData({
      step_key: step.step_key,
      title: step.title,
      description: step.description,
      target_element: step.target_element || "",
      target_route: step.target_route || "",
      order_index: step.order_index,
      category: step.category,
      is_active: step.is_active,
    });
    setIsDialogOpen(true);
  };

  const groupedSteps = steps?.reduce((acc, step) => {
    if (!acc[step.category]) acc[step.category] = [];
    acc[step.category].push(step);
    return acc;
  }, {} as Record<string, TutorialStep[]>) || {};

  return (
    <AdminRoute>
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-primary/10">
              <BookOpen className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Tutorial Manager</h1>
              <p className="text-muted-foreground">Configure onboarding and tutorial steps</p>
            </div>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => resetForm()}>
                <Plus className="h-4 w-4 mr-2" />
                Add Step
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingStep ? "Edit Tutorial Step" : "Add Tutorial Step"}</DialogTitle>
                <DialogDescription>Configure a new tutorial or tip for players</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Step Key</Label>
                    <Input
                      value={formData.step_key}
                      onChange={(e) => setFormData(f => ({ ...f, step_key: e.target.value }))}
                      placeholder="welcome_message"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Order</Label>
                    <Input
                      type="number"
                      value={formData.order_index}
                      onChange={(e) => setFormData(f => ({ ...f, order_index: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData(f => ({ ...f, title: e.target.value }))}
                    placeholder="Welcome to Rockmundo!"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))}
                    placeholder="Brief explanation of what this step teaches..."
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Target Route (optional)</Label>
                  <Input
                    value={formData.target_route}
                    onChange={(e) => setFormData(f => ({ ...f, target_route: e.target.value }))}
                    placeholder="/dashboard"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(v) => setFormData(f => ({ ...f, category: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Active</Label>
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(v) => setFormData(f => ({ ...f, is_active: v }))}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => saveMutation.mutate(formData)}
                  disabled={saveMutation.isPending || !formData.step_key || !formData.title}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {editingStep ? "Update Step" : "Create Step"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading tutorial steps...</div>
        ) : (
          <div className="space-y-6">
            {categories.map((cat) => {
              const categorySteps = groupedSteps[cat.value] || [];
              if (categorySteps.length === 0) return null;
              
              return (
                <Card key={cat.value}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">{cat.label}</CardTitle>
                    <CardDescription>{categorySteps.length} steps</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {categorySteps.map((step) => (
                        <div
                          key={step.id}
                          className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                        >
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                          <Badge variant="outline" className="shrink-0">
                            #{step.order_index}
                          </Badge>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{step.title}</p>
                            <p className="text-xs text-muted-foreground truncate">{step.description}</p>
                            {step.target_route && (
                              <Badge variant="secondary" className="mt-1 text-xs">
                                {step.target_route}
                              </Badge>
                            )}
                          </div>
                          <Switch
                            checked={step.is_active}
                            onCheckedChange={(v) => toggleMutation.mutate({ id: step.id, is_active: v })}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(step)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteMutation.mutate(step.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AdminRoute>
  );
};

export default TutorialsAdmin;