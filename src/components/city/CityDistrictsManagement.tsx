import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
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
}

interface CityDistrictsManagementProps {
  cityId: string;
  districts: District[];
  onDistrictAdded: () => void;
}

export const CityDistrictsManagement = ({ cityId, districts, onDistrictAdded }: CityDistrictsManagementProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDistrict, setEditingDistrict] = useState<District | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    vibe: "",
    safety_rating: 50,
    music_scene_rating: 50,
    rent_cost: 100,
  });

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
        const { error } = await supabase
          .from("city_districts")
          .insert({ ...formData, city_id: cityId });

        if (error) throw error;
        toast.success("District created successfully");
      }

      setDialogOpen(false);
      setEditingDistrict(null);
      resetForm();
      onDistrictAdded();
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
      onDistrictAdded();
    } catch (error) {
      console.error("Error deleting district:", error);
      toast.error("Failed to delete district");
    }
  };

  const handleEdit = (district: District) => {
    setEditingDistrict(district);
    setFormData({
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
      name: "",
      description: "",
      vibe: "",
      safety_rating: 50,
      music_scene_rating: 50,
      rent_cost: 100,
    });
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Districts</h3>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setEditingDistrict(null);
              resetForm();
            }
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add District
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>{editingDistrict ? "Edit District" : "Add New District"}</DialogTitle>
                <DialogDescription>
                  Create a new district or neighborhood within this city
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
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

      {districts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No districts yet. Add one to get started.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>District</TableHead>
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
      )}
    </div>
  );
};
