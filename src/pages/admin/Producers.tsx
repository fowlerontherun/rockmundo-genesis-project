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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Award, Star, DollarSign, Music2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface Producer {
  id: string;
  name: string;
  specialty_genre: string;
  quality_bonus: number;
  mixing_skill: number;
  mastering_skill: number;
  arrangement_skill: number;
  cost_per_hour: number;
  tier: 'budget' | 'mid' | 'premium' | 'legendary';
  bio: string | null;
  past_works: string[];
  grammy_wins: number;
  platinum_records: number;
  years_experience: number;
  is_available: boolean;
  preferred_genres: string[];
  studio_id: string | null;
  image_url: string | null;
}

const TIERS = [
  { value: 'budget', label: 'Budget', color: 'bg-slate-500' },
  { value: 'mid', label: 'Mid-Tier', color: 'bg-blue-500' },
  { value: 'premium', label: 'Premium', color: 'bg-purple-500' },
  { value: 'legendary', label: 'Legendary', color: 'bg-amber-500' },
];

import { MUSIC_GENRES } from "@/data/genres";

const GENRES = [...MUSIC_GENRES];

const ProducersAdmin = () => {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProducer, setEditingProducer] = useState<Producer | null>(null);
  
  const [formData, setFormData] = useState<{
    name: string;
    specialty_genre: string;
    quality_bonus: number;
    mixing_skill: number;
    mastering_skill: number;
    arrangement_skill: number;
    cost_per_hour: number;
    tier: 'budget' | 'mid' | 'premium' | 'legendary';
    bio: string;
    past_works: string;
    grammy_wins: number;
    platinum_records: number;
    years_experience: number;
    is_available: boolean;
    preferred_genres: string;
    studio_id: string | null;
    image_url: string;
  }>({
    name: '',
    specialty_genre: '',
    quality_bonus: 10,
    mixing_skill: 50,
    mastering_skill: 50,
    arrangement_skill: 50,
    cost_per_hour: 500,
    tier: 'budget',
    bio: '',
    past_works: '',
    grammy_wins: 0,
    platinum_records: 0,
    years_experience: 5,
    is_available: true,
    preferred_genres: '',
    studio_id: null,
    image_url: '',
  });

  const { data: producers, isLoading } = useQuery({
    queryKey: ['admin-producers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recording_producers')
        .select('*')
        .order('tier', { ascending: false })
        .order('quality_bonus', { ascending: false });
      
      if (error) throw error;
      return data as Producer[];
    },
  });

  const { data: studios } = useQuery({
    queryKey: ['city-studios-for-producers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('city_studios')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase
        .from('recording_producers')
        .insert([{
          ...data,
          past_works: data.past_works ? data.past_works.split('\n').filter((w: string) => w.trim()) : [],
          preferred_genres: data.preferred_genres ? data.preferred_genres.split(',').map((g: string) => g.trim()).filter((g: string) => g) : [],
        }]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-producers'] });
      toast.success('Producer created successfully');
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(`Failed to create producer: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { error } = await supabase
        .from('recording_producers')
        .update({
          ...data,
          past_works: typeof data.past_works === 'string' 
            ? data.past_works.split('\n').filter((w: string) => w.trim())
            : data.past_works,
          preferred_genres: typeof data.preferred_genres === 'string'
            ? data.preferred_genres.split(',').map((g: string) => g.trim()).filter((g: string) => g)
            : data.preferred_genres,
        })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-producers'] });
      toast.success('Producer updated successfully');
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(`Failed to update producer: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('recording_producers')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-producers'] });
      toast.success('Producer deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete producer: ${error.message}`);
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      specialty_genre: '',
      quality_bonus: 10,
      mixing_skill: 50,
      mastering_skill: 50,
      arrangement_skill: 50,
      cost_per_hour: 500,
      tier: 'budget',
      bio: '',
      past_works: '',
      grammy_wins: 0,
      platinum_records: 0,
      years_experience: 5,
      is_available: true,
      preferred_genres: '',
      studio_id: null,
      image_url: '',
    });
    setEditingProducer(null);
  };

  const handleEdit = (producer: Producer) => {
    setEditingProducer(producer);
    setFormData({
      name: producer.name,
      specialty_genre: producer.specialty_genre,
      quality_bonus: producer.quality_bonus,
      mixing_skill: producer.mixing_skill,
      mastering_skill: producer.mastering_skill,
      arrangement_skill: producer.arrangement_skill,
      cost_per_hour: producer.cost_per_hour,
      tier: producer.tier,
      bio: producer.bio || '',
      past_works: producer.past_works.join('\n'),
      grammy_wins: producer.grammy_wins,
      platinum_records: producer.platinum_records,
      years_experience: producer.years_experience,
      is_available: producer.is_available,
      preferred_genres: producer.preferred_genres.join(', '),
      studio_id: producer.studio_id,
      image_url: producer.image_url || '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingProducer) {
      updateMutation.mutate({ id: editingProducer.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const getTierBadge = (tier: string) => {
    const tierConfig = TIERS.find(t => t.value === tier);
    return (
      <Badge className={tierConfig?.color}>
        {tierConfig?.label}
      </Badge>
    );
  };

  return (
    <AdminRoute>
      <div className="container mx-auto py-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Recording Producers</h1>
          <p className="text-muted-foreground">Manage recording producers and their attributes</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Producer
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingProducer ? 'Edit' : 'Create'} Producer</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="specialty_genre">Specialty Genre *</Label>
                  <Select
                    value={formData.specialty_genre}
                    onValueChange={(value) => setFormData({ ...formData, specialty_genre: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select genre" />
                    </SelectTrigger>
                    <SelectContent>
                      {GENRES.map(genre => (
                        <SelectItem key={genre} value={genre}>{genre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tier">Tier *</Label>
                  <Select
                    value={formData.tier}
                    onValueChange={(value) => setFormData({ ...formData, tier: value as 'budget' | 'mid' | 'premium' | 'legendary' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIERS.map(tier => (
                        <SelectItem key={tier.value} value={tier.value}>{tier.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cost_per_hour">Cost Per Hour ($)</Label>
                  <Input
                    id="cost_per_hour"
                    type="number"
                    value={formData.cost_per_hour}
                    onChange={(e) => setFormData({ ...formData, cost_per_hour: parseInt(e.target.value) })}
                    min="0"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quality_bonus">Quality Bonus (1-30)</Label>
                  <Input
                    id="quality_bonus"
                    type="number"
                    value={formData.quality_bonus}
                    onChange={(e) => setFormData({ ...formData, quality_bonus: parseInt(e.target.value) })}
                    min="1"
                    max="30"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mixing_skill">Mixing Skill (0-100)</Label>
                  <Input
                    id="mixing_skill"
                    type="number"
                    value={formData.mixing_skill}
                    onChange={(e) => setFormData({ ...formData, mixing_skill: parseInt(e.target.value) })}
                    min="0"
                    max="100"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mastering_skill">Mastering Skill (0-100)</Label>
                  <Input
                    id="mastering_skill"
                    type="number"
                    value={formData.mastering_skill}
                    onChange={(e) => setFormData({ ...formData, mastering_skill: parseInt(e.target.value) })}
                    min="0"
                    max="100"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="arrangement_skill">Arrangement Skill (0-100)</Label>
                  <Input
                    id="arrangement_skill"
                    type="number"
                    value={formData.arrangement_skill}
                    onChange={(e) => setFormData({ ...formData, arrangement_skill: parseInt(e.target.value) })}
                    min="0"
                    max="100"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="years_experience">Years Experience</Label>
                  <Input
                    id="years_experience"
                    type="number"
                    value={formData.years_experience}
                    onChange={(e) => setFormData({ ...formData, years_experience: parseInt(e.target.value) })}
                    min="0"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="grammy_wins">Grammy Wins</Label>
                  <Input
                    id="grammy_wins"
                    type="number"
                    value={formData.grammy_wins}
                    onChange={(e) => setFormData({ ...formData, grammy_wins: parseInt(e.target.value) })}
                    min="0"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="platinum_records">Platinum Records</Label>
                  <Input
                    id="platinum_records"
                    type="number"
                    value={formData.platinum_records}
                    onChange={(e) => setFormData({ ...formData, platinum_records: parseInt(e.target.value) })}
                    min="0"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="studio_id">Preferred Studio</Label>
                  <Select
                    value={formData.studio_id || 'none'}
                    onValueChange={(value) => setFormData({ ...formData, studio_id: value === 'none' ? null : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {studios?.map(studio => (
                        <SelectItem key={studio.id} value={studio.id}>{studio.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  rows={3}
                  placeholder="Producer biography and notable achievements..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="past_works">Past Works (one per line)</Label>
                <Textarea
                  id="past_works"
                  value={formData.past_works}
                  onChange={(e) => setFormData({ ...formData, past_works: e.target.value })}
                  rows={4}
                  placeholder="Artist - Album Name&#10;Artist - Song Name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="preferred_genres">Preferred Genres (comma-separated)</Label>
                <Input
                  id="preferred_genres"
                  value={formData.preferred_genres}
                  onChange={(e) => setFormData({ ...formData, preferred_genres: e.target.value })}
                  placeholder="Rock, Pop, Jazz"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="image_url">Image URL</Label>
                <Input
                  id="image_url"
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_available"
                  checked={formData.is_available}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_available: checked })}
                />
                <Label htmlFor="is_available">Available for Booking</Label>
              </div>

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingProducer ? 'Update' : 'Create'} Producer
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Producers ({producers?.length || 0})</CardTitle>
            <CardDescription>Manage recording producer database</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Specialty</TableHead>
                  <TableHead>Skills</TableHead>
                  <TableHead>Awards</TableHead>
                  <TableHead>Cost/Hour</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {producers?.map((producer) => (
                  <TableRow key={producer.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Music2 className="h-4 w-4 text-muted-foreground" />
                        {producer.name}
                      </div>
                      <div className="text-xs text-muted-foreground">{producer.years_experience} years exp</div>
                    </TableCell>
                    <TableCell>{getTierBadge(producer.tier)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{producer.specialty_genre}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs space-y-1">
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">Mix:</span>
                          <span className="font-medium">{producer.mixing_skill}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">Master:</span>
                          <span className="font-medium">{producer.mastering_skill}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">Arrange:</span>
                          <span className="font-medium">{producer.arrangement_skill}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {producer.grammy_wins > 0 && (
                          <div className="flex items-center gap-1 text-xs">
                            <Award className="h-3 w-3 text-amber-500" />
                            <span>{producer.grammy_wins} Grammys</span>
                          </div>
                        )}
                        {producer.platinum_records > 0 && (
                          <div className="flex items-center gap-1 text-xs">
                            <Star className="h-3 w-3 text-slate-400" />
                            <span>{producer.platinum_records} Platinum</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium">{producer.cost_per_hour.toLocaleString()}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        +{producer.quality_bonus}% quality
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={producer.is_available ? "default" : "secondary"}>
                        {producer.is_available ? 'Available' : 'Unavailable'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(producer)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this producer?')) {
                              deleteMutation.mutate(producer.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      </div>
    </AdminRoute>
  );
};

export default ProducersAdmin;