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
  const [bandSearch, setBandSearch] = useState("");
  const [selectedBand, setSelectedBand] = useState<{ id: string; name: string } | null>(null);
  const [inviteForm, setInviteForm] = useState({
    award_show_id: "",
    invite_type: "performer" as "performer" | "presenter" | "attendee",
    slot_label: "",
    stage: "",
    performance_fee: "0",
    message: "",
  });

  const { data: bandOptions = [] } = useNominatableBands(bandSearch);
  const { data: invites = [] } = useAwardShowInvites();
  const inviteBand = useInviteBandToPerform();


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
          <TabsTrigger value="invites">Performance Invites</TabsTrigger>
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

        <TabsContent value="invites" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Invite a band to perform
              </CardTitle>
              <CardDescription>Send performance, presenter or attendance invitations to any band.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label>Award show</Label>
                  <select
                    className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                    value={inviteForm.award_show_id}
                    onChange={(e) => setInviteForm({ ...inviteForm, award_show_id: e.target.value })}
                  >
                    <option value="">Select a show…</option>
                    {shows.map((show: any) => (
                      <option key={show.id} value={show.id}>{show.show_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Invite type</Label>
                  <select
                    className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                    value={inviteForm.invite_type}
                    onChange={(e) => setInviteForm({ ...inviteForm, invite_type: e.target.value as any })}
                  >
                    <option value="performer">Performer</option>
                    <option value="presenter">Presenter</option>
                    <option value="attendee">Attendee</option>
                  </select>
                </div>
                <div>
                  <Label>Slot label</Label>
                  <Input
                    value={inviteForm.slot_label}
                    onChange={(e) => setInviteForm({ ...inviteForm, slot_label: e.target.value })}
                    placeholder="e.g., Opening number"
                  />
                </div>
                <div>
                  <Label>Stage</Label>
                  <Input
                    value={inviteForm.stage}
                    onChange={(e) => setInviteForm({ ...inviteForm, stage: e.target.value })}
                    placeholder="e.g., Main stage"
                  />
                </div>
                <div>
                  <Label>Performance fee ($)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={inviteForm.performance_fee}
                    onChange={(e) => setInviteForm({ ...inviteForm, performance_fee: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Message</Label>
                  <Input
                    value={inviteForm.message}
                    onChange={(e) => setInviteForm({ ...inviteForm, message: e.target.value })}
                    placeholder="Optional note to the band"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Band</Label>
                <Input
                  value={bandSearch}
                  onChange={(e) => setBandSearch(e.target.value)}
                  placeholder="Search bands by name…"
                />
                <div className="max-h-48 overflow-y-auto divide-y rounded-md border">
                  {bandOptions.length === 0 && (
                    <p className="p-3 text-xs text-muted-foreground">No bands matched that search.</p>
                  )}
                  {bandOptions.map((band) => (
                    <button
                      key={band.id}
                      type="button"
                      onClick={() => setSelectedBand({ id: band.id, name: band.name })}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-muted/60 ${selectedBand?.id === band.id ? "bg-primary/10" : ""}`}
                    >
                      <span className="font-medium">{band.name}</span>
                      <span className="text-muted-foreground">
                        {band.genre || "Unknown"} · {Number(band.fame ?? 0).toLocaleString()} fame
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <Button
                disabled={!inviteForm.award_show_id || !selectedBand || inviteBand.isPending}
                onClick={() => {
                  if (!selectedBand) return;
                  inviteBand.mutate({
                    award_show_id: inviteForm.award_show_id,
                    band_id: selectedBand.id,
                    invite_type: inviteForm.invite_type,
                    slot_label: inviteForm.slot_label || undefined,
                    stage: inviteForm.stage || undefined,
                    performance_fee: Number(inviteForm.performance_fee) || 0,
                    message: inviteForm.message || undefined,
                  });
                }}
              >
                <Award className="h-4 w-4 mr-2" />
                Send invitation{selectedBand ? ` to ${selectedBand.name}` : ""}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sent invitations</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Show</TableHead>
                    <TableHead>Band</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Slot</TableHead>
                    <TableHead>Fee</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invites.map((invite) => (
                    <TableRow key={invite.id}>
                      <TableCell>{shows.find((show: any) => show.id === invite.award_show_id)?.show_name || "—"}</TableCell>
                      <TableCell>{invite.bands?.name || "—"}</TableCell>
                      <TableCell className="capitalize">{invite.invite_type}</TableCell>
                      <TableCell>{[invite.slot_label, invite.stage].filter(Boolean).join(" · ") || "—"}</TableCell>
                      <TableCell>${Number(invite.performance_fee || 0).toLocaleString()}</TableCell>
                      <TableCell><Badge variant="secondary">{invite.response_status}</Badge></TableCell>
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
