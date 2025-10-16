import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminRoute } from "@/components/AdminRoute";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Sparkles, Filter } from "lucide-react";
import { z } from "zod";

const productionNoteSchema = z.object({
  name: z.string().min(1, "Name required"),
  description: z.string().min(1, "Description required"),
  category: z.enum(['pyro', 'lighting', 'crowd_interaction', 'special_effects', 'video', 'stage_design', 'surprise_element']),
  impact_type: z.enum(['attendance', 'performance', 'fame', 'merch_sales']),
  impact_value: z.number().min(1.0).max(2.0),
  required_skill_slug: z.string().optional(),
  required_skill_value: z.number().optional(),
  required_fame: z.number().optional(),
  required_venue_prestige: z.number().optional(),
  cost_per_use: z.number().min(0).default(0),
  cooldown_shows: z.number().min(0).default(0),
  rarity: z.enum(['common', 'uncommon', 'rare', 'legendary'])
});

type ProductionNote = z.infer<typeof productionNoteSchema> & { id: string };

const ProductionNotes = () => {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<ProductionNote | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [rarityFilter, setRarityFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "lighting" as const,
    impact_type: "performance" as const,
    impact_value: 1.1,
    required_skill_slug: "",
    required_skill_value: 0,
    required_fame: 0,
    required_venue_prestige: 0,
    cost_per_use: 0,
    cooldown_shows: 0,
    rarity: "common" as const
  });

  const { data: notes, isLoading } = useQuery({
    queryKey: ['admin-production-notes', categoryFilter, rarityFilter],
    queryFn: async () => {
      let query = supabase.from('setlist_production_notes').select('*').order('rarity').order('required_fame');
      
      if (categoryFilter !== 'all') {
        query = query.eq('category', categoryFilter);
      }
      if (rarityFilter !== 'all') {
        query = query.eq('rarity', rarityFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as ProductionNote[];
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof productionNoteSchema>) => {
      const { data: result, error } = await supabase
        .from('setlist_production_notes')
        .insert([data])
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-production-notes'] });
      toast.success("Production note created successfully");
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error("Failed to create production note: " + error.message);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: z.infer<typeof productionNoteSchema> }) => {
      const { data: result, error } = await supabase
        .from('setlist_production_notes')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-production-notes'] });
      toast.success("Production note updated successfully");
      setIsDialogOpen(false);
      setEditingNote(null);
      resetForm();
    },
    onError: (error: any) => {
      toast.error("Failed to update production note: " + error.message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('setlist_production_notes')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-production-notes'] });
      toast.success("Production note deleted successfully");
    },
    onError: (error: any) => {
      toast.error("Failed to delete production note: " + error.message);
    }
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      category: "lighting",
      impact_type: "performance",
      impact_value: 1.1,
      required_skill_slug: "",
      required_skill_value: 0,
      required_fame: 0,
      required_venue_prestige: 0,
      cost_per_use: 0,
      cooldown_shows: 0,
      rarity: "common"
    });
    setEditingNote(null);
  };

  const handleEdit = (note: ProductionNote) => {
    setEditingNote(note);
    setFormData({
      name: note.name,
      description: note.description,
      category: note.category as any,
      impact_type: note.impact_type as any,
      impact_value: note.impact_value,
      required_skill_slug: note.required_skill_slug || "",
      required_skill_value: note.required_skill_value || 0,
      required_fame: note.required_fame || 0,
      required_venue_prestige: note.required_venue_prestige || 0,
      cost_per_use: note.cost_per_use || 0,
      cooldown_shows: note.cooldown_shows || 0,
      rarity: note.rarity as any
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const validatedData = productionNoteSchema.parse(formData);
      
      if (editingNote) {
        updateMutation.mutate({ id: editingNote.id, data: validatedData });
      } else {
        createMutation.mutate(validatedData);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      }
    }
  };

  const filteredNotes = notes?.filter(note =>
    note.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    note.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common': return 'secondary';
      case 'uncommon': return 'default';
      case 'rare': return 'destructive';
      case 'legendary': return 'outline';
      default: return 'secondary';
    }
  };

  return (
    <AdminRoute>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Production Notes Management</h1>
            <p className="text-muted-foreground">Manage production elements for setlists</p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Production Note
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingNote ? 'Edit' : 'Create'} Production Note</DialogTitle>
                <DialogDescription>
                  {editingNote ? 'Update' : 'Add a new'} production element for bands to use in their setlists
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Laser Grid Choreography"
                    />
                  </div>
                  
                  <div className="col-span-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Synchronized laser beams that react to the music"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="category">Category</Label>
                    <Select value={formData.category} onValueChange={(value: any) => setFormData({ ...formData, category: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pyro">Pyrotechnics</SelectItem>
                        <SelectItem value="lighting">Lighting</SelectItem>
                        <SelectItem value="crowd_interaction">Crowd Interaction</SelectItem>
                        <SelectItem value="special_effects">Special Effects</SelectItem>
                        <SelectItem value="video">Video & Projection</SelectItem>
                        <SelectItem value="stage_design">Stage Design</SelectItem>
                        <SelectItem value="surprise_element">Surprise Element</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="rarity">Rarity</Label>
                    <Select value={formData.rarity} onValueChange={(value: any) => setFormData({ ...formData, rarity: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="common">Common</SelectItem>
                        <SelectItem value="uncommon">Uncommon</SelectItem>
                        <SelectItem value="rare">Rare</SelectItem>
                        <SelectItem value="legendary">Legendary</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="impact_type">Impact Type</Label>
                    <Select value={formData.impact_type} onValueChange={(value: any) => setFormData({ ...formData, impact_type: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="performance">Performance</SelectItem>
                        <SelectItem value="attendance">Attendance</SelectItem>
                        <SelectItem value="fame">Fame</SelectItem>
                        <SelectItem value="merch_sales">Merch Sales</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="impact_value">Impact Value (1.0-2.0)</Label>
                    <Input
                      id="impact_value"
                      type="number"
                      step="0.01"
                      min="1.0"
                      max="2.0"
                      value={formData.impact_value}
                      onChange={(e) => setFormData({ ...formData, impact_value: parseFloat(e.target.value) })}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      1.15 = +15% bonus, 1.25 = +25% bonus
                    </p>
                  </div>
                  
                  <div>
                    <Label htmlFor="cost_per_use">Cost Per Use ($)</Label>
                    <Input
                      id="cost_per_use"
                      type="number"
                      min="0"
                      value={formData.cost_per_use}
                      onChange={(e) => setFormData({ ...formData, cost_per_use: parseInt(e.target.value) })}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="cooldown_shows">Cooldown (Shows)</Label>
                    <Input
                      id="cooldown_shows"
                      type="number"
                      min="0"
                      value={formData.cooldown_shows}
                      onChange={(e) => setFormData({ ...formData, cooldown_shows: parseInt(e.target.value) })}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="required_fame">Required Fame</Label>
                    <Input
                      id="required_fame"
                      type="number"
                      min="0"
                      value={formData.required_fame}
                      onChange={(e) => setFormData({ ...formData, required_fame: parseInt(e.target.value) })}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="required_venue_prestige">Required Venue Prestige</Label>
                    <Input
                      id="required_venue_prestige"
                      type="number"
                      min="0"
                      max="5"
                      value={formData.required_venue_prestige}
                      onChange={(e) => setFormData({ ...formData, required_venue_prestige: parseInt(e.target.value) })}
                    />
                  </div>
                  
                  <div className="col-span-2">
                    <Label htmlFor="required_skill_slug">Required Skill Slug (optional)</Label>
                    <Input
                      id="required_skill_slug"
                      value={formData.required_skill_slug}
                      onChange={(e) => setFormData({ ...formData, required_skill_slug: e.target.value })}
                      placeholder="performance_advanced_stage_presence"
                    />
                  </div>
                  
                  {formData.required_skill_slug && (
                    <div className="col-span-2">
                      <Label htmlFor="required_skill_value">Required Skill Value</Label>
                      <Input
                        id="required_skill_value"
                        type="number"
                        min="0"
                        max="100"
                        value={formData.required_skill_value}
                        onChange={(e) => setFormData({ ...formData, required_skill_value: parseInt(e.target.value) })}
                      />
                    </div>
                  )}
                </div>
                
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {editingNote ? 'Update' : 'Create'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Search</Label>
                <Input
                  placeholder="Search notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              
              <div>
                <Label>Category</Label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="pyro">Pyrotechnics</SelectItem>
                    <SelectItem value="lighting">Lighting</SelectItem>
                    <SelectItem value="crowd_interaction">Crowd Interaction</SelectItem>
                    <SelectItem value="special_effects">Special Effects</SelectItem>
                    <SelectItem value="video">Video & Projection</SelectItem>
                    <SelectItem value="stage_design">Stage Design</SelectItem>
                    <SelectItem value="surprise_element">Surprise Element</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Rarity</Label>
                <Select value={rarityFilter} onValueChange={setRarityFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Rarities</SelectItem>
                    <SelectItem value="common">Common</SelectItem>
                    <SelectItem value="uncommon">Uncommon</SelectItem>
                    <SelectItem value="rare">Rare</SelectItem>
                    <SelectItem value="legendary">Legendary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Production Notes ({filteredNotes?.length || 0})</CardTitle>
            <CardDescription>
              All available production elements for setlists
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px]">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : filteredNotes && filteredNotes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Sparkles className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>No production notes found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredNotes?.map((note) => (
                    <div key={note.id} className="border rounded-lg p-4 hover:bg-accent transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold">{note.name}</h3>
                            <Badge variant={getRarityColor(note.rarity)}>
                              {note.rarity}
                            </Badge>
                            {note.cost_per_use > 0 && (
                              <Badge variant="outline">${note.cost_per_use}</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{note.description}</p>
                          
                          <div className="flex flex-wrap gap-2 text-xs">
                            <Badge variant="secondary">{note.category.replace('_', ' ')}</Badge>
                            <Badge variant="outline">
                              {note.impact_type}: +{((note.impact_value - 1) * 100).toFixed(0)}%
                            </Badge>
                            
                            {note.required_fame > 0 && (
                              <Badge variant="outline">Fame: {note.required_fame}+</Badge>
                            )}
                            {note.required_venue_prestige > 0 && (
                              <Badge variant="outline">Venue: {note.required_venue_prestige}★+</Badge>
                            )}
                            {note.required_skill_slug && (
                              <Badge variant="outline">Skill: {note.required_skill_slug}</Badge>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleEdit(note)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              if (confirm(`Delete "${note.name}"?`)) {
                                deleteMutation.mutate(note.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </AdminRoute>
  );
};

export default ProductionNotes;
