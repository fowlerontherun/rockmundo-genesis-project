import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/components/ui/use-toast";
import { Save, Trash2 } from "lucide-react";

export default function CrowdBehaviorAdmin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    animation_clip_path: "",
    intensity: 0.5,
    energy_level: 50,
  });

  const { data: presets, isLoading } = useQuery({
    queryKey: ["crowd-animation-presets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crowd_animation_presets")
        .select("*")
        .order("energy_level");
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from("crowd_animation_presets")
        .insert([data]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crowd-animation-presets"] });
      toast({ title: "Crowd preset created successfully" });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from("crowd_animation_presets")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crowd-animation-presets"] });
      toast({ title: "Crowd preset updated successfully" });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("crowd_animation_presets")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crowd-animation-presets"] });
      toast({ title: "Crowd preset deleted successfully" });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      animation_clip_path: "",
      intensity: 0.5,
      energy_level: 50,
    });
    setEditingId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (preset: any) => {
    setFormData({
      name: preset.name,
      animation_clip_path: preset.animation_clip_path || "",
      intensity: preset.intensity || 0.5,
      energy_level: preset.energy_level || 50,
    });
    setEditingId(preset.id);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bebas mb-2">Crowd Behavior Configuration</h1>
        <p className="text-muted-foreground font-oswald">Manage crowd animation presets and moods</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{editingId ? "Edit" : "Create"} Crowd Animation Preset</CardTitle>
          <CardDescription>Define how the crowd behaves in different mood states</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Preset Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ecstatic"
                required
              />
            </div>

            <div>
              <Label htmlFor="clip">Animation Clip Path</Label>
              <Input
                id="clip"
                value={formData.animation_clip_path}
                onChange={(e) => setFormData({ ...formData, animation_clip_path: e.target.value })}
                placeholder="/animations/crowd/ecstatic.glb"
              />
            </div>

            <div>
              <Label>Intensity: {formData.intensity.toFixed(2)}</Label>
              <Slider
                value={[formData.intensity]}
                onValueChange={(value) => setFormData({ ...formData, intensity: value[0] })}
                min={0}
                max={1}
                step={0.01}
                className="mt-2"
              />
            </div>

            <div>
              <Label>Energy Level: {formData.energy_level}</Label>
              <Slider
                value={[formData.energy_level]}
                onValueChange={(value) => setFormData({ ...formData, energy_level: value[0] })}
                min={0}
                max={100}
                step={1}
                className="mt-2"
              />
            </div>

            <div className="flex gap-2">
              <Button type="submit">
                <Save className="h-4 w-4 mr-2" />
                {editingId ? "Update" : "Create"} Preset
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing Presets</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div>Loading...</div>
          ) : (
            <div className="space-y-2">
              {presets?.map((preset) => (
                <div key={preset.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <div className="font-semibold">{preset.name}</div>
                    <div className="text-sm text-muted-foreground">
                      Energy: {preset.energy_level} • Intensity: {preset.intensity?.toFixed(2)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(preset)}>
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteMutation.mutate(preset.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
