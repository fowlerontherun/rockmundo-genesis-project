import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Eye } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface StageTemplate {
  id: string;
  name: string;
  size: string;
  slug: string;
  capacity_min: number;
  capacity_max: number;
  floor_texture_url: string | null;
  backdrop_texture_url: string | null;
  crowd_sprite_set: string | null;
  metadata: any;
  gltf_asset_path: string | null;
  camera_offset: any;
}

export default function StageTemplatesAdmin() {
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<StageTemplate | null>(null);

  const { data: templates, isLoading } = useQuery({
    queryKey: ['admin-stage-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stage_templates')
        .select('*')
        .order('prestige_level');
      if (error) throw error;
      return data as StageTemplate[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (template: Partial<StageTemplate>) => {
      const { data, error } = await supabase
        .from('stage_templates')
        .insert([template as any])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-stage-templates'] });
      toast.success('Stage template created');
      setIsCreateDialogOpen(false);
    },
    onError: (error) => {
      toast.error(`Failed to create template: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<StageTemplate> & { id: string }) => {
      const { data, error } = await supabase
        .from('stage_templates')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-stage-templates'] });
      toast.success('Stage template updated');
      setEditingTemplate(null);
    },
    onError: (error) => {
      toast.error(`Failed to update template: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('stage_templates')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-stage-templates'] });
      toast.success('Stage template deleted');
    },
    onError: (error) => {
      toast.error(`Failed to delete template: ${error.message}`);
    },
  });

  const floorTextures = [
    { value: 'wood', label: 'Wooden Stage' },
    { value: 'metal', label: 'Metal Grating' },
    { value: 'rubber', label: 'Rubber Flooring' },
    { value: 'concrete', label: 'Concrete' },
  ];

  const backdropTextures = [
    { value: 'curtain-red', label: 'Red Velvet Curtain' },
    { value: 'curtain-black', label: 'Black Drapes' },
    { value: 'led-grid', label: 'LED Panel Grid' },
    { value: 'brick', label: 'Brick Wall' },
  ];

  if (isLoading) {
    return <div className="p-8">Loading stage templates...</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Stage Templates Admin</h1>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Stage Template</DialogTitle>
            </DialogHeader>
            <StageTemplateForm
              onSubmit={(data) => createMutation.mutate(data)}
              floorTextures={floorTextures}
              backdropTextures={backdropTextures}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates?.map((template) => (
          <Card key={template.id}>
            <CardHeader>
              <CardTitle className="flex justify-between items-start">
                <span>{template.name}</span>
              <span className="text-sm font-normal text-muted-foreground">
                {template.size}
              </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-sm">
                <p><strong>Size:</strong> {template.size}</p>
                <p><strong>Capacity:</strong> {template.capacity_min} - {template.capacity_max}</p>
                <p><strong>Floor:</strong> {template.floor_texture_url || 'Default'}</p>
                <p><strong>Backdrop:</strong> {template.backdrop_texture_url || 'Default'}</p>
              </div>
              <div className="flex gap-2 pt-2">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" onClick={() => setEditingTemplate(template)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Edit Stage Template</DialogTitle>
                    </DialogHeader>
                    <StageTemplateForm
                      initialData={template}
                      onSubmit={(data) => updateMutation.mutate({ id: template.id, ...data })}
                      floorTextures={floorTextures}
                      backdropTextures={backdropTextures}
                    />
                  </DialogContent>
                </Dialog>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (confirm('Delete this stage template?')) {
                      deleteMutation.mutate(template.id);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm">
                  <Eye className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

interface StageTemplateFormProps {
  initialData?: Partial<StageTemplate>;
  onSubmit: (data: Partial<StageTemplate>) => void;
  floorTextures: { value: string; label: string }[];
  backdropTextures: { value: string; label: string }[];
}

function StageTemplateForm({ initialData, onSubmit, floorTextures, backdropTextures }: StageTemplateFormProps) {
  const [formData, setFormData] = useState<Partial<StageTemplate>>(
    initialData || {
      name: '',
      slug: '',
      size: 'small',
      capacity_min: 50,
      capacity_max: 150,
      floor_texture_url: 'floors/stage-floor-wood.png',
      backdrop_texture_url: 'backdrops/backdrop-curtain-black.png',
      crowd_sprite_set: 'default',
      metadata: {},
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Name</Label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Size</Label>
          <Select
            value={formData.size}
            onValueChange={(value) => setFormData({ ...formData, size: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tiny">Tiny</SelectItem>
              <SelectItem value="small">Small</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="large">Large</SelectItem>
              <SelectItem value="huge">Huge</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Slug</Label>
          <Input
            value={formData.slug}
            onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
            placeholder="venue-slug"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Min Capacity</Label>
          <Input
            type="number"
            value={formData.capacity_min}
            onChange={(e) => setFormData({ ...formData, capacity_min: parseInt(e.target.value) })}
            required
          />
        </div>

        <div>
          <Label>Max Capacity</Label>
          <Input
            type="number"
            value={formData.capacity_max}
            onChange={(e) => setFormData({ ...formData, capacity_max: parseInt(e.target.value) })}
            required
          />
        </div>
      </div>

      <div>
        <Label>Floor Texture</Label>
        <Select
          value={formData.floor_texture_url?.split('/')[1]?.split('.')[0]}
          onValueChange={(value) => 
            setFormData({ ...formData, floor_texture_url: `floors/stage-floor-${value}.png` })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {floorTextures.map((tex) => (
              <SelectItem key={tex.value} value={tex.value}>
                {tex.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Backdrop Texture</Label>
        <Select
          value={formData.backdrop_texture_url?.split('/')[1]?.split('.')[0]}
          onValueChange={(value) => 
            setFormData({ ...formData, backdrop_texture_url: `backdrops/backdrop-${value}.png` })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {backdropTextures.map((tex) => (
              <SelectItem key={tex.value} value={tex.value}>
                {tex.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Crowd Zones (JSON)</Label>
        <Textarea
          value={JSON.stringify(formData.metadata?.crowdZones || [], null, 2)}
          onChange={(e) => {
            try {
              const crowdZones = JSON.parse(e.target.value);
              setFormData({ 
                ...formData, 
                metadata: { ...formData.metadata, crowdZones } 
              });
            } catch (err) {
              // Invalid JSON, don't update
            }
          }}
          rows={8}
          placeholder='[{"name": "pit", "x": 0, "z": 4, "width": 10, "depth": 4, "density": 1.0, "minMood": 0}]'
        />
      </div>

      <Button type="submit" className="w-full">
        {initialData ? 'Update Template' : 'Create Template'}
      </Button>
    </form>
  );
}
