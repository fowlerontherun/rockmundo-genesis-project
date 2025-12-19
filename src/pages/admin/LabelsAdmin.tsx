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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Disc, Plus, Edit, Trash2, FileText, Building2, Send, Users, Star, MapPin, TrendingUp, CheckCircle, XCircle, Clock, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

const LabelsAdmin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [labelDialogOpen, setLabelDialogOpen] = useState(false);
  const [dealDialogOpen, setDealDialogOpen] = useState(false);
  const [editingLabel, setEditingLabel] = useState<any>(null);
  const [editingDeal, setEditingDeal] = useState<any>(null);
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const [labelForm, setLabelForm] = useState({
    name: "",
    description: "",
    headquarters_city: "",
    genre_focus: [] as string[],
    roster_slot_capacity: 10,
    marketing_budget: 100000,
    reputation_score: 50,
    market_share: 0,
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

  // Fetch labels with contract counts
  const { data: labels, isLoading: labelsLoading } = useQuery({
    queryKey: ["admin-labels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("labels")
        .select(`
          *,
          artist_label_contracts(id, status)
        `)
        .order("reputation_score", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch demo submissions
  const { data: demoSubmissions } = useQuery({
    queryKey: ["admin-demo-submissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demo_submissions")
        .select(`
          *,
          labels(name),
          songs(title, quality_score),
          bands(name),
          profiles(display_name)
        `)
        .order("submitted_at", { ascending: false })
        .limit(50);
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

  // Get unique cities
  const uniqueCities = [...new Set(labels?.map(l => l.headquarters_city).filter(Boolean) || [])].sort();

  // Filter labels
  const filteredLabels = labels?.filter(label => {
    const matchesSearch = label.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      label.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCity = cityFilter === "all" || label.headquarters_city === cityFilter;
    return matchesSearch && matchesCity;
  });

  // Stats
  const totalLabels = labels?.length || 0;
  const totalContracts = labels?.reduce((sum, l) => sum + (l.artist_label_contracts?.length || 0), 0) || 0;
  const pendingDemos = demoSubmissions?.filter(d => d.status === "pending").length || 0;
  const avgReputation = labels?.length ? Math.round(labels.reduce((sum, l) => sum + (l.reputation_score || 0), 0) / labels.length) : 0;

  const createLabelMutation = useMutation({
    mutationFn: async (data: typeof labelForm) => {
      const { error } = await supabase.from("labels").insert([data]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-labels"] });
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
      queryClient.invalidateQueries({ queryKey: ["admin-labels"] });
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
      queryClient.invalidateQueries({ queryKey: ["admin-labels"] });
      toast({ title: "Label deleted successfully" });
    },
  });

  const updateDemoStatusMutation = useMutation({
    mutationFn: async ({ id, status, rejection_reason }: { id: string; status: string; rejection_reason?: string }) => {
      const { error } = await supabase
        .from("demo_submissions")
        .update({ 
          status, 
          reviewed_at: new Date().toISOString(),
          rejection_reason 
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-demo-submissions"] });
      toast({ title: "Demo status updated" });
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
      headquarters_city: "",
      genre_focus: [],
      roster_slot_capacity: 10,
      marketing_budget: 100000,
      reputation_score: 50,
      market_share: 0,
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
        headquarters_city: label.headquarters_city || "",
        genre_focus: label.genre_focus || [],
        roster_slot_capacity: label.roster_slot_capacity || 10,
        marketing_budget: label.marketing_budget || 100000,
        reputation_score: label.reputation_score || 50,
        market_share: label.market_share || 0,
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> Pending</Badge>;
      case "under_review":
        return <Badge variant="secondary" className="gap-1"><Eye className="h-3 w-3" /> Reviewing</Badge>;
      case "accepted":
        return <Badge className="gap-1 bg-green-500"><CheckCircle className="h-3 w-3" /> Accepted</Badge>;
      case "rejected":
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
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
            <p className="text-muted-foreground">Manage record labels, deals, and demo submissions</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Building2 className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{totalLabels}</p>
                <p className="text-sm text-muted-foreground">Total Labels</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Users className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{totalContracts}</p>
                <p className="text-sm text-muted-foreground">Active Contracts</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Send className="h-8 w-8 text-amber-500" />
              <div>
                <p className="text-2xl font-bold">{pendingDemos}</p>
                <p className="text-sm text-muted-foreground">Pending Demos</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Star className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">{avgReputation}</p>
                <p className="text-sm text-muted-foreground">Avg Reputation</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="labels" className="w-full">
          <TabsList>
            <TabsTrigger value="labels">Labels ({totalLabels})</TabsTrigger>
            <TabsTrigger value="demos">Demo Submissions ({demoSubmissions?.length || 0})</TabsTrigger>
            <TabsTrigger value="deals">Deal Types</TabsTrigger>
          </TabsList>

          <TabsContent value="labels">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Disc className="h-5 w-5" />
                    Record Labels
                  </CardTitle>
                  <CardDescription>Manage record labels and their rosters</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Search labels..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-48"
                  />
                  <Select value={cityFilter} onValueChange={setCityFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Filter by city" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Cities</SelectItem>
                      {uniqueCities.map((city) => (
                        <SelectItem key={city} value={city}>{city}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Name</Label>
                            <Input
                              value={labelForm.name}
                              onChange={(e) => setLabelForm({ ...labelForm, name: e.target.value })}
                              placeholder="e.g., Indie Records"
                            />
                          </div>
                          <div>
                            <Label>Headquarters City</Label>
                            <Input
                              value={labelForm.headquarters_city}
                              onChange={(e) => setLabelForm({ ...labelForm, headquarters_city: e.target.value })}
                              placeholder="e.g., Los Angeles"
                            />
                          </div>
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
                        <div className="grid grid-cols-3 gap-4">
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
                          <div>
                            <Label>Market Share (%)</Label>
                            <Input
                              type="number"
                              step="0.1"
                              value={labelForm.market_share}
                              onChange={(e) => setLabelForm({ ...labelForm, market_share: parseFloat(e.target.value) || 0 })}
                            />
                          </div>
                        </div>
                        <Button onClick={handleLabelSubmit} className="w-full">
                          {editingLabel ? "Update" : "Create"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {labelsLoading ? (
                  <p>Loading...</p>
                ) : (
                  <ScrollArea className="h-[600px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>City</TableHead>
                          <TableHead>Genres</TableHead>
                          <TableHead>Reputation</TableHead>
                          <TableHead>Budget</TableHead>
                          <TableHead>Roster</TableHead>
                          <TableHead>Contracts</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredLabels?.map((label) => {
                          const activeContracts = label.artist_label_contracts?.filter((c: any) => c.status === "active").length || 0;
                          return (
                            <TableRow key={label.id}>
                              <TableCell className="font-medium">{label.name}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <MapPin className="h-3 w-3" />
                                  {label.headquarters_city || "—"}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {label.genre_focus?.slice(0, 2).map((genre: string) => (
                                    <Badge key={genre} variant="outline" className="text-xs">{genre}</Badge>
                                  ))}
                                  {(label.genre_focus?.length || 0) > 2 && (
                                    <Badge variant="outline" className="text-xs">+{label.genre_focus.length - 2}</Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Star className="h-3 w-3 text-yellow-500" />
                                  {label.reputation_score || 0}
                                </div>
                              </TableCell>
                              <TableCell>${((label.marketing_budget || 0) / 1000000).toFixed(1)}M</TableCell>
                              <TableCell>{label.roster_slot_capacity || 0}</TableCell>
                              <TableCell>
                                <Badge variant={activeContracts > 0 ? "default" : "secondary"}>
                                  {activeContracts}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
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
                          );
                        })}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="demos">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  Demo Submissions
                </CardTitle>
                <CardDescription>Review and manage artist demo submissions</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Artist/Band</TableHead>
                        <TableHead>Song</TableHead>
                        <TableHead>Quality</TableHead>
                        <TableHead>Label</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {demoSubmissions?.map((demo) => (
                        <TableRow key={demo.id}>
                          <TableCell className="font-medium">
                            {(demo.bands as any)?.name || (demo.profiles as any)?.display_name || "Unknown"}
                          </TableCell>
                          <TableCell>{(demo.songs as any)?.title || "—"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="gap-1">
                              <TrendingUp className="h-3 w-3" />
                              {(demo.songs as any)?.quality_score || 0}%
                            </Badge>
                          </TableCell>
                          <TableCell>{(demo.labels as any)?.name || "—"}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {demo.submitted_at ? new Date(demo.submitted_at).toLocaleDateString() : "—"}
                          </TableCell>
                          <TableCell>{getStatusBadge(demo.status)}</TableCell>
                          <TableCell>
                            {demo.status === "pending" && (
                              <div className="flex gap-1">
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => updateDemoStatusMutation.mutate({ id: demo.id, status: "under_review" })}
                                >
                                  Review
                                </Button>
                                <Button 
                                  size="sm" 
                                  className="bg-green-600 hover:bg-green-700"
                                  onClick={() => updateDemoStatusMutation.mutate({ id: demo.id, status: "accepted" })}
                                >
                                  Accept
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="destructive"
                                  onClick={() => updateDemoStatusMutation.mutate({ id: demo.id, status: "rejected", rejection_reason: "Does not fit our roster" })}
                                >
                                  Reject
                                </Button>
                              </div>
                            )}
                            {demo.status === "under_review" && (
                              <div className="flex gap-1">
                                <Button 
                                  size="sm" 
                                  className="bg-green-600 hover:bg-green-700"
                                  onClick={() => updateDemoStatusMutation.mutate({ id: demo.id, status: "accepted" })}
                                >
                                  Accept
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="destructive"
                                  onClick={() => updateDemoStatusMutation.mutate({ id: demo.id, status: "rejected", rejection_reason: "Does not fit our roster" })}
                                >
                                  Reject
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!demoSubmissions || demoSubmissions.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                            No demo submissions yet
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
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