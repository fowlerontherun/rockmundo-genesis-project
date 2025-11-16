import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { TrendingUp, Plus, Tv, Radio, Mic2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

const PublicRelationsAdmin = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newOffer, setNewOffer] = useState({
    band_id: "",
    media_type: "tv",
    program_name: "",
    network: "",
    proposed_date: "",
    compensation: 5000,
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ["admin-pr-campaigns"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pr_campaigns")
        .select("*, bands(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: offers = [] } = useQuery({
    queryKey: ["admin-media-offers"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("media_offers")
        .select("*, bands(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: bands = [] } = useQuery({
    queryKey: ["admin-bands-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bands")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const createOffer = useMutation({
    mutationFn: async (offerData: typeof newOffer) => {
      const { data, error } = await (supabase as any)
        .from("media_offers")
        .insert([{
          ...offerData,
          status: "pending",
        }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-media-offers"] });
      toast({ title: "Media Offer Created" });
      setDialogOpen(false);
      setNewOffer({
        band_id: "",
        media_type: "tv",
        program_name: "",
        network: "",
        proposed_date: "",
        compensation: 5000,
      });
    },
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <TrendingUp className="h-8 w-8" />
            PR Administration
          </h1>
          <p className="text-muted-foreground">Manage media campaigns and offers</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Media Offer
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Media Offer</DialogTitle>
              <DialogDescription>Send a media appearance offer to a band</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Band</Label>
                <Select value={newOffer.band_id} onValueChange={(v) => setNewOffer({ ...newOffer, band_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select band" />
                  </SelectTrigger>
                  <SelectContent>
                    {bands.map((band: any) => (
                      <SelectItem key={band.id} value={band.id}>{band.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Media Type</Label>
                <Select value={newOffer.media_type} onValueChange={(v) => setNewOffer({ ...newOffer, media_type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tv">TV</SelectItem>
                    <SelectItem value="radio">Radio</SelectItem>
                    <SelectItem value="podcast">Podcast</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Program Name</Label>
                <Input
                  value={newOffer.program_name}
                  onChange={(e) => setNewOffer({ ...newOffer, program_name: e.target.value })}
                  placeholder="e.g., The Tonight Show"
                />
              </div>
              <div>
                <Label>Network</Label>
                <Input
                  value={newOffer.network}
                  onChange={(e) => setNewOffer({ ...newOffer, network: e.target.value })}
                  placeholder="e.g., NBC"
                />
              </div>
              <div>
                <Label>Proposed Date</Label>
                <Input
                  type="date"
                  value={newOffer.proposed_date}
                  onChange={(e) => setNewOffer({ ...newOffer, proposed_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Compensation ($)</Label>
                <Input
                  type="number"
                  value={newOffer.compensation}
                  onChange={(e) => setNewOffer({ ...newOffer, compensation: parseInt(e.target.value) })}
                />
              </div>
              <Button onClick={() => createOffer.mutate(newOffer)} className="w-full">
                Send Offer
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="campaigns">
        <TabsList>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="offers">Media Offers</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns">
          <Card>
            <CardHeader>
              <CardTitle>PR Campaigns</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Band</TableHead>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Budget</TableHead>
                    <TableHead>Reach</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((campaign: any) => (
                    <TableRow key={campaign.id}>
                      <TableCell>{campaign.bands?.name}</TableCell>
                      <TableCell>{campaign.campaign_name}</TableCell>
                      <TableCell>{campaign.campaign_type}</TableCell>
                      <TableCell>${campaign.budget?.toLocaleString()}</TableCell>
                      <TableCell>{campaign.reach?.toLocaleString()}</TableCell>
                      <TableCell><Badge>{campaign.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="offers">
          <Card>
            <CardHeader>
              <CardTitle>Media Offers</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Band</TableHead>
                    <TableHead>Program</TableHead>
                    <TableHead>Network</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Compensation</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {offers.map((offer: any) => (
                    <TableRow key={offer.id}>
                      <TableCell>{offer.bands?.name}</TableCell>
                      <TableCell>{offer.program_name}</TableCell>
                      <TableCell>{offer.network}</TableCell>
                      <TableCell>{format(new Date(offer.proposed_date), "PPP")}</TableCell>
                      <TableCell>${offer.compensation?.toLocaleString()}</TableCell>
                      <TableCell><Badge>{offer.status}</Badge></TableCell>
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

export default PublicRelationsAdmin;
