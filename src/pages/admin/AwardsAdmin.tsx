import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Trophy, Plus, Calendar, Users, Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

const AwardsAdmin = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newShow, setNewShow] = useState({
    show_name: "",
    show_date: "",
    venue_name: "",
    categories: "",
  });

  const { data: shows = [] } = useQuery({
    queryKey: ["admin-award-shows"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("award_shows")
        .select("*")
        .order("show_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: nominations = [] } = useQuery({
    queryKey: ["admin-nominations"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("award_nominations")
        .select("*, award_shows(show_name), bands(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const createShow = useMutation({
    mutationFn: async (showData: typeof newShow) => {
      const categories = showData.categories.split(",").map(c => c.trim());
      const { data, error } = await (supabase as any)
        .from("award_shows")
        .insert([{
          show_name: showData.show_name,
          show_date: showData.show_date,
          venue_name: showData.venue_name,
          categories,
          status: "nominations_open",
        }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-award-shows"] });
      toast({ title: "Award Show Created" });
      setDialogOpen(false);
      setNewShow({ show_name: "", show_date: "", venue_name: "", categories: "" });
    },
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Trophy className="h-8 w-8" />
            Awards Administration
          </h1>
          <p className="text-muted-foreground">Manage award shows and nominations</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Award Show
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Award Show</DialogTitle>
              <DialogDescription>Set up a new award show for the community</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Show Name</Label>
                <Input
                  value={newShow.show_name}
                  onChange={(e) => setNewShow({ ...newShow, show_name: e.target.value })}
                  placeholder="e.g., The Grammys"
                />
              </div>
              <div>
                <Label>Show Date</Label>
                <Input
                  type="date"
                  value={newShow.show_date}
                  onChange={(e) => setNewShow({ ...newShow, show_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Venue Name</Label>
                <Input
                  value={newShow.venue_name}
                  onChange={(e) => setNewShow({ ...newShow, venue_name: e.target.value })}
                  placeholder="e.g., Staples Center"
                />
              </div>
              <div>
                <Label>Categories (comma-separated)</Label>
                <Input
                  value={newShow.categories}
                  onChange={(e) => setNewShow({ ...newShow, categories: e.target.value })}
                  placeholder="Best Album, Best Song, Best New Artist"
                />
              </div>
              <Button onClick={() => createShow.mutate(newShow)} className="w-full">
                Create Show
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="shows">
        <TabsList>
          <TabsTrigger value="shows">Award Shows</TabsTrigger>
          <TabsTrigger value="nominations">Nominations</TabsTrigger>
        </TabsList>

        <TabsContent value="shows" className="space-y-4">
          <div className="grid gap-4">
            {shows.map((show: any) => (
              <Card key={show.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{show.show_name}</CardTitle>
                    <Badge>{show.status}</Badge>
                  </div>
                  <CardDescription>
                    <Calendar className="h-4 w-4 inline mr-2" />
                    {format(new Date(show.show_date), "PPP")} • {show.venue_name}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {(show.categories || []).map((cat: string) => (
                      <Badge key={cat} variant="outline">{cat}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="nominations">
          <Card>
            <CardHeader>
              <CardTitle>All Nominations</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Show</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Band</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nominations.map((nom: any) => (
                    <TableRow key={nom.id}>
                      <TableCell>{nom.award_shows?.show_name}</TableCell>
                      <TableCell>{nom.category}</TableCell>
                      <TableCell>{nom.bands?.name}</TableCell>
                      <TableCell>{nom.nomination_type}</TableCell>
                      <TableCell><Badge>{nom.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AwardsAdmin;
