import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tv, Radio, Mic2, TrendingUp, Calendar, DollarSign, Eye, ThumbsUp, Plus, Search, Loader2, Send, DownloadCloud, FileCheck, FileX, Filter } from "lucide-react";
import { usePrimaryBand } from "@/hooks/usePrimaryBand";
import { usePublicRelations } from "@/hooks/usePublicRelations";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Textarea } from "@/components/ui/textarea";

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

  const pressReleaseSchema = z.object({
    title: z.string().min(3, "Add a clear press release headline"),
    summary: z.string().min(20, "Share at least 20 characters"),
    releaseDate: z.string().min(1, "Release date is required"),
    status: z.enum(["draft", "scheduled", "published"]),
    distributionChannel: z.string().min(3, "Choose a channel"),
    contact: z.string().min(3, "Assign an owner"),
  });

  const contactSchema = z.object({
    name: z.string().min(2, "Name is required"),
    outlet: z.string().min(2, "Outlet is required"),
    region: z.string().min(2, "Region is required"),
    priority: z.enum(["primary", "secondary", "watch"]),
    notes: z.string().min(5, "Add at least one talking point"),
    email: z.string().email("Enter a valid email"),
  });

  type PressReleaseFormValues = z.infer<typeof pressReleaseSchema>;
  type ContactFormValues = z.infer<typeof contactSchema>;

  const [pressReleases, setPressReleases] = useState<PressReleaseFormValues[]>([
    {
      title: "Announcing the Neon Skyline Tour",
      summary: "Band launches 18-city run with immersive visuals and sponsor showcases.",
      releaseDate: new Date().toISOString().slice(0, 10),
      status: "draft",
      distributionChannel: "Newswire + direct list",
      contact: "Ava (PR Lead)",
    },
    {
      title: "Limited Vinyl Pre-Orders Open",
      summary: "Hand-numbered color variants with signed lyric sheets and backstage polaroids.",
      releaseDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10).toISOString().slice(0, 10),
      status: "scheduled",
      distributionChannel: "Indie blogs + Discord",
      contact: "Media Desk",
    },
  ]);

  const [contacts, setContacts] = useState<ContactFormValues[]>([
    {
      name: "Jamie Soto",
      outlet: "Pulse FM",
      region: "Pacific Northwest",
      priority: "primary",
      notes: "Loves exclusives with stripped performances and early spins",
      email: "jamie@pulse.fm",
    },
    {
      name: "Priya Kaur",
      outlet: "Indie Beacon",
      region: "Remote",
      priority: "secondary",
      notes: "Prefers concise news hooks and visuals for web feature placement",
      email: "priya@indiebeacon.com",
    },
  ]);

  const [editingReleaseIndex, setEditingReleaseIndex] = useState<number | null>(null);
  const [editingContactIndex, setEditingContactIndex] = useState<number | null>(null);
  const [releaseSearch, setReleaseSearch] = useState("");
  const [releaseStatusFilter, setReleaseStatusFilter] = useState<string>("all");
  const [releaseSort, setReleaseSort] = useState<{ key: "releaseDate" | "status"; direction: "asc" | "desc" }>({
    key: "releaseDate",
    direction: "asc",
  });
  const [contactSearch, setContactSearch] = useState("");
  const [contactPriorityFilter, setContactPriorityFilter] = useState<string>("all");
  const [contactSort, setContactSort] = useState<{ key: "region" | "priority"; direction: "asc" | "desc" }>({
    key: "priority",
    direction: "asc",
  });
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [downloadId, setDownloadId] = useState<string | null>(null);
  const [pitchingId, setPitchingId] = useState<string | null>(null);

  const releaseForm = useForm<PressReleaseFormValues>({
    resolver: zodResolver(pressReleaseSchema),
    defaultValues: {
      title: "",
      summary: "",
      releaseDate: "",
      status: "draft",
      distributionChannel: "",
      contact: "",
    },
  });

  const contactForm = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: "",
      outlet: "",
      region: "",
      priority: "primary",
      notes: "",
      email: "",
    },
  });

  useEffect(() => {
    if (editingReleaseIndex !== null) {
      releaseForm.reset(pressReleases[editingReleaseIndex]);
    } else {
      releaseForm.reset({
        title: "",
        summary: "",
        releaseDate: "",
        status: "draft",
        distributionChannel: "",
        contact: "",
      });
    }
  }, [editingReleaseIndex, pressReleases, releaseForm]);

  useEffect(() => {
    if (editingContactIndex !== null) {
      contactForm.reset(contacts[editingContactIndex]);
    } else {
      contactForm.reset({
        name: "",
        outlet: "",
        region: "",
        priority: "primary",
        notes: "",
        email: "",
      });
    }
  }, [editingContactIndex, contacts, contactForm]);

  const filteredReleases = useMemo(() => {
    let list = [...pressReleases];

    if (releaseStatusFilter !== "all") {
      list = list.filter((release) => release.status === releaseStatusFilter);
    }

    if (releaseSearch.trim()) {
      const query = releaseSearch.toLowerCase();
      list = list.filter(
        (release) =>
          release.title.toLowerCase().includes(query) ||
          release.summary.toLowerCase().includes(query) ||
          release.contact.toLowerCase().includes(query)
      );
    }

    return list.sort((a, b) => {
      if (releaseSort.key === "releaseDate") {
        const diff = a.releaseDate.localeCompare(b.releaseDate);
        return releaseSort.direction === "asc" ? diff : -diff;
      }

      const diff = a.status.localeCompare(b.status);
      return releaseSort.direction === "asc" ? diff : -diff;
    });
  }, [pressReleases, releaseSearch, releaseStatusFilter, releaseSort]);

  const filteredContacts = useMemo(() => {
    let list = [...contacts];

    if (contactPriorityFilter !== "all") {
      list = list.filter((contact) => contact.priority === contactPriorityFilter);
    }

    if (contactSearch.trim()) {
      const query = contactSearch.toLowerCase();
      list = list.filter(
        (contact) =>
          contact.name.toLowerCase().includes(query) ||
          contact.outlet.toLowerCase().includes(query) ||
          contact.region.toLowerCase().includes(query)
      );
    }

    return list.sort((a, b) => {
      if (contactSort.key === "priority") {
        const order = { primary: 0, secondary: 1, watch: 2 } as const;
        const diff = order[a.priority] - order[b.priority];
        return contactSort.direction === "asc" ? diff : -diff;
      }

      const diff = a.region.localeCompare(b.region);
      return contactSort.direction === "asc" ? diff : -diff;
    });
  }, [contacts, contactPriorityFilter, contactSearch, contactSort]);

  const handleSubmitRelease = (values: PressReleaseFormValues) => {
    if (editingReleaseIndex !== null) {
      setPressReleases((prev) => prev.map((item, idx) => (idx === editingReleaseIndex ? values : item)));
      toast({
        title: "Press release updated",
        description: "Edits saved with validation.",
      });
    } else {
      setPressReleases((prev) => [...prev, values]);
      toast({
        title: "Press release created",
        description: "Your announcement is queued for distribution.",
      });
    }

    setEditingReleaseIndex(null);
  };

  const handleSubmitContact = (values: ContactFormValues) => {
    if (editingContactIndex !== null) {
      setContacts((prev) => prev.map((item, idx) => (idx === editingContactIndex ? values : item)));
      toast({
        title: "Contact updated",
        description: "Relationship details refreshed.",
      });
    } else {
      setContacts((prev) => [...prev, values]);
      toast({
        title: "Contact added",
        description: "Contact saved to your outreach list.",
      });
    }

    setEditingContactIndex(null);
  };

  const togglePublish = (title: string) => {
    setPublishingId(title);
    setTimeout(() => {
      setPressReleases((prev) =>
        prev.map((release) =>
          release.title === title
            ? {
                ...release,
                status: release.status === "published" ? "draft" : "published",
              }
            : release
        )
      );
      toast({
        title: "Status updated",
        description: "Publish state changed with optimistic UI.",
      });
      setPublishingId(null);
    }, 450);
  };

  const downloadPdf = (title: string) => {
    setDownloadId(title);
    setTimeout(() => {
      toast({
        title: "PDF ready",
        description: `${title} exported for distribution.`,
      });
      setDownloadId(null);
    }, 550);
  };

  const sendPitch = (email: string) => {
    setPitchingId(email);
    setTimeout(() => {
      toast({
        title: "Pitch sent",
        description: `Outreach dispatched to ${email}.`,
      });
      setPitchingId(null);
    }, 550);
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

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-primary/10">
          <CardHeader>
            <CardTitle>Press release workflow</CardTitle>
            <CardDescription>Create or edit press releases with validation and clear ownership.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...releaseForm}>
              <form onSubmit={releaseForm.handleSubmit(handleSubmitRelease)} className="space-y-4">
                <FormField
                  control={releaseForm.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Headline</FormLabel>
                      <FormControl>
                        <Input placeholder="Announce the milestone" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={releaseForm.control}
                  name="summary"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Summary</FormLabel>
                      <FormControl>
                        <Textarea rows={4} placeholder="What should outlets know?" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={releaseForm.control}
                    name="releaseDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Release date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={releaseForm.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="scheduled">Scheduled</SelectItem>
                            <SelectItem value="published">Published</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={releaseForm.control}
                    name="distributionChannel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Distribution</FormLabel>
                        <FormControl>
                          <Input placeholder="Newswire, newsletter, Discord..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={releaseForm.control}
                  name="contact"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Owner</FormLabel>
                      <FormControl>
                        <Input placeholder="Who owns this send?" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex flex-wrap gap-3">
                  <Button type="submit" className="gap-2">
                    <FileCheck className="h-4 w-4" />
                    {editingReleaseIndex !== null ? "Save changes" : "Create press release"}
                  </Button>
                  {editingReleaseIndex !== null && (
                    <Button variant="ghost" type="button" onClick={() => setEditingReleaseIndex(null)}>
                      Cancel edit
                    </Button>
                  )}
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card className="border-primary/10">
          <CardHeader>
            <CardTitle>Press contact form</CardTitle>
            <CardDescription>Capture media partners with validations for follow-ups.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...contactForm}>
              <form onSubmit={contactForm.handleSubmit(handleSubmitContact)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={contactForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Taylor Jackson" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={contactForm.control}
                    name="outlet"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Outlet</FormLabel>
                        <FormControl>
                          <Input placeholder="Station, publication, newsletter" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={contactForm.control}
                    name="region"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Region</FormLabel>
                        <FormControl>
                          <Input placeholder="City, territory" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={contactForm.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select priority" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="primary">Primary</SelectItem>
                            <SelectItem value="secondary">Secondary</SelectItem>
                            <SelectItem value="watch">Watch list</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={contactForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="editor@email.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={contactForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes & pitch hook</FormLabel>
                      <FormControl>
                        <Textarea rows={3} placeholder="Keep it punchy and tailored" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex flex-wrap gap-3">
                  <Button type="submit" className="gap-2">
                    <Send className="h-4 w-4" />
                    {editingContactIndex !== null ? "Save contact" : "Add contact"}
                  </Button>
                  {editingContactIndex !== null && (
                    <Button variant="ghost" type="button" onClick={() => setEditingContactIndex(null)}>
                      Cancel edit
                    </Button>
                  )}
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Press release table</CardTitle>
              <CardDescription>Sort, filter, and take action on press releases.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search title, owner, summary"
                  value={releaseSearch}
                  onChange={(e) => setReleaseSearch(e.target.value)}
                  className="w-52"
                />
              </div>
              <Select value={releaseStatusFilter} onValueChange={setReleaseStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() =>
                  setReleaseSort((prev) => ({
                    key: prev.key === "releaseDate" ? "status" : "releaseDate",
                    direction: prev.direction === "asc" ? "desc" : "asc",
                  }))
                }
              >
                <Filter className="h-4 w-4" />
                {releaseSort.key === "releaseDate" ? "Date" : "Status"} {releaseSort.direction === "asc" ? "↑" : "↓"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Release date</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReleases.map((release, index) => (
                  <TableRow key={release.title}>
                    <TableCell className="font-semibold">{release.title}</TableCell>
                    <TableCell>
                      <Badge variant={release.status === "published" ? "default" : release.status === "scheduled" ? "secondary" : "outline"}>
                        {release.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{format(new Date(release.releaseDate), "MMM d, yyyy")}</TableCell>
                    <TableCell>{release.contact}</TableCell>
                    <TableCell className="max-w-[180px] truncate">{release.distributionChannel}</TableCell>
                    <TableCell className="space-x-2 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1"
                        onClick={() => setEditingReleaseIndex(index)}
                      >
                        <Plus className="h-4 w-4 rotate-45" /> Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1"
                        onClick={() => togglePublish(release.title)}
                        disabled={publishingId === release.title}
                      >
                        {publishingId === release.title ? <Loader2 className="h-4 w-4 animate-spin" /> : release.status === "published" ? <FileX className="h-4 w-4" /> : <FileCheck className="h-4 w-4" />}
                        {release.status === "published" ? "Unpublish" : "Publish"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1"
                        onClick={() => downloadPdf(release.title)}
                        disabled={downloadId === release.title}
                      >
                        {downloadId === release.title ? <Loader2 className="h-4 w-4 animate-spin" /> : <DownloadCloud className="h-4 w-4" />}
                        PDF
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Contact table</CardTitle>
              <CardDescription>Search, sort, and pitch to media partners.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search names, outlets, regions"
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  className="w-52"
                />
              </div>
              <Select value={contactPriorityFilter} onValueChange={setContactPriorityFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All priorities</SelectItem>
                  <SelectItem value="primary">Primary</SelectItem>
                  <SelectItem value="secondary">Secondary</SelectItem>
                  <SelectItem value="watch">Watch</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() =>
                  setContactSort((prev) => ({
                    key: prev.key === "priority" ? "region" : "priority",
                    direction: prev.direction === "asc" ? "desc" : "asc",
                  }))
                }
              >
                <Filter className="h-4 w-4" />
                {contactSort.key === "priority" ? "Priority" : "Region"} {contactSort.direction === "asc" ? "↑" : "↓"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Outlet</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContacts.map((contact, index) => (
                  <TableRow key={contact.email}>
                    <TableCell className="font-semibold">{contact.name}</TableCell>
                    <TableCell>{contact.outlet}</TableCell>
                    <TableCell>{contact.region}</TableCell>
                    <TableCell>
                      <Badge variant={contact.priority === "primary" ? "default" : contact.priority === "secondary" ? "secondary" : "outline"}>
                        {contact.priority}
                      </Badge>
                    </TableCell>
                    <TableCell className="truncate max-w-[180px]">{contact.email}</TableCell>
                    <TableCell className="space-x-2 text-right">
                      <Button size="sm" variant="ghost" className="gap-1" onClick={() => setEditingContactIndex(index)}>
                        <Plus className="h-4 w-4 rotate-45" /> Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1"
                        onClick={() => sendPitch(contact.email)}
                        disabled={pitchingId === contact.email}
                      >
                        {pitchingId === contact.email ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        Pitch
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PublicRelations;
