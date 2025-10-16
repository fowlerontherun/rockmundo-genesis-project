import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  prestige: number | null;
  quality_of_learning: number | null;
  course_cost_modifier: number | null;
  description: string | null;
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
    courseCost: 1.0,
  });

  const { data: universities, isLoading } = useQuery({
    queryKey: ["universities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("universities")
        .select("*")
        .order("prestige", { ascending: false });
      if (error) throw error;
      return data as University[];
    },
  });

  const { data: cities } = useQuery({
    queryKey: ["cities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cities")
        .select("name")
        .order("name");
      if (error) throw error;
      return data.map((c) => c.name);
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: UniversityFormValues) => {
      const payload = {
        name: values.name,
        city: values.city,
        prestige: values.prestige,
        quality_of_learning: values.qualityOfLearning,
        course_cost_modifier: values.courseCost,
      };

      if (editingId) {
        const { error } = await supabase
          .from("universities")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("universities").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["universities"] });
      toast({
        title: editingId ? "University updated" : "University created",
        description: "Changes saved successfully.",
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
      const { error } = await supabase.from("universities").delete().eq("id", id);
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
        city: university.city || "",
        prestige: university.prestige || 50,
        qualityOfLearning: university.quality_of_learning || 50,
        courseCost: university.course_cost_modifier || 1.0,
      });
    } else {
      setEditingId(null);
      setFormData({
        name: "",
        city: "",
        prestige: 50,
        qualityOfLearning: 50,
        courseCost: 1.0,
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

  const filteredUniversities = universities?.filter(uni => 
    filterCity === "all" || uni.city === filterCity
  );

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Universities</h1>
          <p className="text-muted-foreground">Manage educational institutions</p>
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
              <SelectItem key={city} value={city}>
                {city}
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
            <TableHead>Cost Modifier</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredUniversities?.map((uni) => (
            <TableRow key={uni.id}>
              <TableCell className="font-medium">{uni.name}</TableCell>
              <TableCell>{uni.city || "—"}</TableCell>
              <TableCell>{uni.prestige}</TableCell>
              <TableCell>{uni.quality_of_learning}</TableCell>
              <TableCell>{uni.course_cost_modifier}x</TableCell>
              <TableCell className="text-right space-x-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleOpenDialog(uni)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteMutation.mutate(uni.id)}
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
              Enter the university details below.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
              />
            </div>
            <div>
              <Label htmlFor="city">City</Label>
              <Select
                value={formData.city}
                onValueChange={(value) =>
                  setFormData({ ...formData, city: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a city" />
                </SelectTrigger>
                <SelectContent>
                  {cities?.map((city) => (
                    <SelectItem key={city} value={city}>
                      {city}
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
                onChange={(e) =>
                  setFormData({ ...formData, prestige: Number(e.target.value) })
                }
                required
              />
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
            <div>
              <Label htmlFor="cost">Course Cost Modifier (0.5-2.0)</Label>
              <Input
                id="cost"
                type="number"
                step="0.1"
                min="0.5"
                max="2.0"
                value={formData.courseCost}
                onChange={(e) =>
                  setFormData({ ...formData, courseCost: Number(e.target.value) })
                }
                required
              />
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
