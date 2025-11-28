import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Video, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function DikCokAdmin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingChallenge, setEditingChallenge] = useState<any>(null);

  const [formData, setFormData] = useState({
    name: "",
    theme: "",
    starts_at: "",
    ends_at: "",
    is_active: true,
  });

  const { data: challenges } = useQuery({
    queryKey: ["dikcok-challenges"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dikcok_challenges")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createChallenge = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from("dikcok_challenges")
        .insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dikcok-challenges"] });
      toast({ title: "Challenge created successfully" });
      setDialogOpen(false);
      resetForm();
    },
  });

  const updateChallenge = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const { error } = await supabase
        .from("dikcok_challenges")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dikcok-challenges"] });
      toast({ title: "Challenge updated successfully" });
      setDialogOpen(false);
      resetForm();
    },
  });

  const deleteChallenge = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("dikcok_challenges")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dikcok-challenges"] });
      toast({ title: "Challenge deleted successfully" });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      theme: "",
      starts_at: "",
      ends_at: "",
      is_active: true,
    });
    setEditingChallenge(null);
  };

  const handleEdit = (challenge: any) => {
    setEditingChallenge(challenge);
    setFormData({
      name: challenge.name,
      theme: challenge.theme || "",
      starts_at: challenge.starts_at || "",
      ends_at: challenge.ends_at || "",
      is_active: challenge.is_active,
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingChallenge) {
      updateChallenge.mutate({ id: editingChallenge.id, ...formData });
    } else {
      createChallenge.mutate(formData);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">DikCok Challenges Admin</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Add Challenge
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingChallenge ? "Edit" : "Create"} DikCok Challenge</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Challenge Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Theme</Label>
                <Input
                  value={formData.theme}
                  onChange={(e) => setFormData({ ...formData, theme: e.target.value })}
                  placeholder="e.g. Dance, Lip Sync, Comedy"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Start Date</Label>
                  <Input
                    type="datetime-local"
                    value={formData.starts_at}
                    onChange={(e) => setFormData({ ...formData, starts_at: e.target.value })}
                  />
                </div>
                <div>
                  <Label>End Date</Label>
                  <Input
                    type="datetime-local"
                    value={formData.ends_at}
                    onChange={(e) => setFormData({ ...formData, ends_at: e.target.value })}
                  />
                </div>
              </div>
              <Button onClick={handleSubmit} className="w-full">
                {editingChallenge ? "Update" : "Create"} Challenge
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Active Challenges
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Theme</TableHead>
                <TableHead>Starts</TableHead>
                <TableHead>Ends</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {challenges?.map((challenge) => (
                <TableRow key={challenge.id}>
                  <TableCell className="font-medium">{challenge.name}</TableCell>
                  <TableCell>{challenge.theme || "General"}</TableCell>
                  <TableCell>
                    {challenge.starts_at ? new Date(challenge.starts_at).toLocaleDateString() : "Not set"}
                  </TableCell>
                  <TableCell>
                    {challenge.ends_at ? new Date(challenge.ends_at).toLocaleDateString() : "Not set"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={challenge.is_active ? "default" : "secondary"}>
                      {challenge.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(challenge)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteChallenge.mutate(challenge.id)}
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
    </div>
  );
}
