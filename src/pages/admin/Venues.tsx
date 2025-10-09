import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/lib/supabase-types';

type VenueRow = Database['public']['Tables']['venues']['Row'];
type VenueInsert = Database['public']['Tables']['venues']['Insert'];
type CityRow = Database['public']['Tables']['cities']['Row'];

const VENUE_TYPES = [
  { value: 'indie_venue', label: 'Indie Venue' },
  { value: 'rock_club', label: 'Rock Club' },
  { value: 'jazz_club', label: 'Jazz Club' },
  { value: 'nightclub', label: 'Nightclub' },
  { value: 'concert_hall', label: 'Concert Hall' },
  { value: 'arena', label: 'Arena' },
  { value: 'festival_stage', label: 'Festival Stage' },
];

interface VenueFormData {
  city_id: string | null;
  name: string;
  location: string;
  venue_type: string;
  capacity: number;
  prestige_level: number;
  base_payment: number;
  description: string;
  image_url: string;
  requirements: Record<string, any>;
  amenities: string[];
}

const defaultFormData: VenueFormData = {
  city_id: null,
  name: '',
  location: '',
  venue_type: 'concert_hall',
  capacity: 100,
  prestige_level: 1,
  base_payment: 500,
  description: '',
  image_url: '',
  requirements: {},
  amenities: [],
};

export default function VenuesAdmin() {
  const { toast } = useToast();
  const [venues, setVenues] = useState<VenueRow[]>([]);
  const [cities, setCities] = useState<CityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVenue, setEditingVenue] = useState<VenueRow | null>(null);
  const [formData, setFormData] = useState<VenueFormData>(defaultFormData);

  // Requirements fields
  const [minFans, setMinFans] = useState('0');
  const [minFame, setMinFame] = useState('0');
  const [minPerformanceSkill, setMinPerformanceSkill] = useState('0');
  const [minStagePresence, setMinStagePresence] = useState('0');

  // Amenities
  const [newAmenity, setNewAmenity] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [venuesResult, citiesResult] = await Promise.all([
        supabase.from('venues').select('*').order('prestige_level'),
        supabase.from('cities').select('*').order('name'),
      ]);

      if (venuesResult.error) throw venuesResult.error;
      if (citiesResult.error) throw citiesResult.error;

      setVenues(venuesResult.data || []);
      setCities(citiesResult.data || []);
    } catch (error: any) {
      toast({
        title: 'Error loading data',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const openDialog = (venue?: VenueRow) => {
    if (venue) {
      setEditingVenue(venue);
      const reqs = (venue.requirements as any) || {};
      const rawAmenities = venue.amenities || [];
      const venueAmenities: string[] = Array.isArray(rawAmenities) 
        ? rawAmenities.filter((a): a is string => typeof a === 'string')
        : [];
      
      setFormData({
        city_id: venue.city_id,
        name: venue.name,
        location: venue.location || '',
        venue_type: venue.venue_type,
        capacity: venue.capacity,
        prestige_level: venue.prestige_level,
        base_payment: venue.base_payment,
        description: venue.description || '',
        image_url: venue.image_url || '',
        requirements: reqs,
        amenities: venueAmenities,
      });
      setMinFans(String(reqs.min_fans || 0));
      setMinFame(String(reqs.min_fame || 0));
      setMinPerformanceSkill(String(reqs.min_performance_skill || 0));
      setMinStagePresence(String(reqs.min_stage_presence || 0));
    } else {
      setEditingVenue(null);
      setFormData(defaultFormData);
      setMinFans('0');
      setMinFame('0');
      setMinPerformanceSkill('0');
      setMinStagePresence('0');
    }
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingVenue(null);
    setFormData(defaultFormData);
    setNewAmenity('');
  };

  const addAmenity = () => {
    if (newAmenity.trim()) {
      setFormData({ ...formData, amenities: [...formData.amenities, newAmenity.trim()] });
      setNewAmenity('');
    }
  };

  const removeAmenity = (index: number) => {
    setFormData({
      ...formData,
      amenities: formData.amenities.filter((_, i) => i !== index),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const requirements = {
      min_fans: parseInt(minFans) || 0,
      min_fame: parseInt(minFame) || 0,
      min_performance_skill: parseInt(minPerformanceSkill) || 0,
      min_stage_presence: parseInt(minStagePresence) || 0,
    };

    const venueData: VenueInsert = {
      city_id: formData.city_id || null,
      name: formData.name,
      location: formData.location,
      venue_type: formData.venue_type,
      capacity: formData.capacity,
      prestige_level: formData.prestige_level,
      base_payment: formData.base_payment,
      description: formData.description,
      image_url: formData.image_url || null,
      requirements: requirements as any,
      amenities: formData.amenities as any,
    };

    try {
      if (editingVenue) {
        const { error } = await supabase
          .from('venues')
          .update(venueData)
          .eq('id', editingVenue.id);

        if (error) throw error;

        toast({
          title: 'Venue updated',
          description: `${formData.name} has been updated successfully.`,
        });
      } else {
        const { error } = await supabase.from('venues').insert(venueData);

        if (error) throw error;

        toast({
          title: 'Venue created',
          description: `${formData.name} has been created successfully.`,
        });
      }

      closeDialog();
      loadData();
    } catch (error: any) {
      toast({
        title: 'Error saving venue',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (venue: VenueRow) => {
    if (!confirm(`Are you sure you want to delete ${venue.name}?`)) return;

    try {
      const { error } = await supabase.from('venues').delete().eq('id', venue.id);

      if (error) throw error;

      toast({
        title: 'Venue deleted',
        description: `${venue.name} has been removed.`,
      });

      loadData();
    } catch (error: any) {
      toast({
        title: 'Error deleting venue',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Venue Management</h1>
          <p className="text-muted-foreground">Manage music venues and performance locations</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Add Venue
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingVenue ? 'Edit Venue' : 'Create Venue'}</DialogTitle>
              <DialogDescription>
                {editingVenue ? 'Update venue information' : 'Add a new performance venue'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Venue Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Select
                    value={formData.city_id || ''}
                    onValueChange={(value) => setFormData({ ...formData, city_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select city" />
                    </SelectTrigger>
                    <SelectContent>
                      {cities.map((city) => (
                        <SelectItem key={city.id} value={city.id}>
                          {city.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">Location/Address</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="venue_type">Venue Type *</Label>
                  <Select
                    value={formData.venue_type}
                    onValueChange={(value) => setFormData({ ...formData, venue_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VENUE_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="capacity">Capacity *</Label>
                  <Input
                    id="capacity"
                    type="number"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                    required
                    min="0"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prestige_level">Prestige Level (1-5) *</Label>
                  <Input
                    id="prestige_level"
                    type="number"
                    value={formData.prestige_level}
                    onChange={(e) => setFormData({ ...formData, prestige_level: parseInt(e.target.value) })}
                    required
                    min="1"
                    max="5"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="base_payment">Base Payment ($) *</Label>
                  <Input
                    id="base_payment"
                    type="number"
                    value={formData.base_payment}
                    onChange={(e) => setFormData({ ...formData, base_payment: parseInt(e.target.value) })}
                    required
                    min="0"
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="space-y-3">
                <Label>Requirements</Label>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="min_fans" className="text-sm">Min Fans</Label>
                    <Input
                      id="min_fans"
                      type="number"
                      value={minFans}
                      onChange={(e) => setMinFans(e.target.value)}
                      min="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="min_fame" className="text-sm">Min Fame</Label>
                    <Input
                      id="min_fame"
                      type="number"
                      value={minFame}
                      onChange={(e) => setMinFame(e.target.value)}
                      min="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="min_performance_skill" className="text-sm">Min Performance Skill</Label>
                    <Input
                      id="min_performance_skill"
                      type="number"
                      value={minPerformanceSkill}
                      onChange={(e) => setMinPerformanceSkill(e.target.value)}
                      min="0"
                      max="100"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="min_stage_presence" className="text-sm">Min Stage Presence</Label>
                    <Input
                      id="min_stage_presence"
                      type="number"
                      value={minStagePresence}
                      onChange={(e) => setMinStagePresence(e.target.value)}
                      min="0"
                      max="100"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Label>Amenities</Label>
                <div className="flex gap-2">
                  <Input
                    value={newAmenity}
                    onChange={(e) => setNewAmenity(e.target.value)}
                    placeholder="Add amenity..."
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addAmenity();
                      }
                    }}
                  />
                  <Button type="button" onClick={addAmenity} size="sm">
                    Add
                  </Button>
                </div>
                {formData.amenities.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.amenities.map((amenity, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 rounded-md bg-secondary px-3 py-1 text-sm"
                      >
                        <span>{amenity}</span>
                        <button
                          type="button"
                          onClick={() => removeAmenity(index)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={closeDialog}>
                  Cancel
                </Button>
                <Button type="submit">{editingVenue ? 'Update' : 'Create'} Venue</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {venues.map((venue) => {
          const city = cities.find((c) => c.id === venue.city_id);
          const reqs = (venue.requirements as any) || {};
          const rawAmenities = venue.amenities || [];
          const amenities: string[] = Array.isArray(rawAmenities) 
            ? rawAmenities.filter((a): a is string => typeof a === 'string')
            : [];

          return (
            <Card key={venue.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      {venue.name}
                    </CardTitle>
                    <CardDescription>
                      {city?.name || 'No city'} • {venue.venue_type.replace(/_/g, ' ')}
                    </CardDescription>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openDialog(venue)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(venue)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Capacity:</span> {venue.capacity}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Prestige:</span> {venue.prestige_level}
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Payment:</span> ${venue.base_payment.toLocaleString()}
                  </div>
                </div>
                {(reqs.min_fans > 0 || reqs.min_fame > 0) && (
                  <div className="text-xs text-muted-foreground">
                    <div className="font-medium">Requirements:</div>
                    {reqs.min_fans > 0 && <div>• Min {reqs.min_fans} fans</div>}
                    {reqs.min_fame > 0 && <div>• Min {reqs.min_fame} fame</div>}
                    {reqs.min_performance_skill > 0 && <div>• Performance skill {reqs.min_performance_skill}</div>}
                    {reqs.min_stage_presence > 0 && <div>• Stage presence {reqs.min_stage_presence}</div>}
                  </div>
                )}
                {amenities.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    <div className="font-medium">Amenities:</div>
                    {amenities.slice(0, 3).map((amenity, i) => (
                      <div key={i}>• {amenity}</div>
                    ))}
                    {amenities.length > 3 && <div>• +{amenities.length - 3} more</div>}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
