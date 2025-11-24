import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Trash2, Save } from "lucide-react";
import { Switch } from "@/components/ui/switch";

type StageTemplate = {
  id: string;
  name: string;
  slug: string;
  size: string;
  capacity_min: number;
  capacity_max: number;
  gltf_asset_path: string | null;
  spline_scene_url: string | null;
  is_active: boolean;
};

export default function StageTemplatesAdmin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    size: "small",
    capacity_min: 50,
    capacity_max: 200,
    gltf_asset_path: "",
    spline_scene_url: "",
    is_active: true,
  });

  const { data: stages, isLoading } = useQuery({
    queryKey: ["stage-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stage_templates")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as StageTemplate[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from("stage_templates")
        .insert([data]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stage-templates"] });
      toast({ title: "Stage template created successfully" });
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create stage template",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      const { error } = await supabase
        .from("stage_templates")
        .update(data)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stage-templates"] });
      toast({ title: "Stage template updated successfully" });
      setEditingId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update stage template",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("stage_templates")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stage-templates"] });
      toast({ title: "Stage template deleted successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete stage template",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      slug: "",
      size: "small",
      capacity_min: 50,
      capacity_max: 200,
      gltf_asset_path: "",
      spline_scene_url: "",
      is_active: true,
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

  const handleEdit = (stage: StageTemplate) => {
    setFormData({
      name: stage.name,
      slug: stage.slug,
      size: stage.size,
      capacity_min: stage.capacity_min,
      capacity_max: stage.capacity_max,
      gltf_asset_path: stage.gltf_asset_path || "",
      spline_scene_url: stage.spline_scene_url || "",
      is_active: stage.is_active,
    });
    setEditingId(stage.id);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bebas mb-2">Stage Templates</h1>
        <p className="text-muted-foreground font-oswald">Manage 3D stage configurations for gigs</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{editingId ? "Edit" : "Create"} Stage Template</CardTitle>
          <CardDescription>Configure a stage template for 3D gig viewer</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Stage Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Small Club Stage"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="small-club"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="size">Size</Label>
                <Select value={formData.size} onValueChange={(value) => setFormData({ ...formData, size: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local">Local</SelectItem>
                    <SelectItem value="small">Small</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="large">Large</SelectItem>
                    <SelectItem value="festival">Festival</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="capacity_min">Min Capacity</Label>
                <Input
                  id="capacity_min"
                  type="number"
                  value={formData.capacity_min}
                  onChange={(e) => setFormData({ ...formData, capacity_min: parseInt(e.target.value) })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="capacity_max">Max Capacity</Label>
                <Input
                  id="capacity_max"
                  type="number"
                  value={formData.capacity_max}
                  onChange={(e) => setFormData({ ...formData, capacity_max: parseInt(e.target.value) })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gltf_asset_path">GLTF Asset Path</Label>
                <Input
                  id="gltf_asset_path"
                  value={formData.gltf_asset_path}
                  onChange={(e) => setFormData({ ...formData, gltf_asset_path: e.target.value })}
                  placeholder="/assets/stages/small-club.glb"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="spline_scene_url">Spline Scene URL</Label>
                <Input
                  id="spline_scene_url"
                  value={formData.spline_scene_url}
                  onChange={(e) => setFormData({ ...formData, spline_scene_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active">Active</Label>
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                <Save className="h-4 w-4 mr-2" />
                {editingId ? "Update" : "Create"} Stage
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
          <CardTitle>Existing Stages</CardTitle>
          <CardDescription>Manage your stage templates</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div>Loading...</div>
          ) : (
            <div className="space-y-2">
              {stages?.map((stage) => (
                <div key={stage.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <div className="font-semibold">{stage.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {stage.size} • {stage.capacity_min}-{stage.capacity_max} capacity
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(stage)}>
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteMutation.mutate(stage.id)}
                      disabled={deleteMutation.isPending}
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
