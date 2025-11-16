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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Disc, Plus, Edit, Trash2, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

const LabelsAdmin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [labelDialogOpen, setLabelDialogOpen] = useState(false);
  const [dealDialogOpen, setDealDialogOpen] = useState(false);
  const [editingLabel, setEditingLabel] = useState<any>(null);
  const [editingDeal, setEditingDeal] = useState<any>(null);

  const [labelForm, setLabelForm] = useState({
    name: "",
    description: "",
    genre_focus: [] as string[],
    roster_slot_capacity: 10,
    marketing_budget: 100000,
    reputation_score: 50,
  });

  const [dealForm, setDealForm] = useState({
    name: "",
    description: "",
    royalty_artist_pct: 70,
    advance_min: 5000,
    advance_max: 50000,
    default_term_months: 36,
    default_release_quota: 2,
  });

  const { data: labels, isLoading: labelsLoading } = useQuery({
    queryKey: ["labels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("labels")
        .select("*")
        .order("prestige_tier", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: dealTypes, isLoading: dealsLoading } = useQuery({
    queryKey: ["label-deal-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("label_deal_types")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createLabelMutation = useMutation({
    mutationFn: async (data: typeof labelForm) => {
      const { error } = await supabase.from("labels").insert([data]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["labels"] });
      toast({ title: "Label created successfully" });
      setLabelDialogOpen(false);
      resetLabelForm();
    },
  });

  const updateLabelMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof labelForm }) => {
      const { error } = await supabase.from("labels").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["labels"] });
      toast({ title: "Label updated successfully" });
      setLabelDialogOpen(false);
      resetLabelForm();
    },
  });

  const deleteLabelMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("labels").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["labels"] });
      toast({ title: "Label deleted successfully" });
    },
  });

  const createDealMutation = useMutation({
    mutationFn: async (data: typeof dealForm) => {
      const { error } = await supabase.from("label_deal_types").insert([data]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["label-deal-types"] });
      toast({ title: "Deal type created successfully" });
      setDealDialogOpen(false);
      resetDealForm();
    },
  });

  const updateDealMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof dealForm }) => {
      const { error } = await supabase.from("label_deal_types").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["label-deal-types"] });
      toast({ title: "Deal type updated successfully" });
      setDealDialogOpen(false);
      resetDealForm();
    },
  });

  const deleteDealMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("label_deal_types").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["label-deal-types"] });
      toast({ title: "Deal type deleted successfully" });
    },
  });

  const resetLabelForm = () => {
    setLabelForm({
      name: "",
      description: "",
      genre_focus: [],
      roster_slot_capacity: 10,
      marketing_budget: 100000,
      reputation_score: 50,
    });
    setEditingLabel(null);
  };

  const resetDealForm = () => {
    setDealForm({
      name: "",
      description: "",
      royalty_artist_pct: 70,
      advance_min: 5000,
      advance_max: 50000,
      default_term_months: 36,
      default_release_quota: 2,
    });
    setEditingDeal(null);
  };

  const openLabelDialog = (label?: any) => {
    if (label) {
      setEditingLabel(label);
      setLabelForm({
        name: label.name || "",
        description: label.description || "",
        genre_focus: label.genre_focus || [],
        roster_slot_capacity: label.roster_slot_capacity || 10,
        marketing_budget: label.marketing_budget || 100000,
        reputation_score: label.reputation_score || 50,
      });
    } else {
      resetLabelForm();
    }
    setLabelDialogOpen(true);
  };

  const openDealDialog = (deal?: any) => {
    if (deal) {
      setEditingDeal(deal);
      setDealForm({
        name: deal.name || "",
        description: deal.description || "",
        royalty_artist_pct: deal.royalty_artist_pct || 70,
        advance_min: deal.advance_min || 5000,
        advance_max: deal.advance_max || 50000,
        default_term_months: deal.default_term_months || 36,
        default_release_quota: deal.default_release_quota || 2,
      });
    } else {
      resetDealForm();
    }
    setDealDialogOpen(true);
  };

  const handleLabelSubmit = () => {
    if (editingLabel) {
      updateLabelMutation.mutate({ id: editingLabel.id, data: labelForm });
    } else {
      createLabelMutation.mutate(labelForm);
    }
  };

  const handleDealSubmit = () => {
    if (editingDeal) {
      updateDealMutation.mutate({ id: editingDeal.id, data: dealForm });
    } else {
      createDealMutation.mutate(dealForm);
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
            <h1 className="text-3xl font-bold">Record Labels Administration</h1>
            <p className="text-muted-foreground">Manage record labels and deal structures</p>
          </div>
        </div>

        <Tabs defaultValue="labels" className="w-full">
          <TabsList>
            <TabsTrigger value="labels">Labels</TabsTrigger>
            <TabsTrigger value="deals">Deal Types</TabsTrigger>
          </TabsList>

          <TabsContent value="labels">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Disc className="h-5 w-5" />
                    Record Labels
                  </CardTitle>
                  <CardDescription>Manage record labels and their rosters</CardDescription>
                </div>
                <Dialog open={labelDialogOpen} onOpenChange={setLabelDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => openLabelDialog()}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Label
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>{editingLabel ? "Edit Label" : "Add Label"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Name</Label>
                        <Input
                          value={labelForm.name}
                          onChange={(e) => setLabelForm({ ...labelForm, name: e.target.value })}
                          placeholder="e.g., Indie Records"
                        />
                      </div>
                      <div>
                        <Label>Description</Label>
                        <Textarea
                          value={labelForm.description}
                          onChange={(e) => setLabelForm({ ...labelForm, description: e.target.value })}
                          placeholder="Label description..."
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Genre Focus (comma-separated)</Label>
                          <Input
                            value={labelForm.genre_focus.join(", ")}
                            onChange={(e) => setLabelForm({ ...labelForm, genre_focus: e.target.value.split(",").map(s => s.trim()) })}
                            placeholder="e.g., Rock, Metal"
                          />
                        </div>
                        <div>
                          <Label>Reputation Score (0-100)</Label>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={labelForm.reputation_score}
                            onChange={(e) => setLabelForm({ ...labelForm, reputation_score: parseInt(e.target.value) || 0 })}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Marketing Budget ($)</Label>
                          <Input
                            type="number"
                            value={labelForm.marketing_budget}
                            onChange={(e) => setLabelForm({ ...labelForm, marketing_budget: parseInt(e.target.value) || 0 })}
                          />
                        </div>
                        <div>
                          <Label>Roster Capacity</Label>
                          <Input
                            type="number"
                            value={labelForm.roster_slot_capacity}
                            onChange={(e) => setLabelForm({ ...labelForm, roster_slot_capacity: parseInt(e.target.value) || 10 })}
                          />
                        </div>
                      </div>
                      <Button onClick={handleLabelSubmit} className="w-full">
                        {editingLabel ? "Update" : "Create"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {labelsLoading ? (
                  <p>Loading...</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Genres</TableHead>
                        <TableHead>Reputation</TableHead>
                        <TableHead>Budget</TableHead>
                        <TableHead>Capacity</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {labels?.map((label) => (
                        <TableRow key={label.id}>
                          <TableCell className="font-medium">{label.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{label.genre_focus?.join(", ") || "Any"}</Badge>
                          </TableCell>
                          <TableCell>{label.reputation_score || 0}</TableCell>
                          <TableCell>${label.marketing_budget?.toLocaleString() || 0}</TableCell>
                          <TableCell>{label.roster_slot_capacity || 0}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button variant="ghost" size="icon" onClick={() => openLabelDialog(label)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteLabelMutation.mutate(label.id)}
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
          </TabsContent>

          <TabsContent value="deals">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Deal Types
                  </CardTitle>
                  <CardDescription>Configure contract templates and terms</CardDescription>
                </div>
                <Dialog open={dealDialogOpen} onOpenChange={setDealDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => openDealDialog()}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Deal Type
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>{editingDeal ? "Edit Deal Type" : "Add Deal Type"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Deal Name</Label>
                        <Input
                          value={dealForm.name}
                          onChange={(e) => setDealForm({ ...dealForm, name: e.target.value })}
                          placeholder="e.g., 360 Deal"
                        />
                      </div>
                      <div>
                        <Label>Description</Label>
                        <Textarea
                          value={dealForm.description}
                          onChange={(e) => setDealForm({ ...dealForm, description: e.target.value })}
                          placeholder="Deal description..."
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label>Min Advance ($)</Label>
                          <Input
                            type="number"
                            value={dealForm.advance_min}
                            onChange={(e) => setDealForm({ ...dealForm, advance_min: parseInt(e.target.value) || 0 })}
                          />
                        </div>
                        <div>
                          <Label>Max Advance ($)</Label>
                          <Input
                            type="number"
                            value={dealForm.advance_max}
                            onChange={(e) => setDealForm({ ...dealForm, advance_max: parseInt(e.target.value) || 0 })}
                          />
                        </div>
                        <div>
                          <Label>Artist Royalty (%)</Label>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={dealForm.royalty_artist_pct}
                            onChange={(e) => setDealForm({ ...dealForm, royalty_artist_pct: parseInt(e.target.value) || 0 })}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Term (Months)</Label>
                          <Input
                            type="number"
                            value={dealForm.default_term_months}
                            onChange={(e) => setDealForm({ ...dealForm, default_term_months: parseInt(e.target.value) || 12 })}
                          />
                        </div>
                        <div>
                          <Label>Release Quota</Label>
                          <Input
                            type="number"
                            value={dealForm.default_release_quota}
                            onChange={(e) => setDealForm({ ...dealForm, default_release_quota: parseInt(e.target.value) || 1 })}
                          />
                        </div>
                      </div>
                      <Button onClick={handleDealSubmit} className="w-full">
                        {editingDeal ? "Update" : "Create"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {dealsLoading ? (
                  <p>Loading...</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Deal Name</TableHead>
                        <TableHead>Advance Range</TableHead>
                        <TableHead>Artist %</TableHead>
                        <TableHead>Term</TableHead>
                        <TableHead>Releases</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dealTypes?.map((deal) => (
                        <TableRow key={deal.id}>
                          <TableCell className="font-medium">{deal.name}</TableCell>
                          <TableCell>${deal.advance_min?.toLocaleString() || 0} - ${deal.advance_max?.toLocaleString() || 0}</TableCell>
                          <TableCell>{deal.royalty_artist_pct}%</TableCell>
                          <TableCell>{deal.default_term_months} months</TableCell>
                          <TableCell>{deal.default_release_quota} releases</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button variant="ghost" size="icon" onClick={() => openDealDialog(deal)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteDealMutation.mutate(deal.id)}
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
          </TabsContent>
        </Tabs>
      </div>
    </AdminRoute>
  );
};

export default LabelsAdmin;
