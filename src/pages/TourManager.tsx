import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Calendar, Users, DollarSign, Plus, Map, Music, Ticket, ChevronRight, Loader2, ChevronLeft, Star, History, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { usePrimaryBand } from "@/hooks/usePrimaryBand";
import { format } from "date-fns";
import { TourWizard } from "@/components/tours/TourWizard";
import { MUSIC_GENRES } from "@/data/genres";

interface Tour {
  id: string;
  name: string;
  band_id: string;
  user_id: string;
  status: string;
  start_date: string;
  end_date: string;
  total_revenue: number;
  description: string | null;
  band: {
    id: string;
    name: string;
    fame: number | null;
    genre: string | null;
    total_fans: number | null;
  } | null;
}

interface TourVenue {
  id: string;
  tour_id: string;
  venue_id: string;
  date: string;
  ticket_price: number | null;
  tickets_sold: number;
  revenue: number;
  status: string;
  venue: {
    name: string;
    capacity: number;
    city: {
      name: string;
      country: string;
    } | null;
  } | null;
}

const OTHER_TOURS_PER_PAGE = 10;

const TourManager = () => {
  const { user } = useAuth();
  const { data: primaryBand } = usePrimaryBand();
  const currentBandId = primaryBand?.bands?.id;
  const [selectedTour, setSelectedTour] = useState<Tour | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);

  // Other tours filters
  const [fameFilter, setFameFilter] = useState<string>("all");
  const [genreFilter, setGenreFilter] = useState<string>("all");
  const [otherToursPage, setOtherToursPage] = useState(1);

  // Fetch user's band tours - split by status
  const { data: myTours = [], isLoading: loadingMyTours } = useQuery({
    queryKey: ['my-tours', currentBandId],
    queryFn: async () => {
      if (!currentBandId) return [];
      const { data, error } = await supabase
        .from('tours')
        .select(`
          *,
          band:bands!tours_band_id_fkey(id, name, fame, genre, total_fans)
        `)
        .eq('band_id', currentBandId)
        .order('start_date', { ascending: false });
      
      if (error) throw error;
      return data as Tour[];
    },
    enabled: !!currentBandId,
  });

  const currentTour = myTours.find(t => t.status === 'active');
  const upcomingTours = myTours.filter(t => t.status === 'scheduled');
  const historicTours = myTours.filter(t => t.status === 'completed' || t.status === 'cancelled');

  // Fetch other bands' tours with filtering and pagination
  const { data: otherToursData, isLoading: loadingOtherTours } = useQuery({
    queryKey: ['other-tours', currentBandId, fameFilter, genreFilter, otherToursPage],
    queryFn: async () => {
      let query = supabase
        .from('tours')
        .select(`
          *,
          band:bands!tours_band_id_fkey(id, name, fame, genre, total_fans)
        `, { count: 'exact' })
        .eq('status', 'active')
        .order('start_date', { ascending: true });
      
      if (currentBandId) {
        query = query.neq('band_id', currentBandId);
      }

      const from = (otherToursPage - 1) * OTHER_TOURS_PER_PAGE;
      query = query.range(from, from + OTHER_TOURS_PER_PAGE - 1);
      
      const { data, count, error } = await query;
      if (error) throw error;
      
      let tours = data as Tour[];

      // Client-side filtering for fame and genre
      if (fameFilter !== 'all') {
        tours = tours.filter(t => {
          const fame = t.band?.fame ?? 0;
          if (fameFilter === 'local') return fame < 1000;
          if (fameFilter === 'regional') return fame >= 1000 && fame < 5000;
          if (fameFilter === 'national') return fame >= 5000 && fame < 20000;
          if (fameFilter === 'international') return fame >= 20000;
          return true;
        });
      }

      if (genreFilter !== 'all') {
        tours = tours.filter(t => t.band?.genre === genreFilter);
      }

      return { tours, totalCount: count ?? 0 };
    },
  });

  const otherToursTotalPages = Math.ceil((otherToursData?.totalCount ?? 0) / OTHER_TOURS_PER_PAGE);

  // Fetch tour venues/dates for selected tour
  const { data: tourVenues = [], isLoading: loadingVenues } = useQuery({
    queryKey: ['tour-venues', selectedTour?.id],
    queryFn: async () => {
      if (!selectedTour?.id) return [];
      const { data, error } = await supabase
        .from('tour_venues')
        .select(`
          id,
          tour_id,
          venue_id,
          date,
          ticket_price,
          tickets_sold,
          revenue,
          status,
          city_id
        `)
        .eq('tour_id', selectedTour.id)
        .order('date', { ascending: true });
      
      if (error) throw error;
      
      // Fetch venue details separately
      const venueIdSet = new Set<string>();
      const cityIdSet = new Set<string>();
      (data || []).forEach(tv => {
        if (tv.venue_id) venueIdSet.add(tv.venue_id);
        if (tv.city_id) cityIdSet.add(tv.city_id);
      });
      const venueIds = Array.from(venueIdSet);
      const cityIds = Array.from(cityIdSet);
      
      const [venuesResult, citiesResult] = await Promise.all([
        venueIds.length > 0 
          ? supabase.from('venues').select('id, name, capacity, city_id').in('id', venueIds)
          : { data: [] },
        cityIds.length > 0
          ? supabase.from('cities').select('id, name, country').in('id', cityIds)
          : { data: [] }
      ]);
      
      const venuesMap: Record<string, { id: string; name: string; capacity: number; city_id: string | null }> = {};
      const citiesMap: Record<string, { id: string; name: string; country: string }> = {};
      (venuesResult.data || []).forEach(v => { venuesMap[v.id] = v; });
      (citiesResult.data || []).forEach(c => { citiesMap[c.id] = c; });
      
      return (data || []).map(tv => {
        const venue = tv.venue_id ? venuesMap[tv.venue_id] : null;
        const city = venue?.city_id ? citiesMap[venue.city_id] : (tv.city_id ? citiesMap[tv.city_id] : null);
        return {
          ...tv,
          venue: venue ? {
            name: venue.name,
            capacity: venue.capacity,
            city: city ? { name: city.name, country: city.country } : null
          } : null
        };
      }) as TourVenue[];
    },
    enabled: !!selectedTour?.id,
  });

  const activeTourCount = myTours.filter(t => t.status === 'active' || t.status === 'scheduled').length;
  const totalRevenue = myTours.reduce((sum, t) => sum + (t.total_revenue || 0), 0);
  const upcomingShows = myTours.filter(t => new Date(t.start_date) > new Date()).length;

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      scheduled: "secondary",
      completed: "outline",
      cancelled: "destructive",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  const openTourDetails = (tour: Tour) => {
    setSelectedTour(tour);
    setDetailsOpen(true);
  };

  const TourCard = ({ tour, showBandInfo = false }: { tour: Tour; showBandInfo?: boolean }) => (
    <Card className="hover:border-primary/50 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{tour.name}</CardTitle>
            <CardDescription className="flex items-center gap-1 mt-1">
              <Music className="h-3 w-3" />
              {tour.band?.name || 'Unknown Band'}
              {showBandInfo && tour.band?.fame && (
                <Badge variant="outline" className="ml-2 text-xs">
                  <Star className="h-3 w-3 mr-1" />
                  {tour.band.fame.toLocaleString()}
                </Badge>
              )}
            </CardDescription>
          </div>
          {getStatusBadge(tour.status)}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            {format(new Date(tour.start_date), 'MMM d')} - {format(new Date(tour.end_date), 'MMM d, yyyy')}
          </span>
        </div>
        {showBandInfo && tour.band?.genre && (
          <Badge variant="secondary">{tour.band.genre}</Badge>
        )}
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1">
            <DollarSign className="h-4 w-4 text-green-500" />
            ${(tour.total_revenue || 0).toLocaleString()}
          </span>
        </div>
        {tour.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{tour.description}</p>
        )}
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full"
          onClick={() => openTourDetails(tour)}
        >
          More Details
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </CardContent>
    </Card>
  );

  const EmptyState = ({ icon: Icon, title, description, action }: { 
    icon: any; 
    title: string; 
    description: string;
    action?: React.ReactNode;
  }) => (
    <Card>
      <CardContent className="py-12 text-center">
        <Icon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-muted-foreground mb-4">{description}</p>
        {action}
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tour Manager</h1>
          <p className="text-muted-foreground">Plan and manage your band's tours</p>
        </div>
        <Button onClick={() => setWizardOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Tour
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Active Tours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeTourCount}</div>
            <p className="text-xs text-muted-foreground">
              {activeTourCount === 0 ? 'No tours scheduled' : 'Tours in progress or planned'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Upcoming Shows
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingShows}</div>
            <p className="text-xs text-muted-foreground">
              {upcomingShows === 0 ? 'Plan your first tour' : 'Tours starting soon'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Tour Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Lifetime earnings</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="current" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="current">My Current Tour</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming Tours</TabsTrigger>
          <TabsTrigger value="historic">Historic Tours</TabsTrigger>
          <TabsTrigger value="getting-started">Getting Started</TabsTrigger>
          <TabsTrigger value="other-tours">Other Bands Tours</TabsTrigger>
        </TabsList>

        {/* My Current Tour */}
        <TabsContent value="current" className="space-y-4">
          {loadingMyTours ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !currentTour ? (
            <EmptyState
              icon={MapPin}
              title="No Active Tour"
              description="You don't have an active tour right now. Create one to get started!"
              action={
                <Button onClick={() => setWizardOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create New Tour
                </Button>
              }
            />
          ) : (
            <TourCard tour={currentTour} />
          )}
        </TabsContent>

        {/* Upcoming Tours */}
        <TabsContent value="upcoming" className="space-y-4">
          {loadingMyTours ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : upcomingTours.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="No Upcoming Tours"
              description="You haven't scheduled any future tours yet."
              action={
                <Button onClick={() => setWizardOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Schedule a Tour
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {upcomingTours.map((tour) => (
                <TourCard key={tour.id} tour={tour} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Historic Tours */}
        <TabsContent value="historic" className="space-y-4">
          {loadingMyTours ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : historicTours.length === 0 ? (
            <EmptyState
              icon={History}
              title="No Tour History"
              description="Your completed tours will appear here."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {historicTours.map((tour) => (
                <TourCard key={tour.id} tour={tour} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Getting Started */}
        <TabsContent value="getting-started">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Getting Started with Tours
              </CardTitle>
              <CardDescription>Build your touring empire step by step</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-4 p-4 border rounded-lg">
                <Map className="h-6 w-6 text-primary mt-1" />
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">Plan Your Route</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Select cities and venues for your tour stops
                  </p>
                  <Link to="/travel">
                    <Button variant="outline" size="sm">View Travel System</Button>
                  </Link>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 border rounded-lg">
                <Calendar className="h-6 w-6 text-primary mt-1" />
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">Book Venues</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Schedule gigs at venues along your route
                  </p>
                  <Link to="/gigs">
                    <Button variant="outline" size="sm">Book Gigs</Button>
                  </Link>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 border rounded-lg">
                <Users className="h-6 w-6 text-primary mt-1" />
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">Assemble Your Crew</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Hire road crew and touring support staff
                  </p>
                  <Link to="/band-crew">
                    <Button variant="outline" size="sm">Manage Crew</Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Other Bands Tours */}
        <TabsContent value="other-tours" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-wrap gap-4">
                <div className="space-y-1">
                  <label className="text-sm text-muted-foreground">Fame Level</label>
                  <Select value={fameFilter} onValueChange={(v) => { setFameFilter(v); setOtherToursPage(1); }}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Levels</SelectItem>
                      <SelectItem value="local">Local (&lt;1K)</SelectItem>
                      <SelectItem value="regional">Regional (1K-5K)</SelectItem>
                      <SelectItem value="national">National (5K-20K)</SelectItem>
                      <SelectItem value="international">International (20K+)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-sm text-muted-foreground">Genre</label>
                  <Select value={genreFilter} onValueChange={(v) => { setGenreFilter(v); setOtherToursPage(1); }}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Genres</SelectItem>
                      {MUSIC_GENRES.map((g) => (
                        <SelectItem key={g} value={g}>{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {loadingOtherTours ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : otherToursData?.tours.length === 0 ? (
            <EmptyState
              icon={Music}
              title="No Other Tours"
              description="No other bands are currently touring. Check back later!"
            />
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {otherToursData?.tours.map((tour) => (
                  <TourCard key={tour.id} tour={tour} showBandInfo />
                ))}
              </div>

              {/* Pagination */}
              {otherToursTotalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOtherToursPage((p) => Math.max(1, p - 1))}
                    disabled={otherToursPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground px-4">
                    Page {otherToursPage} of {otherToursTotalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOtherToursPage((p) => Math.min(otherToursTotalPages, p + 1))}
                    disabled={otherToursPage === otherToursTotalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Tour Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              {selectedTour?.name}
            </DialogTitle>
          </DialogHeader>
          
          {selectedTour && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-6 pr-4">
                {/* Tour Overview */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Band</p>
                    <p className="font-medium">{selectedTour.band?.name || 'Unknown'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Status</p>
                    {getStatusBadge(selectedTour.status)}
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Dates</p>
                    <p className="font-medium">
                      {format(new Date(selectedTour.start_date), 'MMM d, yyyy')} - {format(new Date(selectedTour.end_date), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Total Revenue</p>
                    <p className="font-medium text-green-500">${(selectedTour.total_revenue || 0).toLocaleString()}</p>
                  </div>
                </div>

                {selectedTour.description && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Description</p>
                    <p className="text-sm">{selectedTour.description}</p>
                  </div>
                )}

                {/* Tour Dates & Venues */}
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Tour Dates & Venues
                  </h3>
                  
                  {loadingVenues ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : tourVenues.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      No venue dates scheduled for this tour yet.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {tourVenues.map((tv, index) => (
                        <div 
                          key={tv.id} 
                          className="flex items-center justify-between p-3 border rounded-lg bg-muted/30"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                              {index + 1}
                            </div>
                            <div>
                              <p className="font-medium">{tv.venue?.name || 'Unknown Venue'}</p>
                              <p className="text-xs text-muted-foreground">
                                {tv.venue?.city?.name}, {tv.venue?.city?.country} • {format(new Date(tv.date), 'MMM d, yyyy')}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-1 text-sm">
                              <Ticket className="h-3 w-3" />
                              <span>{tv.tickets_sold || 0} / {tv.venue?.capacity || '?'}</span>
                            </div>
                            <p className="text-xs text-green-500">
                              ${(tv.revenue || 0).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Ticket Sales Summary */}
                {tourVenues.length > 0 && (
                  <Card className="bg-muted/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Ticket Sales Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-2xl font-bold">
                            {tourVenues.reduce((sum, tv) => sum + (tv.tickets_sold || 0), 0).toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">Tickets Sold</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold">
                            {tourVenues.reduce((sum, tv) => sum + (tv.venue?.capacity || 0), 0).toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">Total Capacity</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-green-500">
                            ${tourVenues.reduce((sum, tv) => sum + (tv.revenue || 0), 0).toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">Revenue</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Tour Creation Wizard */}
      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Tour - {primaryBand?.bands?.name}</DialogTitle>
          </DialogHeader>
          {currentBandId && (
            <TourWizard
              bandId={currentBandId}
              onComplete={() => setWizardOpen(false)}
              onCancel={() => setWizardOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TourManager;
