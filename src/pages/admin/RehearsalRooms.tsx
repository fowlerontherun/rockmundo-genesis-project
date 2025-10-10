import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Trash2, Plus, Music2 } from 'lucide-react';
import type { Database } from '@/lib/supabase-types';

type RehearsalRoom = Database['public']['Tables']['rehearsal_rooms']['Row'] & {
  cities?: { name: string } | null;
  city_districts?: { name: string } | null;
};
type City = Database['public']['Tables']['cities']['Row'];
type District = Database['public']['Tables']['city_districts']['Row'];

export default function RehearsalRooms() {
  const { toast } = useToast();
  const [rooms, setRooms] = useState<RehearsalRoom[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    city_id: '',
    district_id: '',
    hourly_rate: 50,
    quality_rating: 50,
    capacity: 10,
    equipment_quality: 50,
    description: '',
  });

  useEffect(() => {
    loadRooms();
    loadCities();
  }, []);

  const loadCities = async () => {
    try {
      const { data, error } = await supabase
        .from('cities')
        .select('*')
        .order('name');

      if (error) throw error;
      setCities(data || []);
    } catch (error) {
      console.error('Error loading cities:', error);
    }
  };

  const loadDistricts = async (cityId: string) => {
    try {
      const { data, error } = await supabase
        .from('city_districts')
        .select('*')
        .eq('city_id', cityId)
        .order('name');

      if (error) throw error;
      setDistricts(data || []);
    } catch (error) {
      console.error('Error loading districts:', error);
    }
  };

  const loadRooms = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('rehearsal_rooms')
        .select(`
          *,
          cities:city_id (name),
          city_districts:district_id (name)
        `)
        .order('name');

      if (error) throw error;
      setRooms(data || []);
    } catch (error) {
      console.error('Error loading rehearsal rooms:', error);
      toast({
        title: 'Error',
        description: 'Failed to load rehearsal rooms',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const submitData = {
        ...formData,
        city_id: formData.city_id || null,
        district_id: formData.district_id || null,
      };

      const { error } = await supabase
        .from('rehearsal_rooms')
        .insert([submitData]);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Rehearsal room created successfully',
      });

      setFormData({
        name: '',
        location: '',
        city_id: '',
        district_id: '',
        hourly_rate: 50,
        quality_rating: 50,
        capacity: 10,
        equipment_quality: 50,
        description: '',
      });
      setDistricts([]);

      loadRooms();
    } catch (error) {
      console.error('Error creating rehearsal room:', error);
      toast({
        title: 'Error',
        description: 'Failed to create rehearsal room',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this rehearsal room?')) return;

    try {
      const { error } = await supabase
        .from('rehearsal_rooms')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Rehearsal room deleted successfully',
      });

      loadRooms();
    } catch (error) {
      console.error('Error deleting rehearsal room:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete rehearsal room',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Music2 className="h-8 w-8" />
        <div>
          <h1 className="text-3xl font-bold">Rehearsal Rooms</h1>
          <p className="text-muted-foreground">Manage rehearsal spaces for bands</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create New Rehearsal Room</CardTitle>
          <CardDescription>Add a new rehearsal space to the game</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Room Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Select 
                  value={formData.city_id} 
                  onValueChange={(value) => {
                    setFormData({ ...formData, city_id: value, district_id: '' });
                    if (value) loadDistricts(value);
                    else setDistricts([]);
                  }}
                >
                  <SelectTrigger id="city">
                    <SelectValue placeholder="Select city" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {cities.map((city) => (
                      <SelectItem key={city.id} value={city.id}>
                        {city.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="district">District</Label>
                <Select 
                  value={formData.district_id} 
                  onValueChange={(value) => setFormData({ ...formData, district_id: value === 'none' ? '' : value })}
                  disabled={!formData.city_id || districts.length === 0}
                >
                  <SelectTrigger id="district">
                    <SelectValue placeholder="Select district" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {districts.map((district) => (
                      <SelectItem key={district.id} value={district.id}>
                        {district.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="hourly_rate">Hourly Rate ($)</Label>
                <Input
                  id="hourly_rate"
                  type="number"
                  value={formData.hourly_rate}
                  onChange={(e) => setFormData({ ...formData, hourly_rate: parseInt(e.target.value) })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="capacity">Capacity</Label>
                <Input
                  id="capacity"
                  type="number"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="quality_rating">Quality Rating (1-100)</Label>
                <Input
                  id="quality_rating"
                  type="number"
                  min="1"
                  max="100"
                  value={formData.quality_rating}
                  onChange={(e) => setFormData({ ...formData, quality_rating: parseInt(e.target.value) })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="equipment_quality">Equipment Quality (1-100)</Label>
                <Input
                  id="equipment_quality"
                  type="number"
                  min="1"
                  max="100"
                  value={formData.equipment_quality}
                  onChange={(e) => setFormData({ ...formData, equipment_quality: parseInt(e.target.value) })}
                  required
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

            <Button type="submit" className="w-full">
              <Plus className="mr-2 h-4 w-4" />
              Create Rehearsal Room
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing Rehearsal Rooms ({rooms.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {rooms.map((room) => (
              <div
                key={room.id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div className="space-y-1">
                  <h3 className="font-semibold">{room.name}</h3>
                  {room.location && (
                    <p className="text-sm text-muted-foreground">{room.location}</p>
                  )}
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    {(room.cities as any)?.name && <span>📍 {(room.cities as any).name}</span>}
                    {(room.city_districts as any)?.name && <span>• {(room.city_districts as any).name}</span>}
                  </div>
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    <span>${room.hourly_rate}/hr</span>
                    <span>Quality: {room.quality_rating}</span>
                    <span>Equipment: {room.equipment_quality}</span>
                    <span>Cap: {room.capacity}</span>
                  </div>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(room.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {rooms.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No rehearsal rooms yet. Create one above!
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
