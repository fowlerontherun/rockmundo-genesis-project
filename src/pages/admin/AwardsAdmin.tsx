import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Trophy, Plus, Calendar, Users, Award, ShieldCheck } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useAwardShowInvites, useInviteBandToPerform, useNominatableBands } from "@/hooks/useAwardInvites";


interface AwardSettlementPreview {
  show_id: string;
  show_name: string;
  status: string;
  ready: boolean;
  winner_fame_boost: number;
  winner_prize_money: number;
  pending_nominations: number;
  ballots_on_nonfinalists: number;
  invalid_shortlisted_nominations: number;
  existing_wins: number;
  awards_to_issue: number;
  unawarded_categories: string[];
  results: {
    category: string;
    nominee: string;
    nomination_id?: string;
    weighted_votes: number | null;
    ballots: number | null;
    tied_on_votes?: boolean;
    will_award: boolean;
    published?: boolean;
  }[];
}

const AwardsAdmin = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewShowId, setPreviewShowId] = useState<string | null>(null);
  const [confirmPayouts, setConfirmPayouts] = useState(false);
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
        .order("ceremony_date", { ascending: false });
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
      const names = [...new Set(showData.categories.split(",").map((category) => category.trim()).filter(Boolean))];
      if (!showData.show_name.trim() || !showData.venue_name.trim() || !showData.show_date || !names.length) {
        throw new Error("Provide a name, venue, ceremony date and at least one award category.");
      }
      const ceremonyDate = new Date(`${showData.show_date}T20:00:00Z`);
      if (Number.isNaN(ceremonyDate.getTime())) {
        throw new Error("Choose a valid ceremony date.");
      }
      const { data, error } = await (supabase as any)
        .from("award_shows")
        .insert([{
          show_name: showData.show_name.trim(),
          ceremony_date: ceremonyDate.toISOString(),
          venue: showData.venue_name.trim(),
          year: ceremonyDate.getUTCFullYear(),
          categories: names.map((name) => ({ name })),
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
    onError: (error: Error) => {
      toast({ title: "Failed to create award show", description: error.message, variant: "destructive" });
    },
  });

  const reviewNomination = useMutation({
    mutationFn: async ({ nominationId, decision }: { nominationId: string; decision: "shortlisted" | "rejected" }) => {
      const { data, error } = await (supabase as any).rpc("award_admin_review_nomination", {
        p_nomination_id: nominationId,
        p_decision: decision,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-nominations"] });
      queryClient.invalidateQueries({ queryKey: ["award-show-nominations"] });
      toast({ title: "Nomination decision recorded" });
    },
    onError: (error: Error) => {
      toast({ title: "Nomination review failed", description: error.message, variant: "destructive" });
    },
  });

  const advanceShow = useMutation({
    mutationFn: async ({ showId, nextStatus }: { showId: string; nextStatus: string }) => {
      const { data, error } = await (supabase as any).rpc("award_admin_advance_show", {
        p_show_id: showId,
        p_next_status: nextStatus,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-award-shows"] });
      queryClient.invalidateQueries({ queryKey: ["award-shows"] });
      toast({ title: "Award show advanced" });
    },
    onError: (error: Error) => {
      toast({ title: "Cannot advance award show", description: error.message, variant: "destructive" });
    },
  });

  const { data: resultPreview, isLoading: previewLoading, error: previewError } = useQuery({
    queryKey: ["admin-awards-results-preview", previewShowId],
    enabled: Boolean(previewShowId),
    queryFn: async (): Promise<AwardSettlementPreview> => {
      const { data, error } = await (supabase as any).rpc("award_admin_preview_results", {
        p_show_id: previewShowId,
      });
      if (error) throw error;
      return data as AwardSettlementPreview;
    },
    refetchOnWindowFocus: true,
  });

  const settleShow = useMutation({
    mutationFn: async (showId: string) => {
      const { data, error } = await (supabase as any).rpc("award_admin_finalize_show", {
        p_show_id: showId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: { awards_issued?: number; already_completed?: boolean }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-awards-results-preview"] });
      queryClient.invalidateQueries({ queryKey: ["admin-award-shows"] });
      queryClient.invalidateQueries({ queryKey: ["admin-nominations"] });
      queryClient.invalidateQueries({ queryKey: ["award-shows"] });
      queryClient.invalidateQueries({ queryKey: ["award-wins"] });
      queryClient.invalidateQueries({ queryKey: ["award-show-nominations"] });
      setConfirmPayouts(false);
      toast({ title: data.already_completed
        ? "Awards already settled"
        : `Results published for ${data.awards_issued ?? 0} categories` });
    },
    onError: (error: Error) => {
      toast({ title: "Awards settlement failed", description: error.message, variant: "destructive" });
    },
  });

  const nextStatusFor = (status: string): string | null => {
    if (status === "upcoming") return "nominations_open";
    if (status === "nominations_open") return "voting_open";
    if (status === "voting_open") return "live";
    return null; // No completion until genuine winner settlement exists.
  };

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
                <Label>Ceremony Date (20:00 UTC)</Label>
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
              <Button
                onClick={() => createShow.mutate(newShow)}
                className="w-full"
                disabled={createShow.isPending || !newShow.show_name.trim() || !newShow.show_date || !newShow.venue_name.trim() || !newShow.categories.trim()}
              >
                Create Show
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={Boolean(previewShowId)} onOpenChange={(open) => {
        if (!open) { setPreviewShowId(null); setConfirmPayouts(false); }
      }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Authoritative awards result preview</DialogTitle>
            <DialogDescription>
              Results use saved ballots. Winners and payouts are created only
              when an administrator explicitly finalises a live show.
            </DialogDescription>
          </DialogHeader>
          {previewLoading && <p className="text-sm text-muted-foreground">Checking ballots…</p>}
          {previewError && <p role="alert" className="text-sm text-destructive">
            Could not verify results: {(previewError as Error).message}
          </p>}
          {resultPreview && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{resultPreview.status.replaceAll("_", " ")}</Badge>
                <Badge variant={resultPreview.ready ? "default" : "secondary"}>
                  {resultPreview.ready ? "Ready to finalise" : "Not ready to finalise"}
                </Badge>
              </div>
              <p className="text-sm font-medium">{resultPreview.show_name}</p>
              <p className="text-sm text-muted-foreground">
                {resultPreview.awards_to_issue} prizes to publish ·
                ${Number(resultPreview.winner_prize_money).toLocaleString()} and
                {Number(resultPreview.winner_fame_boost).toLocaleString()} fame per winning band
              </p>
              <div className="space-y-2">
                {resultPreview.results.map((result) => (
                  <div key={result.category} className="rounded-md border p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{result.category}</span>
                      <Badge variant={result.will_award ? "default" : "outline"}>
                        {result.published ? "Published" : result.will_award ? "Predicted winner" : "No ballots"}
                      </Badge>
                    </div>
                    <div>{result.nominee}</div>
                    {result.ballots !== null && (
                      <div className="text-xs text-muted-foreground">
                        {result.ballots} ballots · {result.weighted_votes} weighted votes
                        {result.tied_on_votes ? " · Tie resolved by oldest nomination" : ""}
                      </div>
                    )}
                  </div>
                ))}
                {resultPreview.results.length === 0 && (
                  <p className="text-sm text-muted-foreground">No shortlisted nominees or published winners.</p>
                )}
              </div>
              {resultPreview.unawarded_categories.length > 0 && (
                <p className="text-sm text-amber-600">
                  No prize will be issued for: {resultPreview.unawarded_categories.join(", ")}.
                </p>
              )}
              {(resultPreview.pending_nominations > 0
                || resultPreview.ballots_on_nonfinalists > 0
                || resultPreview.invalid_shortlisted_nominations > 0) && (
                <div role="alert" className="text-sm text-destructive">
                  Resolve {resultPreview.pending_nominations} pending nominations,
                  {resultPreview.ballots_on_nonfinalists} ballots on non-finalists and
                  {resultPreview.invalid_shortlisted_nominations} invalid finalists before settling.
                </div>
              )}
              {resultPreview.status === "live" && (
                <div className="space-y-3 border-t pt-4">
                  <div className="flex items-start gap-2">
                    <Checkbox id="award-confirm-payouts"
                      checked={confirmPayouts}
                      onCheckedChange={(checked) => setConfirmPayouts(checked === true)}
                      disabled={!resultPreview.ready || settleShow.isPending} />
                    <Label htmlFor="award-confirm-payouts" className="leading-snug">
                      I have reviewed the winners and unawarded categories.
                      Finalising publishes results and pays the configured prizes once.
                    </Label>
                  </div>
                  <Button
                    disabled={!resultPreview.ready || !confirmPayouts || settleShow.isPending || !previewShowId}
                    onClick={() => { if (previewShowId) settleShow.mutate(previewShowId); }}
                  >
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    {settleShow.isPending ? "Finalising…" : "Finalise awards and pay winners"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

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
                    {show.ceremony_date ? format(new Date(show.ceremony_date), "PPP") : "Date to be announced"} • {show.venue || "Venue to be announced"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {(show.categories || []).map((cat: string | { name?: string }, index: number) => {
                      const name = typeof cat === "string" ? cat : (cat.name || `Category ${index + 1}`);
                      return <Badge key={`${index}-${name}`} variant="outline">{name}</Badge>;
                    })}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {(show.status === "voting_open" || show.status === "live" || show.status === "completed") && (
                      <Button size="sm" variant="secondary" onClick={() => {
                        setConfirmPayouts(false);
                        setPreviewShowId(show.id);
                      }}>
                        <Award className="mr-2 h-4 w-4" /> Results & settlement
                      </Button>
                    )}
                    {nextStatusFor(show.status) ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={advanceShow.isPending}
                        onClick={() => advanceShow.mutate({
                          showId: show.id,
                          nextStatus: nextStatusFor(show.status)!,
                        })}
                      >
                        Advance to {nextStatusFor(show.status)?.replace("_", " ")}
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {show.status === "live"
                          ? "Use Results & settlement to verify ballots and publish payouts."
                          : "No further admin phase change available."}
                      </span>
                    )}
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
                      <TableCell>{nom.category_name}</TableCell>
                      <TableCell>{nom.bands?.name}</TableCell>
                      <TableCell>{nom.nominee_type}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge>{nom.status}</Badge>
                          {Number(nom.vote_count || 0) > 0 && nom.status === "pending" && (
                            <span className="text-xs text-amber-600">Legacy votes: shortlist to preserve ballots</span>
                          )}
                          {nom.status !== "winner" && nom.status !== "runner_up"
                            && shows.some((show: any) => show.id === nom.award_show_id && show.status === "nominations_open")
                            && (
                              <>
                                {nom.status !== "shortlisted" && (
                                  <Button size="sm" disabled={reviewNomination.isPending}
                                    onClick={() => reviewNomination.mutate({ nominationId: nom.id, decision: "shortlisted" })}>
                                    Shortlist
                                  </Button>
                                )}
                                {nom.status !== "rejected" && Number(nom.vote_count || 0) === 0 && (
                                  <Button size="sm" variant="outline" disabled={reviewNomination.isPending}
                                    onClick={() => reviewNomination.mutate({ nominationId: nom.id, decision: "rejected" })}>
                                    Reject
                                  </Button>
                                )}
                              </>
                            )}
                        </div>
                      </TableCell>
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
