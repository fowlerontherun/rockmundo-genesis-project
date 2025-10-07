import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Star } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Studio {
  id: string;
  city_id: string;
  district_id: string | null;
  name: string;
  hourly_rate: number;
  quality_rating: number;
  specialties: string[] | null;
  equipment_rating: number;
  available_slots: number;
  city?: { name: string; country: string };
  district?: { name: string };
}

interface City {
  id: string;
  name: string;
  country: string;
}

interface District {
  id: string;
  name: string;
}

const SPECIALTY_OPTIONS = ["recording", "mixing", "mastering", "production"];

const CityStudios = () => {
  const [studios, setStudios] = useState<Studio[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStudio, setEditingStudio] = useState<Studio | null>(null);
  const [formData, setFormData] = useState({
    city_id: "",
    district_id: "",
    name: "",
    hourly_rate: 100,
    quality_rating: 50,
    specialties: [] as string[],
    equipment_rating: 50,
    available_slots: 10,
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (formData.city_id) {
      loadDistricts(formData.city_id);
    }
  }, [formData.city_id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [studiosResult, citiesResult] = await Promise.all([
        supabase
          .from("city_studios")
          .select("*, city:cities(name, country), district:city_districts(name)")
          .order("quality_rating", { ascending: false }),
        supabase.from("cities").select("id, name, country").order("name"),
      ]);

      if (studiosResult.data) setStudios(studiosResult.data);
      if (citiesResult.data) setCities(citiesResult.data);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load studios");
    } finally {
      setLoading(false);
    }
  };

  const loadDistricts = async (cityId: string) => {
    try {
      const { data } = await supabase
        .from("city_districts")
        .select("id, name")
        .eq("city_id", cityId)
        .order("name");

      if (data) setDistricts(data);
    } catch (error) {
      console.error("Error loading districts:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const dataToSave = {
        ...formData,
        district_id: formData.district_id || null,
      };

      if (editingStudio) {
        const { error } = await supabase
          .from("city_studios")
          .update(dataToSave)
          .eq("id", editingStudio.id);

        if (error) throw error;
        toast.success("Studio updated successfully");
      } else {
        const { error } = await supabase.from("city_studios").insert(dataToSave);

        if (error) throw error;
        toast.success("Studio created successfully");
      }

      setDialogOpen(false);
      setEditingStudio(null);
      resetForm();
      loadData();
    } catch (error) {
      console.error("Error saving studio:", error);
      toast.error("Failed to save studio");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this studio?")) return;

    try {
      const { error } = await supabase.from("city_studios").delete().eq("id", id);

      if (error) throw error;
      toast.success("Studio deleted successfully");
      loadData();
    } catch (error) {
      console.error("Error deleting studio:", error);
      toast.error("Failed to delete studio");
    }
  };

  const handleEdit = (studio: Studio) => {
    setEditingStudio(studio);
    setFormData({
      city_id: studio.city_id,
      district_id: studio.district_id || "",
      name: studio.name,
      hourly_rate: studio.hourly_rate,
      quality_rating: studio.quality_rating,
      specialties: studio.specialties || [],
      equipment_rating: studio.equipment_rating,
      available_slots: studio.available_slots,
    });
    if (studio.city_id) {
      loadDistricts(studio.city_id);
    }
    setDialogOpen(true);
  };

  const toggleSpecialty = (specialty: string) => {
    setFormData((prev) => ({
      ...prev,
      specialties: prev.specialties.includes(specialty)
        ? prev.specialties.filter((s) => s !== specialty)
        : [...prev.specialties, specialty],
    }));
  };

  const resetForm = () => {
    setFormData({
      city_id: "",
      district_id: "",
      name: "",
      hourly_rate: 100,
      quality_rating: 50,
      specialties: [],
      equipment_rating: 50,
      available_slots: 10,
    });
    setDistricts([]);
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
          <h1 className="text-3xl font-bold tracking-tight">Recording Studios</h1>
          <p className="text-muted-foreground">Manage recording studios across all cities</p>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setEditingStudio(null);
              resetForm();
            }
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Studio
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>{editingStudio ? "Edit Studio" : "Add New Studio"}</DialogTitle>
                <DialogDescription>Create a new recording studio in a city</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="city">City</Label>
                  <Select
                    value={formData.city_id}
                    onValueChange={(value) => setFormData({ ...formData, city_id: value, district_id: "" })}
                  >
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
                {districts.length > 0 && (
                  <div className="grid gap-2">
                    <Label htmlFor="district">District (Optional)</Label>
                    <Select
                      value={formData.district_id}
                      onValueChange={(value) => setFormData({ ...formData, district_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a district" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {districts.map((district) => (
                          <SelectItem key={district.id} value={district.id}>
                            {district.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="grid gap-2">
                  <Label htmlFor="name">Studio Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Abbey Road Studios"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Specialties</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {SPECIALTY_OPTIONS.map((specialty) => (
                      <div key={specialty} className="flex items-center space-x-2">
                        <Checkbox
                          id={specialty}
                          checked={formData.specialties.includes(specialty)}
                          onCheckedChange={() => toggleSpecialty(specialty)}
                        />
                        <label
                          htmlFor={specialty}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {specialty.charAt(0).toUpperCase() + specialty.slice(1)}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="hourly_rate">Hourly Rate ($)</Label>
                    <Input
                      id="hourly_rate"
                      type="number"
                      min="0"
                      value={formData.hourly_rate}
                      onChange={(e) => setFormData({ ...formData, hourly_rate: parseInt(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="available_slots">Available Slots</Label>
                    <Input
                      id="available_slots"
                      type="number"
                      min="0"
                      value={formData.available_slots}
                      onChange={(e) => setFormData({ ...formData, available_slots: parseInt(e.target.value) })}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="quality">Quality Rating (0-100)</Label>
                    <Input
                      id="quality"
                      type="number"
                      min="0"
                      max="100"
                      value={formData.quality_rating}
                      onChange={(e) => setFormData({ ...formData, quality_rating: parseInt(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="equipment">Equipment Rating (0-100)</Label>
                    <Input
                      id="equipment"
                      type="number"
                      min="0"
                      max="100"
                      value={formData.equipment_rating}
                      onChange={(e) => setFormData({ ...formData, equipment_rating: parseInt(e.target.value) })}
                      required
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">{editingStudio ? "Update" : "Create"} Studio</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Studios</CardTitle>
          <CardDescription>
            {studios.length} {studios.length === 1 ? "studio" : "studios"} across all cities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Studio</TableHead>
                <TableHead>City</TableHead>
                <TableHead>District</TableHead>
                <TableHead>Specialties</TableHead>
                <TableHead className="text-center">Quality</TableHead>
                <TableHead className="text-right">Rate/hr</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {studios.map((studio) => (
                <TableRow key={studio.id}>
                  <TableCell className="font-medium">{studio.name}</TableCell>
                  <TableCell>
                    {studio.city ? `${studio.city.name}, ${studio.city.country}` : "Unknown"}
                  </TableCell>
                  <TableCell>{studio.district?.name || "-"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {studio.specialties?.map((specialty) => (
                        <Badge key={specialty} variant="secondary" className="text-xs">
                          {specialty}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                      <span>{studio.quality_rating}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">${studio.hourly_rate}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleEdit(studio)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(studio.id)}>
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

export default CityStudios;
