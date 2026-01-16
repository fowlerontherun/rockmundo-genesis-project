import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MapPin, Calendar, Users, DollarSign, Plus, Map, Music, Ticket, ChevronRight, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { usePrimaryBand } from "@/hooks/usePrimaryBand";
import { format } from "date-fns";
import { TourCreationWizard } from "@/components/tour/TourCreationWizard";

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
    name: string;
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

const TourManager = () => {
  const { user } = useAuth();
  const { data: primaryBand } = usePrimaryBand();
  const currentBandId = primaryBand?.bands?.id;
  const [selectedTour, setSelectedTour] = useState<Tour | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);

  // Fetch user's band tours
  const { data: myTours = [], isLoading: loadingMyTours } = useQuery({
    queryKey: ['my-tours', currentBandId],
    queryFn: async () => {
      if (!currentBandId) return [];
      const { data, error } = await supabase
        .from('tours')
        .select(`
          *,
          band:bands(name)
        `)
        .eq('band_id', currentBandId)
        .order('start_date', { ascending: false });
      
      if (error) throw error;
      return data as Tour[];
    },
    enabled: !!currentBandId,
  });

  // Fetch other bands' tours
  const { data: otherTours = [], isLoading: loadingOtherTours } = useQuery({
    queryKey: ['other-tours', currentBandId],
    queryFn: async () => {
      let query = supabase
        .from('tours')
        .select(`
          *,
          band:bands(name)
        `)
        .order('start_date', { ascending: false })
        .limit(50);
      
      if (currentBandId) {
        query = query.neq('band_id', currentBandId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as Tour[];
    },
  });

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
      
      // Fetch venue details separately to avoid ambiguous relationship
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

  const TourCard = ({ tour }: { tour: Tour }) => (
    <Card className="hover:border-primary/50 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{tour.name}</CardTitle>
            <CardDescription className="flex items-center gap-1 mt-1">
              <Music className="h-3 w-3" />
              {tour.band?.name || 'Unknown Band'}
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

      <Tabs defaultValue="my-tours" className="space-y-4">
        <TabsList>
          <TabsTrigger value="my-tours">My Band's Tours</TabsTrigger>
          <TabsTrigger value="other-tours">Other Bands Tours</TabsTrigger>
          <TabsTrigger value="getting-started">Getting Started</TabsTrigger>
        </TabsList>

        <TabsContent value="my-tours" className="space-y-4">
          {loadingMyTours ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : myTours.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Tours Yet</h3>
                <p className="text-muted-foreground mb-4">
                  Start planning your first tour to grow your fanbase across different cities!
                </p>
                <Button onClick={() => setWizardOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Tour
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {myTours.map((tour) => (
                <TourCard key={tour.id} tour={tour} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="other-tours" className="space-y-4">
          {loadingOtherTours ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : otherTours.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Music className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Other Tours</h3>
                <p className="text-muted-foreground">
                  No other bands are currently touring. Check back later!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {otherTours.map((tour) => (
                <TourCard key={tour.id} tour={tour} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="getting-started">
          <Card>
            <CardHeader>
              <CardTitle>Getting Started with Tours</CardTitle>
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
      {currentBandId && primaryBand?.bands?.name && (
        <TourCreationWizard
          isOpen={wizardOpen}
          onClose={() => setWizardOpen(false)}
          bandId={currentBandId}
          bandName={primaryBand.bands.name}
        />
      )}
    </div>
  );
};

export default TourManager;