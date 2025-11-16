import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Trophy } from "lucide-react";

export default function AchievementsAdmin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingAchievement, setEditingAchievement] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: achievements = [], isLoading } = useQuery({
    queryKey: ["admin-achievements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("achievements")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (achievement: any) => {
      const { error } = await supabase.from("achievements").insert(achievement);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-achievements"] });
      toast({ title: "Achievement created successfully" });
      setIsDialogOpen(false);
      setEditingAchievement(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...achievement }: any) => {
      const { error } = await supabase.from("achievements").update(achievement).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-achievements"] });
      toast({ title: "Achievement updated successfully" });
      setIsDialogOpen(false);
      setEditingAchievement(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("achievements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-achievements"] });
      toast({ title: "Achievement deleted successfully" });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const achievementData = {
      name: formData.get("name") as string,
      description: formData.get("description") as string,
      category: formData.get("category") as string,
      rarity: formData.get("rarity") as string,
      icon: formData.get("icon") as string,
      requirements: JSON.parse(formData.get("requirements") as string || "{}"),
      rewards: JSON.parse(formData.get("rewards") as string || "{}"),
    };

    if (editingAchievement) {
      updateMutation.mutate({ id: editingAchievement.id, ...achievementData });
    } else {
      createMutation.mutate(achievementData);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Trophy className="h-8 w-8" />
            Achievements
          </h1>
          <p className="text-muted-foreground">Manage player achievements and rewards</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingAchievement(null)}>
              <Plus className="mr-2 h-4 w-4" />
              New Achievement
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingAchievement ? "Edit" : "Create"} Achievement</DialogTitle>
              <DialogDescription>
                Configure achievement details, requirements, and rewards
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    name="name"
                    defaultValue={editingAchievement?.name}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="icon">Icon (emoji)</Label>
                  <Input
                    id="icon"
                    name="icon"
                    defaultValue={editingAchievement?.icon || "🏆"}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  defaultValue={editingAchievement?.description}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select name="category" defaultValue={editingAchievement?.category || "general"}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="performance">Performance</SelectItem>
                      <SelectItem value="songwriting">Songwriting</SelectItem>
                      <SelectItem value="social">Social</SelectItem>
                      <SelectItem value="business">Business</SelectItem>
                      <SelectItem value="milestone">Milestone</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rarity">Rarity</Label>
                  <Select name="rarity" defaultValue={editingAchievement?.rarity || "common"}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="common">Common</SelectItem>
                      <SelectItem value="uncommon">Uncommon</SelectItem>
                      <SelectItem value="rare">Rare</SelectItem>
                      <SelectItem value="epic">Epic</SelectItem>
                      <SelectItem value="legendary">Legendary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="requirements">Requirements (JSON)</Label>
                <Textarea
                  id="requirements"
                  name="requirements"
                  defaultValue={JSON.stringify(editingAchievement?.requirements || {}, null, 2)}
                  placeholder='{"type": "gigs_completed", "count": 10}'
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rewards">Rewards (JSON)</Label>
                <Textarea
                  id="rewards"
                  name="rewards"
                  defaultValue={JSON.stringify(editingAchievement?.rewards || {}, null, 2)}
                  placeholder='{"xp": 100, "cash": 500, "fame": 10}'
                  rows={4}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingAchievement ? "Update" : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Achievements</CardTitle>
          <CardDescription>{achievements.length} total achievements</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Icon</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Rarity</TableHead>
                <TableHead>Requirements</TableHead>
                <TableHead>Rewards</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {achievements.map((achievement) => (
                <TableRow key={achievement.id}>
                  <TableCell className="text-2xl">{achievement.icon}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{achievement.name}</p>
                      <p className="text-sm text-muted-foreground">{achievement.description}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{achievement.category}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={
                      achievement.rarity === "legendary" ? "default" :
                      achievement.rarity === "epic" ? "secondary" :
                      "outline"
                    }>
                      {achievement.rarity}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    <pre className="max-w-xs overflow-auto">
                      {JSON.stringify(achievement.requirements, null, 2)}
                    </pre>
                  </TableCell>
                  <TableCell className="text-xs">
                    <pre className="max-w-xs overflow-auto">
                      {JSON.stringify(achievement.rewards, null, 2)}
                    </pre>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingAchievement(achievement);
                          setIsDialogOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          if (confirm("Delete this achievement?")) {
                            deleteMutation.mutate(achievement.id);
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
    </div>
  );
}
