import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface District {
  id: string;
  city_id: string;
  name: string;
  description: string | null;
  vibe: string | null;
  safety_rating: number;
  music_scene_rating: number;
  rent_cost: number;
  city?: { name: string; country: string };
}

interface City {
  id: string;
  name: string;
  country: string;
}

const Districts = () => {
  const [districts, setDistricts] = useState<District[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDistrict, setEditingDistrict] = useState<District | null>(null);
  const [formData, setFormData] = useState({
    city_id: "",
    name: "",
    description: "",
    vibe: "",
    safety_rating: 50,
    music_scene_rating: 50,
    rent_cost: 100,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [districtsResult, citiesResult] = await Promise.all([
        supabase
          .from("city_districts")
          .select("*, city:cities(name, country)")
          .order("name"),
        supabase.from("cities").select("id, name, country").order("name"),
      ]);

      if (districtsResult.data) setDistricts(districtsResult.data);
      if (citiesResult.data) setCities(citiesResult.data);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load districts");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingDistrict) {
        const { error } = await supabase
          .from("city_districts")
          .update(formData)
          .eq("id", editingDistrict.id);

        if (error) throw error;
        toast.success("District updated successfully");
      } else {
        const { error } = await supabase.from("city_districts").insert(formData);

        if (error) throw error;
        toast.success("District created successfully");
      }

      setDialogOpen(false);
      setEditingDistrict(null);
      resetForm();
      loadData();
    } catch (error) {
      console.error("Error saving district:", error);
      toast.error("Failed to save district");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this district?")) return;

    try {
      const { error } = await supabase.from("city_districts").delete().eq("id", id);

      if (error) throw error;
      toast.success("District deleted successfully");
      loadData();
    } catch (error) {
      console.error("Error deleting district:", error);
      toast.error("Failed to delete district");
    }
  };

  const handleEdit = (district: District) => {
    setEditingDistrict(district);
    setFormData({
      city_id: district.city_id,
      name: district.name,
      description: district.description || "",
      vibe: district.vibe || "",
      safety_rating: district.safety_rating,
      music_scene_rating: district.music_scene_rating,
      rent_cost: district.rent_cost,
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      city_id: "",
      name: "",
      description: "",
      vibe: "",
      safety_rating: 50,
      music_scene_rating: 50,
      rent_cost: 100,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">City Districts</h1>
          <p className="text-muted-foreground">Manage neighborhoods and districts within cities</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingDistrict(null);
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add District
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>{editingDistrict ? "Edit District" : "Add New District"}</DialogTitle>
                <DialogDescription>
                  Create a new district or neighborhood within a city
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="city">City</Label>
                  <Select value={formData.city_id} onValueChange={(value) => setFormData({ ...formData, city_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a city" />
                    </SelectTrigger>
                    <SelectContent>
                      {cities.map((city) => (
                        <SelectItem key={city.id} value={city.id}>
                          {city.name}, {city.country}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="name">District Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Camden"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="vibe">Vibe</Label>
                  <Input
                    id="vibe"
                    value={formData.vibe}
                    onChange={(e) => setFormData({ ...formData, vibe: e.target.value })}
                    placeholder="Alternative/Punk"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe the district's character and music scene..."
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="safety">Safety Rating (0-100)</Label>
                    <Input
                      id="safety"
                      type="number"
                      min="0"
                      max="100"
                      value={formData.safety_rating}
                      onChange={(e) => setFormData({ ...formData, safety_rating: parseInt(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="music_scene">Music Scene (0-100)</Label>
                    <Input
                      id="music_scene"
                      type="number"
                      min="0"
                      max="100"
                      value={formData.music_scene_rating}
                      onChange={(e) => setFormData({ ...formData, music_scene_rating: parseInt(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="rent">Rent Cost</Label>
                    <Input
                      id="rent"
                      type="number"
                      min="0"
                      value={formData.rent_cost}
                      onChange={(e) => setFormData({ ...formData, rent_cost: parseInt(e.target.value) })}
                      required
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">{editingDistrict ? "Update" : "Create"} District</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Districts</CardTitle>
          <CardDescription>
            {districts.length} {districts.length === 1 ? "district" : "districts"} across all cities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>District</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Vibe</TableHead>
                <TableHead className="text-center">Music Scene</TableHead>
                <TableHead className="text-center">Safety</TableHead>
                <TableHead className="text-right">Rent</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {districts.map((district) => (
                <TableRow key={district.id}>
                  <TableCell className="font-medium">{district.name}</TableCell>
                  <TableCell>
                    {district.city ? `${district.city.name}, ${district.city.country}` : "Unknown"}
                  </TableCell>
                  <TableCell>
                    {district.vibe && <Badge variant="secondary">{district.vibe}</Badge>}
                  </TableCell>
                  <TableCell className="text-center">{district.music_scene_rating}%</TableCell>
                  <TableCell className="text-center">{district.safety_rating}%</TableCell>
                  <TableCell className="text-right">${district.rent_cost}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleEdit(district)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(district.id)}>
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
    </div>
  );
};

export default Districts;
