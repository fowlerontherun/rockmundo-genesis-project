import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminRoute } from "@/components/AdminRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Music, Plus, Edit, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

const SongwritingAdmin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProgression, setEditingProgression] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    progression: "",
    difficulty: 1,
  });

  const { data: progressions, isLoading } = useQuery({
    queryKey: ["chord-progressions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chord_progressions")
        .select("*")
        .order("difficulty");
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("chord_progressions").insert([data]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chord-progressions"] });
      toast({ title: "Chord progression created successfully" });
      setDialogOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from("chord_progressions")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chord-progressions"] });
      toast({ title: "Chord progression updated successfully" });
      setDialogOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("chord_progressions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chord-progressions"] });
      toast({ title: "Chord progression deleted successfully" });
    },
  });

  const resetForm = () => {
    setFormData({ name: "", progression: "", difficulty: 1 });
    setEditingProgression(null);
  };

  const openDialog = (progression?: any) => {
    if (progression) {
      setEditingProgression(progression);
      setFormData({
        name: progression.name,
        progression: progression.progression,
        difficulty: progression.difficulty || 1,
      });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingProgression) {
      updateMutation.mutate({ id: editingProgression.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <AdminRoute>
      <div className="container mx-auto py-8 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Songwriting Administration</h1>
            <p className="text-muted-foreground">Manage chord progressions and songwriting mechanics</p>
          </div>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Music className="h-5 w-5" />
                Chord Progressions
              </CardTitle>
              <CardDescription>
                Manage available chord progressions and their difficulty ratings
              </CardDescription>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => openDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Progression
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingProgression ? "Edit Chord Progression" : "Add Chord Progression"}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Name</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Classic Pop Progression"
                    />
                  </div>
                  <div>
                    <Label>Progression</Label>
                    <Textarea
                      value={formData.progression}
                      onChange={(e) => setFormData({ ...formData, progression: e.target.value })}
                      placeholder="e.g., C - G - Am - F"
                    />
                  </div>
                  <div>
                    <Label>Difficulty (1-10)</Label>
                    <Input
                      type="number"
                      min="1"
                      max="10"
                      value={formData.difficulty}
                      onChange={(e) => setFormData({ ...formData, difficulty: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                  <Button onClick={handleSubmit} className="w-full">
                    {editingProgression ? "Update" : "Create"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p>Loading...</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Progression</TableHead>
                    <TableHead>Difficulty</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {progressions?.map((progression) => (
                    <TableRow key={progression.id}>
                      <TableCell className="font-medium">{progression.name}</TableCell>
                      <TableCell>{progression.progression}</TableCell>
                      <TableCell>{progression.difficulty}/10</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDialog(progression)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMutation.mutate(progression.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminRoute>
  );
};

export default SongwritingAdmin;
