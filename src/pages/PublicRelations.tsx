import { useEffect, useMemo, useRef, useState } from "react";
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
    campaignNameRef.current?.focus();
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
      </div>

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
    </div>
  );
};

export default PublicRelations;
