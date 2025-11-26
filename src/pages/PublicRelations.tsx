import { useEffect, useMemo, useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tv, Radio, Mic2, TrendingUp, Calendar, DollarSign, Eye, ThumbsUp, Plus, Megaphone, Handshake, Sparkles } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { usePrimaryBand } from "@/hooks/usePrimaryBand";
import { usePublicRelations } from "@/hooks/usePublicRelations";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useSearchParams } from "react-router-dom";
import { TabKey, usePRStore } from "@/features/public-relations/pr-store";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

const PublicRelations = () => {
  const { data: bandData } = usePrimaryBand();
  const band = bandData?.bands;
  const { toast } = useToast();

  const generateId = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Date.now().toString();

  const {
    campaigns,
    campaignsLoading,
    appearances,
    appearancesLoading,
    offers,
    offersLoading,
    respondToOffer,
  } = usePublicRelations(band?.id);

  const [searchParams, setSearchParams] = useSearchParams();
  const hasHydratedFromParams = useRef(false);
  const campaignNameRef = useRef<HTMLInputElement>(null);

  const {
    tab,
    setTab,
    filters,
    setFilter,
    setFilters,
    pages,
    setPage,
    pageSize,
  } = usePRStore();

  const [newCampaign, setNewCampaign] = useState({
    campaign_type: "tv",
    campaign_name: "",
    budget: 5000,
    start_date: "",
    end_date: "",
  });

  useEffect(() => {
    if (hasHydratedFromParams.current) return;

    const statusParam = searchParams.get("status") ?? "all";
    const mediaTypeParam = searchParams.get("mediaType") ?? "all";
    const searchParam = searchParams.get("search") ?? "";
    const tabParam = (searchParams.get("tab") as TabKey) || "campaigns";

    setFilters({
      status: statusParam,
      mediaType: mediaTypeParam,
      search: searchParam,
    });
    setTab(tabParam);
    hasHydratedFromParams.current = true;
  }, [searchParams, setFilters, setTab]);

  useEffect(() => {
    if (!hasHydratedFromParams.current) return;

    const params = new URLSearchParams();
    params.set("tab", tab);
    params.set("status", filters.status);
    params.set("mediaType", filters.mediaType);
    if (filters.search) {
      params.set("search", filters.search);
    }

    setSearchParams(params, { replace: true });
  }, [filters, setSearchParams, tab]);

  const matchesFilters = (
    item: any,
    statusKey: string | null,
    mediaKey: string | null,
    searchKeys: string[],
  ) => {
    const searchTerm = filters.search.trim().toLowerCase();
    const statusValue = statusKey ? String(item[statusKey] ?? "").toLowerCase() : "";
    const mediaValue = mediaKey ? String(item[mediaKey] ?? "").toLowerCase() : "";

    const statusMatches =
      filters.status === "all" || statusValue === filters.status.toLowerCase();
    const mediaMatches =
      filters.mediaType === "all" || mediaValue === filters.mediaType.toLowerCase();
    const searchMatches =
      !searchTerm ||
      searchKeys.some((key) => String(item[key] ?? "").toLowerCase().includes(searchTerm));

    return statusMatches && mediaMatches && searchMatches;
  };

  const filteredCampaigns = useMemo(
    () =>
      campaigns.filter((c: any) =>
        matchesFilters(c, "status", "campaign_type", ["campaign_name", "campaign_type"]),
      ),
    [campaigns, filters],
  );

  const filteredAppearances = useMemo(
    () =>
      appearances.filter((a: any) =>
        matchesFilters(a, "sentiment", "media_type", ["program_name", "network", "media_type", "highlight"]),
      ),
    [appearances, filters],
  );

  const filteredOffers = useMemo(
    () =>
      offers.filter((o: any) =>
        matchesFilters(o, "status", "media_type", ["program_name", "network", "media_type"]),
      ),
    [filters, offers],
  );

  const paginateList = <T,>(items: T[], tabKey: TabKey) => {
    const currentPage = pages[tabKey] ?? 1;
    const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
    const safePage = Math.min(currentPage, totalPages);
    const start = (safePage - 1) * pageSize;

    return {
      page: safePage,
      totalPages,
      items: items.slice(start, start + pageSize),
    };
  };

  const campaignPagination = useMemo(
    () => paginateList(filteredCampaigns, "campaigns"),
    [filteredCampaigns, pages.campaigns, pageSize],
  );
  const appearancePagination = useMemo(
    () => paginateList(filteredAppearances, "appearances"),
    [filteredAppearances, pages.appearances, pageSize],
  );
  const offerPagination = useMemo(
    () => paginateList(filteredOffers, "offers"),
    [filteredOffers, pages.offers, pageSize],
  );

  useEffect(() => {
    if (campaignPagination.page !== pages.campaigns) {
      setPage("campaigns", campaignPagination.page);
    }
    if (appearancePagination.page !== pages.appearances) {
      setPage("appearances", appearancePagination.page);
    }
    if (offerPagination.page !== pages.offers) {
      setPage("offers", offerPagination.page);
    }
  }, [appearancePagination.page, campaignPagination.page, offerPagination.page, pages, setPage]);

  const handleCreateCampaign = () => {
    if (!newCampaign.campaign_name || !newCampaign.start_date || !newCampaign.end_date) {
      toast({
        title: "Missing Fields",
        description: "Please fill in campaign name, start date, and end date.",
        variant: "destructive",
      });
      return;
    }
    
    toast({
      title: "Campaign Created",
      description: "Your campaign has been successfully created.",
    });
    
    setTimeout(() => {
      campaignNameRef.current?.focus();
    }, 400);
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
  }, [pressReleases, releaseStatusFilter, releaseSearch, releaseSort]);

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

  const getStatusBadge = (status: string) => {
    if (status === "active") return <Badge className="bg-success">Active</Badge>;
    if (status === "completed") return <Badge variant="secondary">Completed</Badge>;
    if (status === "pending") return <Badge variant="outline">Pending</Badge>;
    if (status === "accepted") return <Badge className="bg-success">Accepted</Badge>;
    if (status === "declined" || status === "cancelled") return <Badge variant="destructive">{status}</Badge>;
    return <Badge>{status}</Badge>;
  };

  const renderPagination = (tabKey: TabKey, paginationData: { page: number; totalPages: number }) => {
    if (paginationData.totalPages <= 1) return null;

    const pagesArray = Array.from({ length: paginationData.totalPages }, (_, index) => index + 1);

    return (
      <Pagination className="pt-4" aria-label={`${tabKey} pagination`}>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              aria-label="Previous page"
              aria-disabled={paginationData.page === 1}
              className={paginationData.page === 1 ? "pointer-events-none opacity-50" : ""}
              onClick={(event) => {
                event.preventDefault();
                if (paginationData.page > 1) {
                  setPage(tabKey, paginationData.page - 1);
                }
              }}
            />
          </PaginationItem>
          {pagesArray.map((pageNumber) => (
            <PaginationItem key={`${tabKey}-${pageNumber}`}>
              <PaginationLink
                href="#"
                aria-label={`Go to page ${pageNumber}`}
                isActive={pageNumber === paginationData.page}
                onClick={(event) => {
                  event.preventDefault();
                  setPage(tabKey, pageNumber);
                }}
              >
                {pageNumber}
              </PaginationLink>
            </PaginationItem>
          ))}
          <PaginationItem>
            <PaginationNext
              href="#"
              aria-label="Next page"
              aria-disabled={paginationData.page >= paginationData.totalPages}
              className={paginationData.page >= paginationData.totalPages ? "pointer-events-none opacity-50" : ""}
              onClick={(event) => {
                event.preventDefault();
                if (paginationData.page < paginationData.totalPages) {
                  setPage(tabKey, paginationData.page + 1);
                }
              }}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    );
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

  const overviewCards = [
    {
      label: "Active Campaigns",
      value: campaigns.length,
      icon: Megaphone,
      tone: "bg-primary/10 text-primary",
      isLoading: campaignsLoading,
    },
    {
      label: "Pending Offers",
      value: pendingOffers,
      icon: Handshake,
      tone: "bg-warning/15 text-warning-foreground",
      isLoading: offersLoading,
    },
    {
      label: "Audience Reach",
      value: totalReach,
      icon: Mic2,
      tone: "bg-success/10 text-success",
      isLoading: campaignsLoading,
    },
    {
      label: "Media Appearances",
      value: appearances.length,
      icon: Tv,
      tone: "bg-secondary/20 text-secondary-foreground",
      isLoading: appearancesLoading,
    },
  ];

  return (
    <div className="container mx-auto space-y-8 p-6">
      <header className="space-y-2">
        <Badge variant="outline" className="px-3 py-1 text-xs uppercase tracking-wide">
          Public Relations
        </Badge>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Media & PR HQ</h1>
            <p className="text-muted-foreground">Control how {band.name} shows up across press, radio, and TV.</p>
          </div>
          <Button variant="secondary" className="gap-2" onClick={() => toast({ title: "Media kit generated" })}>
            <Sparkles className="h-4 w-4" />
            Refresh media kit
          </Button>
        </div>
      </header>

      <Dialog>
          <DialogTrigger asChild>
            <Button aria-label="Open new campaign dialog"><Plus className="h-4 w-4 mr-2" />New Campaign</Button>
          </DialogTrigger>
          <DialogContent aria-label="Create PR campaign dialog">
            <DialogHeader>
              <DialogTitle>Create PR Campaign</DialogTitle>
              <DialogDescription>Launch a new media campaign</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="campaign-name">Campaign Name</Label>
                <Input
                  id="campaign-name"
                  ref={campaignNameRef}
                  autoFocus
                  aria-label="Campaign name"
                  value={newCampaign.campaign_name}
                  onChange={(e) => setNewCampaign({ ...newCampaign, campaign_name: e.target.value })}
                  placeholder="Summer Media Blitz"
                />
              </div>
              <div>
                <Label htmlFor="campaign-type">Type</Label>
                <Select
                  value={newCampaign.campaign_type}
                  onValueChange={(value) => setNewCampaign({ ...newCampaign, campaign_type: value })}
                >
                  <SelectTrigger id="campaign-type" aria-label="Select campaign type"><SelectValue /></SelectTrigger>
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
                <Label htmlFor="campaign-budget">Budget</Label>
                <Input
                  id="campaign-budget"
                  aria-label="Campaign budget"
                  type="number"
                  value={newCampaign.budget}
                  onChange={(e) => setNewCampaign({ ...newCampaign, budget: Number(e.target.value) })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="campaign-start">Start Date</Label>
                  <Input
                    id="campaign-start"
                    aria-label="Campaign start date"
                    type="date"
                    value={newCampaign.start_date}
                    onChange={(e) => setNewCampaign({ ...newCampaign, start_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="campaign-end">End Date</Label>
                  <Input
                    id="campaign-end"
                    aria-label="Campaign end date"
                    type="date"
                    value={newCampaign.end_date}
                    onChange={(e) => setNewCampaign({ ...newCampaign, end_date: e.target.value })}
                  />
                </div>
              </div>
              <Button aria-label="Create campaign" onClick={handleCreateCampaign} className="w-full">Create Campaign</Button>
            </div>
          </DialogContent>
        </Dialog>

      <Card>
        <CardContent className="p-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="status-filter">Status</Label>
              <Select value={filters.status} onValueChange={(value) => setFilter("status", value)}>
                <SelectTrigger id="status-filter" aria-label="Filter by status">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="declined">Declined</SelectItem>
                  <SelectItem value="positive">Positive</SelectItem>
                  <SelectItem value="negative">Negative</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="media-filter">Media Type</Label>
              <Select value={filters.mediaType} onValueChange={(value) => setFilter("mediaType", value)}>
                <SelectTrigger id="media-filter" aria-label="Filter by media type">
                  <SelectValue placeholder="All media" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="tv">TV</SelectItem>
                  <SelectItem value="radio">Radio</SelectItem>
                  <SelectItem value="podcast">Podcast</SelectItem>
                  <SelectItem value="press">Press</SelectItem>
                  <SelectItem value="social">Social Media</SelectItem>
                  <SelectItem value="influencer">Influencer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pr-search">Search</Label>
              <Input
                id="pr-search"
                aria-label="Search PR items"
                placeholder="Search campaigns or appearances"
                value={filters.search}
                onChange={(event) => setFilter("search", event.target.value)}
              />
            </div>
            <div className="flex items-end justify-end">
              <Button
                aria-label="Reset PR filters"
                variant="outline"
                onClick={() => setFilters({ status: "all", mediaType: "all", search: "" })}
              >
                Reset Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={(value) => setTab(value as TabKey)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="appearances">Appearances</TabsTrigger>
          <TabsTrigger value="offers">Offers</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns">
          {campaignsLoading ? (
            <Card><CardContent className="p-6">Loading...</CardContent></Card>
          ) : filteredCampaigns.length === 0 ? (
            <Card><CardContent className="p-6 text-center text-muted-foreground">No campaigns match these filters</CardContent></Card>
          ) : (
            <>
              <div className="grid gap-4">
                {campaignPagination.items.map((c: any) => (
                  <Card key={c.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex flex-wrap items-center gap-2">{getMediaIcon(c.campaign_type)}<CardTitle className="text-lg">{c.campaign_name}</CardTitle></div>
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
                ))}
              </div>
              {renderPagination("campaigns", campaignPagination)}
            </>
          )}
        </TabsContent>

        <TabsContent value="appearances">
          {appearancesLoading ? (
            <Card><CardContent className="p-6">Loading...</CardContent></Card>
          ) : filteredAppearances.length === 0 ? (
            <Card><CardContent className="p-6 text-center text-muted-foreground">No appearances match these filters</CardContent></Card>
          ) : (
            <>
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Program</TableHead>
                      <TableHead>Network</TableHead>
                      <TableHead>Air Date</TableHead>
                      <TableHead>Reach</TableHead>
                      <TableHead>Sentiment</TableHead>
                      <TableHead>Highlight</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {appearancePagination.items.map((a: any) => (
                      <TableRow key={a.id}>
                        <TableCell><div className="flex items-center gap-2">{getMediaIcon(a.media_type)}<span className="capitalize">{a.media_type}</span></div></TableCell>
                        <TableCell className="font-medium">{a.program_name}</TableCell>
                        <TableCell>{a.network}</TableCell>
                        <TableCell>{format(new Date(a.air_date), "MMM d, yyyy")}</TableCell>
                        <TableCell>{a.audience_reach.toLocaleString()}</TableCell>
                        <TableCell>{getSentimentBadge(a.sentiment)}</TableCell>
                        <TableCell className="max-w-xs truncate" title={a.highlight}>{a.highlight}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
              {renderPagination("appearances", appearancePagination)}
            </>
          )}
        </TabsContent>

        <TabsContent value="offers">
          {offersLoading ? (
            <Card><CardContent className="p-6">Loading...</CardContent></Card>
          ) : filteredOffers.length === 0 ? (
            <Card><CardContent className="p-6 text-center text-muted-foreground">No offers match these filters</CardContent></Card>
          ) : (
            <>
              <div className="grid gap-4">
                {offerPagination.items.map((o: any) => (
                  <Card key={o.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex flex-wrap items-center gap-2">{getMediaIcon(o.media_type)}<CardTitle className="text-lg">{o.program_name}</CardTitle></div>
                        {getStatusBadge(o.status)}
                      </div>
                      <CardDescription>{o.network} • {format(new Date(o.proposed_date), "MMMM d, yyyy")}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div><div className="text-sm text-muted-foreground">Compensation</div><div className="text-2xl font-bold">${o.compensation.toLocaleString()}</div></div>
                        {o.status === "pending" && <div className="flex gap-2">
                          <Button aria-label={`Accept offer for ${o.program_name}`} onClick={() => respondToOffer({ offerId: o.id, accept: true })} size="sm" className="bg-success">Accept</Button>
                          <Button aria-label={`Decline offer for ${o.program_name}`} onClick={() => respondToOffer({ offerId: o.id, accept: false })} size="sm" variant="destructive">Decline</Button>
                        </div>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {renderPagination("offers", offerPagination)}
            </>
          )}
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
