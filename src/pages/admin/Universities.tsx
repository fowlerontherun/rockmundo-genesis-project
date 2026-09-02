import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { UniversityFormValues } from "./universities.helpers";
import { universitySchema } from "./universities.helpers";

interface University {
  id: string;
  name: string;
  city: string | null;
  city_id: string;
  prestige: number | null;
  quality_of_learning: number | null;
  academic_cost_modifier: number | null;
  mayor_fee_modifier: number | null;
  course_cost_modifier: number | null;
  description: string | null;
}

interface CityOption {
  id: string;
  name: string;
}

export default function Universities() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterCity, setFilterCity] = useState("all");
  const [formData, setFormData] = useState<UniversityFormValues>({
    name: "",
    city: "",
    prestige: 50,
    qualityOfLearning: 50,
  });

  const { data: universities, isLoading } = useQuery({
    queryKey: ["universities"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("universities")
        .select("*")
        .order("prestige", { ascending: false });
      if (error) throw error;
      return data as University[];
    },
  });

  const { data: cities } = useQuery({
    queryKey: ["cities", "university-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cities")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data as CityOption[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: UniversityFormValues) => {
      const selectedCity = cities?.find((city) => city.name === values.city);
      if (!selectedCity) throw new Error("Select a valid city before saving.");

      const payload = {
        name: values.name,
        city: selectedCity.name,
        city_id: selectedCity.id,
        prestige: values.prestige,
        quality_of_learning: values.qualityOfLearning,
      };

      if (editingId) {
        const { error } = await (supabase as any)
          .from("universities")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("universities").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["universities"] });
      toast({
        title: editingId ? "University updated" : "University created",
        description: "Changes saved successfully. Academic pricing was recalculated automatically.",
      });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("universities").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["universities"] });
      toast({
        title: "University deleted",
        description: "University removed successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleOpenDialog = (university?: University) => {
    if (university) {
      setEditingId(university.id);
      setFormData({
        name: university.name,
        city: university.city ?? "",
        prestige: university.prestige ?? 50,
        qualityOfLearning: university.quality_of_learning ?? 50,
      });
    } else {
      setEditingId(null);
      setFormData({
        name: "",
        city: "",
        prestige: 50,
        qualityOfLearning: 50,
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = universitySchema.safeParse(formData);
    if (!result.success) {
      toast({
        title: "Validation Error",
        description: result.error.errors[0].message,
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate(result.data);
  };

  const filteredUniversities = universities?.filter(
    (university) => filterCity === "all" || university.city === filterCity,
  );

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Universities</h1>
          <p className="text-muted-foreground">
            Manage academic quality and prestige. Student pricing is derived from the academic baseline and local mayor fee policy.
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Add University
        </Button>
      </div>

      <div className="flex gap-4">
        <Select value={filterCity} onValueChange={setFilterCity}>
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder="Filter by city" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Cities</SelectItem>
            {cities?.map((city) => (
              <SelectItem key={city.id} value={city.name}>
                {city.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>City</TableHead>
            <TableHead>Prestige</TableHead>
            <TableHead>Quality</TableHead>
            <TableHead>Academic Cost</TableHead>
            <TableHead>Mayor Fee</TableHead>
            <TableHead>Effective Cost</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredUniversities?.map((university) => (
            <TableRow key={university.id}>
              <TableCell className="font-medium">{university.name}</TableCell>
              <TableCell>{university.city || "—"}</TableCell>
              <TableCell>{university.prestige}</TableCell>
              <TableCell>{university.quality_of_learning}</TableCell>
              <TableCell>{Number(university.academic_cost_modifier ?? 1).toFixed(2)}x</TableCell>
              <TableCell>{Number(university.mayor_fee_modifier ?? 1).toFixed(2)}x</TableCell>
              <TableCell className="font-semibold">{Number(university.course_cost_modifier ?? 1).toFixed(2)}x</TableCell>
              <TableCell className="text-right space-x-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleOpenDialog(university)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteMutation.mutate(university.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit University" : "Add University"}
            </DialogTitle>
            <DialogDescription>
              Set the institution's academic attributes. Mayors can later invest in quality and set local course fees, but cannot alter prestige.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="city">City</Label>
              <Select
                value={formData.city}
                onValueChange={(value) => setFormData({ ...formData, city: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a city" />
                </SelectTrigger>
                <SelectContent>
                  {cities?.map((city) => (
                    <SelectItem key={city.id} value={city.name}>
                      {city.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="prestige">Prestige (0-100)</Label>
              <Input
                id="prestige"
                type="number"
                min="0"
                max="100"
                value={formData.prestige}
                onChange={(e) => setFormData({ ...formData, prestige: Number(e.target.value) })}
                required
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Prestige is an admin-set long-term reputation value and is never changed by mayor university upgrades.
              </p>
            </div>
            <div>
              <Label htmlFor="quality">Quality of Learning (0-100)</Label>
              <Input
                id="quality"
                type="number"
                min="0"
                max="100"
                value={formData.qualityOfLearning}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    qualityOfLearning: Number(e.target.value),
                  })
                }
                required
              />
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
              Course pricing is calculated automatically from prestige and quality, then adjusted by the current mayor's fee policy. The final multiplier is intentionally read-only here so the two systems cannot drift apart.
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
