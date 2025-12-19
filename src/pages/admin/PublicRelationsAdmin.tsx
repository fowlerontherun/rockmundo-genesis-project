import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { TrendingUp, Plus, Tv, Radio, Mic2, Newspaper, Film, Youtube } from "lucide-react";
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

  const { data: tvNetworks = [] } = useQuery({
    queryKey: ["admin-tv-networks"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("tv_networks")
        .select("*")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: tvShows = [] } = useQuery({
    queryKey: ["admin-tv-shows"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("tv_shows")
        .select("*, tv_networks(name)")
        .order("show_name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: newspapers = [] } = useQuery({
    queryKey: ["admin-newspapers"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("newspapers")
        .select("*")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: magazines = [] } = useQuery({
    queryKey: ["admin-magazines"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("magazines")
        .select("*")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: youtubeChannels = [] } = useQuery({
    queryKey: ["admin-youtube-channels"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("youtube_channels")
        .select("*")
        .order("channel_name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: podcasts = [] } = useQuery({
    queryKey: ["admin-podcasts"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("podcasts")
        .select("*")
        .order("podcast_name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: filmProductions = [] } = useQuery({
    queryKey: ["admin-film-productions"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("film_productions")
        .select("*, film_studios(name)")
        .order("title");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: prOffers = [] } = useQuery({
    queryKey: ["admin-pr-media-offers"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pr_media_offers")
        .select("*, bands(name)")
        .order("created_at", { ascending: false })
        .limit(50);
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
          <p className="text-muted-foreground">Manage media outlets, offers, and campaigns</p>
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
                    <SelectItem value="newspaper">Newspaper</SelectItem>
                    <SelectItem value="magazine">Magazine</SelectItem>
                    <SelectItem value="youtube">YouTube</SelectItem>
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

      <Tabs defaultValue="offers">
        <TabsList className="grid grid-cols-4 lg:grid-cols-8 w-full">
          <TabsTrigger value="offers">Offers</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="tv">
            <Tv className="h-4 w-4 mr-1" />
            TV
          </TabsTrigger>
          <TabsTrigger value="print">
            <Newspaper className="h-4 w-4 mr-1" />
            Print
          </TabsTrigger>
          <TabsTrigger value="podcasts">
            <Mic2 className="h-4 w-4 mr-1" />
            Podcasts
          </TabsTrigger>
          <TabsTrigger value="youtube">
            <Youtube className="h-4 w-4 mr-1" />
            YouTube
          </TabsTrigger>
          <TabsTrigger value="films">
            <Film className="h-4 w-4 mr-1" />
            Films
          </TabsTrigger>
          <TabsTrigger value="pr-offers">PR Offers</TabsTrigger>
        </TabsList>

        <TabsContent value="offers">
          <Card>
            <CardHeader>
              <CardTitle>Media Offers (Legacy)</CardTitle>
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
                      <TableCell>{offer.proposed_date ? format(new Date(offer.proposed_date), "PPP") : "-"}</TableCell>
                      <TableCell>${offer.compensation?.toLocaleString()}</TableCell>
                      <TableCell><Badge>{offer.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

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

        <TabsContent value="tv">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>TV Networks ({tvNetworks.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Country</TableHead>
                      <TableHead>Viewers</TableHead>
                      <TableHead>Min Fame</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tvNetworks.map((network: any) => (
                      <TableRow key={network.id}>
                        <TableCell className="font-medium">{network.name}</TableCell>
                        <TableCell><Badge variant="outline">{network.network_type}</Badge></TableCell>
                        <TableCell>{network.country}</TableCell>
                        <TableCell>{network.viewer_base?.toLocaleString()}</TableCell>
                        <TableCell>{network.min_fame_required?.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={network.is_active ? "default" : "secondary"}>
                            {network.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>TV Shows ({tvShows.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Show</TableHead>
                      <TableHead>Network</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Host</TableHead>
                      <TableHead>Viewer Reach</TableHead>
                      <TableHead>Slots/Day</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tvShows.map((show: any) => (
                      <TableRow key={show.id}>
                        <TableCell className="font-medium">{show.show_name}</TableCell>
                        <TableCell>{show.tv_networks?.name}</TableCell>
                        <TableCell><Badge variant="outline">{show.show_type}</Badge></TableCell>
                        <TableCell>{show.host_name || "-"}</TableCell>
                        <TableCell>{show.viewer_reach?.toLocaleString()}</TableCell>
                        <TableCell>{show.slots_per_day}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="print">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Newspapers ({newspapers.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Country</TableHead>
                      <TableHead>Circulation</TableHead>
                      <TableHead>Min Fame</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {newspapers.map((paper: any) => (
                      <TableRow key={paper.id}>
                        <TableCell className="font-medium">{paper.name}</TableCell>
                        <TableCell><Badge variant="outline">{paper.publication_type}</Badge></TableCell>
                        <TableCell>{paper.country}</TableCell>
                        <TableCell>{paper.circulation?.toLocaleString()}</TableCell>
                        <TableCell>{paper.min_fame_required?.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Magazines ({magazines.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Country</TableHead>
                      <TableHead>Readership</TableHead>
                      <TableHead>Min Fame</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {magazines.map((mag: any) => (
                      <TableRow key={mag.id}>
                        <TableCell className="font-medium">{mag.name}</TableCell>
                        <TableCell><Badge variant="outline">{mag.magazine_type}</Badge></TableCell>
                        <TableCell>{mag.country}</TableCell>
                        <TableCell>{mag.readership?.toLocaleString()}</TableCell>
                        <TableCell>{mag.min_fame_required?.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="podcasts">
          <Card>
            <CardHeader>
              <CardTitle>Podcasts ({podcasts.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Host</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Listeners</TableHead>
                    <TableHead>Min Fame</TableHead>
                    <TableHead>Slots/Week</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {podcasts.map((podcast: any) => (
                    <TableRow key={podcast.id}>
                      <TableCell className="font-medium">{podcast.podcast_name}</TableCell>
                      <TableCell>{podcast.host_name || "-"}</TableCell>
                      <TableCell><Badge variant="outline">{podcast.podcast_type}</Badge></TableCell>
                      <TableCell>{podcast.listener_base?.toLocaleString()}</TableCell>
                      <TableCell>{podcast.min_fame_required?.toLocaleString()}</TableCell>
                      <TableCell>{podcast.slots_per_week}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="youtube">
          <Card>
            <CardHeader>
              <CardTitle>YouTube Channels ({youtubeChannels.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Channel</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Subscribers</TableHead>
                    <TableHead>Avg Views</TableHead>
                    <TableHead>Min Fame</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {youtubeChannels.map((channel: any) => (
                    <TableRow key={channel.id}>
                      <TableCell className="font-medium">{channel.channel_name}</TableCell>
                      <TableCell><Badge variant="outline">{channel.channel_type}</Badge></TableCell>
                      <TableCell>{channel.subscriber_count?.toLocaleString()}</TableCell>
                      <TableCell>{channel.avg_views?.toLocaleString()}</TableCell>
                      <TableCell>{channel.min_fame_required?.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={channel.is_active ? "default" : "secondary"}>
                          {channel.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="films">
          <Card>
            <CardHeader>
              <CardTitle>Film Productions ({filmProductions.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Studio</TableHead>
                    <TableHead>Role Type</TableHead>
                    <TableHead>Min Fame</TableHead>
                    <TableHead>Compensation</TableHead>
                    <TableHead>Fame Boost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filmProductions.map((film: any) => (
                    <TableRow key={film.id}>
                      <TableCell className="font-medium">{film.title}</TableCell>
                      <TableCell>{film.film_studios?.name || film.studio}</TableCell>
                      <TableCell>
                        <Badge variant={film.film_type === 'lead' ? 'default' : 'outline'}>
                          {film.film_type}
                        </Badge>
                      </TableCell>
                      <TableCell>{film.min_fame_required?.toLocaleString()}</TableCell>
                      <TableCell>${film.compensation?.toLocaleString()}</TableCell>
                      <TableCell>+{film.fame_boost?.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pr-offers">
          <Card>
            <CardHeader>
              <CardTitle>PR Media Offers (New System)</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Band</TableHead>
                    <TableHead>Media Type</TableHead>
                    <TableHead>Offer Type</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Compensation</TableHead>
                    <TableHead>Fame Boost</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prOffers.map((offer: any) => (
                    <TableRow key={offer.id}>
                      <TableCell>{offer.bands?.name || "-"}</TableCell>
                      <TableCell><Badge variant="outline">{offer.media_type}</Badge></TableCell>
                      <TableCell>{offer.offer_type}</TableCell>
                      <TableCell>{offer.proposed_date ? format(new Date(offer.proposed_date), "PPP") : "-"}</TableCell>
                      <TableCell>${offer.compensation?.toLocaleString() || 0}</TableCell>
                      <TableCell>+{offer.fame_boost?.toLocaleString() || 0}</TableCell>
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
