import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tv, Radio, Mic2, TrendingUp, Calendar, DollarSign, Eye, ThumbsUp, Plus } from "lucide-react";
import { usePrimaryBand } from "@/hooks/usePrimaryBand";
import { usePublicRelations } from "@/hooks/usePublicRelations";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const PublicRelations = () => {
  const { data: bandData } = usePrimaryBand();
  const band = bandData?.bands;
  const { toast } = useToast();
  
  const {
    campaigns,
    campaignsLoading,
    appearances,
    appearancesLoading,
    offers,
    offersLoading,
    createCampaign,
    respondToOffer,
  } = usePublicRelations(band?.id);

  const [newCampaign, setNewCampaign] = useState({
    campaign_type: "tv",
    campaign_name: "",
    budget: 5000,
    start_date: "",
    end_date: "",
  });

  const handleCreateCampaign = () => {
    if (!newCampaign.campaign_name || !newCampaign.start_date || !newCampaign.end_date) {
      toast({
        title: "Missing Information",
        description: "Please fill in all campaign details",
        variant: "destructive",
      });
      return;
    }

    createCampaign(newCampaign);
    setNewCampaign({
      campaign_type: "tv",
      campaign_name: "",
      budget: 5000,
      start_date: "",
      end_date: "",
    });
  };

  const getMediaIcon = (type: string) => {
    switch (type) {
      case "tv": return <Tv className="h-4 w-4" />;
      case "radio": return <Radio className="h-4 w-4" />;
      case "podcast": return <Mic2 className="h-4 w-4" />;
      default: return <Eye className="h-4 w-4" />;
    }
  };

  const getSentimentBadge = (sentiment: string) => {
    if (sentiment === "positive") return <Badge className="bg-success">Positive</Badge>;
    if (sentiment === "negative") return <Badge variant="destructive">Negative</Badge>;
    return <Badge variant="secondary">Neutral</Badge>;
  };

  const getStatusBadge = (status: string) => {
    if (status === "active") return <Badge className="bg-success">Active</Badge>;
    if (status === "completed") return <Badge variant="secondary">Completed</Badge>;
    if (status === "pending") return <Badge variant="outline">Pending</Badge>;
    if (status === "accepted") return <Badge className="bg-success">Accepted</Badge>;
    if (status === "declined" || status === "cancelled") return <Badge variant="destructive">{status}</Badge>;
    return <Badge>{status}</Badge>;
  };

  if (!band) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>No Band Found</CardTitle>
            <CardDescription>Create or join a band to access PR features</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <TrendingUp className="h-8 w-8" />
            Public Relations
          </h1>
          <p className="text-muted-foreground">Manage media campaigns and appearances for {band.name}</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />New Campaign</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create PR Campaign</DialogTitle>
              <DialogDescription>Launch a new media campaign</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Campaign Name</Label>
                <Input value={newCampaign.campaign_name} onChange={(e) => setNewCampaign({ ...newCampaign, campaign_name: e.target.value })} placeholder="Summer Media Blitz" />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={newCampaign.campaign_type} onValueChange={(value) => setNewCampaign({ ...newCampaign, campaign_type: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tv">TV</SelectItem>
                    <SelectItem value="radio">Radio</SelectItem>
                    <SelectItem value="podcast">Podcast</SelectItem>
                    <SelectItem value="press">Press</SelectItem>
                    <SelectItem value="social">Social Media</SelectItem>
                    <SelectItem value="influencer">Influencer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Budget</Label>
                <Input type="number" value={newCampaign.budget} onChange={(e) => setNewCampaign({ ...newCampaign, budget: Number(e.target.value) })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Start Date</Label>
                  <Input type="date" value={newCampaign.start_date} onChange={(e) => setNewCampaign({ ...newCampaign, start_date: e.target.value })} />
                </div>
                <div>
                  <Label>End Date</Label>
                  <Input type="date" value={newCampaign.end_date} onChange={(e) => setNewCampaign({ ...newCampaign, end_date: e.target.value })} />
                </div>
              </div>
              <Button onClick={handleCreateCampaign} className="w-full">Create Campaign</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="campaigns">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="appearances">Appearances</TabsTrigger>
          <TabsTrigger value="offers">Offers</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns">
          {campaignsLoading ? <Card><CardContent className="p-6">Loading...</CardContent></Card> : 
           campaigns.length === 0 ? <Card><CardContent className="p-6 text-center text-muted-foreground">No campaigns yet</CardContent></Card> :
           <div className="grid gap-4">{campaigns.map((c: any) => (
            <Card key={c.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">{getMediaIcon(c.campaign_type)}<CardTitle className="text-lg">{c.campaign_name}</CardTitle></div>
                  {getStatusBadge(c.status)}
                </div>
                <CardDescription className="capitalize">{c.campaign_type} Campaign</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div><div className="flex items-center gap-2 text-sm text-muted-foreground"><DollarSign className="h-4 w-4" />Budget</div><div className="text-xl font-bold">${c.budget.toLocaleString()}</div></div>
                  <div><div className="flex items-center gap-2 text-sm text-muted-foreground"><Eye className="h-4 w-4" />Reach</div><div className="text-xl font-bold">{c.reach.toLocaleString()}</div></div>
                  <div><div className="flex items-center gap-2 text-sm text-muted-foreground"><ThumbsUp className="h-4 w-4" />Engagement</div><div className="text-xl font-bold">{c.engagement_rate}%</div></div>
                  <div><div className="flex items-center gap-2 text-sm text-muted-foreground"><Calendar className="h-4 w-4" />Duration</div><div className="text-sm">{format(new Date(c.start_date), "MMM d")} - {format(new Date(c.end_date), "MMM d")}</div></div>
                </div>
              </CardContent>
            </Card>
          ))}</div>}
        </TabsContent>

        <TabsContent value="appearances">
          {appearancesLoading ? <Card><CardContent className="p-6">Loading...</CardContent></Card> :
           appearances.length === 0 ? <Card><CardContent className="p-6 text-center text-muted-foreground">No appearances yet</CardContent></Card> :
           <Card><Table><TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Program</TableHead><TableHead>Network</TableHead><TableHead>Air Date</TableHead><TableHead>Reach</TableHead><TableHead>Sentiment</TableHead><TableHead>Highlight</TableHead></TableRow></TableHeader>
           <TableBody>{appearances.map((a: any) => (
            <TableRow key={a.id}>
              <TableCell><div className="flex items-center gap-2">{getMediaIcon(a.media_type)}<span className="capitalize">{a.media_type}</span></div></TableCell>
              <TableCell className="font-medium">{a.program_name}</TableCell>
              <TableCell>{a.network}</TableCell>
              <TableCell>{format(new Date(a.air_date), "MMM d, yyyy")}</TableCell>
              <TableCell>{a.audience_reach.toLocaleString()}</TableCell>
              <TableCell>{getSentimentBadge(a.sentiment)}</TableCell>
              <TableCell className="max-w-xs truncate">{a.highlight}</TableCell>
            </TableRow>
          ))}</TableBody></Table></Card>}
        </TabsContent>

        <TabsContent value="offers">
          {offersLoading ? <Card><CardContent className="p-6">Loading...</CardContent></Card> :
           offers.length === 0 ? <Card><CardContent className="p-6 text-center text-muted-foreground">No offers</CardContent></Card> :
           <div className="grid gap-4">{offers.map((o: any) => (
            <Card key={o.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">{getMediaIcon(o.media_type)}<CardTitle className="text-lg">{o.program_name}</CardTitle></div>
                  {getStatusBadge(o.status)}
                </div>
                <CardDescription>{o.network} • {format(new Date(o.proposed_date), "MMMM d, yyyy")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div><div className="text-sm text-muted-foreground">Compensation</div><div className="text-2xl font-bold">${o.compensation.toLocaleString()}</div></div>
                  {o.status === "pending" && <div className="flex gap-2">
                    <Button onClick={() => respondToOffer({ offerId: o.id, accept: true })} size="sm" className="bg-success">Accept</Button>
                    <Button onClick={() => respondToOffer({ offerId: o.id, accept: false })} size="sm" variant="destructive">Decline</Button>
                  </div>}
                </div>
              </CardContent>
            </Card>
          ))}</div>}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PublicRelations;
