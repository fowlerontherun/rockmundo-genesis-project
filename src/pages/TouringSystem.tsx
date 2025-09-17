import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth-context';
import { useGameData } from '@/hooks/useGameData';
import { toast } from '@/components/ui/sonner-toast';
import { applyEquipmentWear } from '@/utils/equipmentWear';
import { 
  MapPin, 
  Calendar as CalendarIcon, 
  Truck, 
  Users, 
  DollarSign, 
  Clock, 
  Route,
  Plane,
  Hotel,
  Music,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp
} from 'lucide-react';
import { format, addDays, differenceInDays } from 'date-fns';
import type { Database } from '@/integrations/supabase/types';

interface TourVenue {
  id: string;
  venue_id: string;
  venue_name: string;
  venue_capacity: number;
  city: string;
  country: string;
  date: string;
  ticket_price: number;
  tickets_sold: number;
  status: 'scheduled' | 'completed' | 'cancelled';
  revenue: number;
  expenses: number;
  distance_from_previous: number;
}

interface Tour {
  id: string;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  status: 'planned' | 'active' | 'completed' | 'cancelled';
  total_revenue: number;
  total_expenses: number;
  venues: TourVenue[];
  created_at: string;
}

interface TourLogistics {
  transport_cost: number;
  accommodation_cost: number;
  crew_cost: number;
  equipment_cost: number;
  marketing_cost: number;
  insurance_cost: number;
  misc_cost: number;
}

type TourRow = Database['public']['Tables']['tours']['Row'];
type TourVenueRow = Database['public']['Tables']['tour_venues']['Row'];
type VenueRow = Database['public']['Tables']['venues']['Row'];

type TourRecord = TourRow & {
  tour_venues: (TourVenueRow & { venue: VenueRow | null })[] | null;
};

const TouringSystem: React.FC = () => {
  const { user } = useAuth();
  const { profile, updateProfile, addActivity } = useGameData();
  const [tours, setTours] = useState<Tour[]>([]);
  const [availableVenues, setAvailableVenues] = useState<VenueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateTour, setShowCreateTour] = useState(false);
  const [selectedTour, setSelectedTour] = useState<Tour | null>(null);
  const [newTour, setNewTour] = useState({
    name: '',
    description: '',
    start_date: new Date(),
    end_date: addDays(new Date(), 30)
  });
  const [selectedVenues, setSelectedVenues] = useState<string[]>([]);
  const [logistics, setLogistics] = useState<TourLogistics>({
    transport_cost: 5000,
    accommodation_cost: 3000,
    crew_cost: 8000,
    equipment_cost: 2000,
    marketing_cost: 4000,
    insurance_cost: 1500,
    misc_cost: 1000
  });

  useEffect(() => {
    if (user) {
      loadTourData();
    }
  }, [user]);

  const loadTourData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Load user's tours
      const { data: toursData, error: toursError } = await supabase
        .from('tours')
        .select(`
          *,
          tour_venues(
            *,
            venue:venues(*)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (toursError) throw toursError;

      // Transform the data
      const toursList = (toursData ?? []) as TourRecord[];
      const transformedTours: Tour[] = toursList.map(tour => {
        const status: Tour['status'] = (tour.status as Tour['status']) ?? 'planned';
        const venues = (tour.tour_venues ?? []).map((tv): TourVenue => {
          const venueDetails = tv.venue;
          return {
            id: tv.id,
            venue_id: tv.venue_id,
            venue_name: venueDetails?.name ?? 'Unknown Venue',
            venue_capacity: venueDetails?.capacity ?? 0,
            city: venueDetails?.location ?? 'Unknown City',
            country: 'Various',
            date: tv.date,
            ticket_price: tv.ticket_price ?? 50,
            tickets_sold: tv.tickets_sold ?? 0,
            status: (tv.status as TourVenue['status']) ?? 'scheduled',
            revenue: tv.revenue ?? 0,
            expenses: 0,
            distance_from_previous: Math.floor(Math.random() * 500) + 100
          };
        });

        return {
          id: tour.id,
          name: tour.name,
          description: tour.description ?? '',
          start_date: tour.start_date,
          end_date: tour.end_date,
          status,
          total_revenue: tour.total_revenue ?? 0,
          total_expenses: 0,
          venues,
          created_at: tour.created_at ?? new Date().toISOString()
        };
      });

      setTours(transformedTours);

      // Load available venues
      const { data: venuesData, error: venuesError } = await supabase
        .from('venues')
        .select('*')
        .order('prestige_level', { ascending: false });

      if (venuesError) throw venuesError;
      setAvailableVenues(venuesData ?? []);

    } catch (error: unknown) {
      const fallbackMessage = 'Failed to load tour data';
      const errorMessage = error instanceof Error ? error.message : fallbackMessage;
      console.error('Error loading tour data:', errorMessage, error);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const createTour = async () => {
    if (!user || !profile) return;

    if (!newTour.name || selectedVenues.length === 0) {
      toast.error('Please provide tour name and select at least one venue');
      return;
    }

    try {
      // Calculate total logistics cost
      const totalLogisticsCost = Object.values(logistics).reduce((sum, cost) => sum + cost, 0);
      
      if (profile.cash < totalLogisticsCost) {
        toast.error('Insufficient funds to organize tour');
        return;
      }

      // Create tour
      const { data: tourData, error: tourError } = await supabase
        .from('tours')
        .insert({
          user_id: user.id,
          name: newTour.name,
          description: newTour.description,
          start_date: newTour.start_date.toISOString(),
          end_date: newTour.end_date.toISOString(),
          status: 'planned',
          total_revenue: 0
        })
        .select()
        .single();

      if (tourError) throw tourError;

      // Create tour venues
      const tourVenues = selectedVenues.map((venueId, index) => {
        const venue = availableVenues.find(v => v.id === venueId);
        const showDate = addDays(newTour.start_date, index * 3); // 3 days between shows
        const basePayment = venue?.base_payment ?? 500;
        const ticketPrice = Math.max(50, Math.floor(basePayment / 10));

        return {
          tour_id: tourData.id,
          venue_id: venueId,
          date: showDate.toISOString(),
          ticket_price: ticketPrice,
          status: 'scheduled'
        };
      });

      const { error: venuesError } = await supabase
        .from('tour_venues')
        .insert(tourVenues);

      if (venuesError) throw venuesError;

      // Deduct logistics cost
      await updateProfile({
        cash: profile.cash - totalLogisticsCost
      });

      await addActivity(
        'tour_created',
        `Created tour: ${newTour.name} with ${selectedVenues.length} venues`,
        -totalLogisticsCost
      );

      toast.success('Tour created successfully!');
      setShowCreateTour(false);
      setNewTour({ name: '', description: '', start_date: new Date(), end_date: addDays(new Date(), 30) });
      setSelectedVenues([]);
      loadTourData();

    } catch (error: unknown) {
      const fallbackMessage = 'Failed to create tour';
      const errorMessage = error instanceof Error ? error.message : fallbackMessage;
      console.error('Error creating tour:', errorMessage, error);
      toast.error(errorMessage);
    }
  };

  const executeTourShow = async (tourId: string, venueIndex: number) => {
    if (!user || !profile) return;

    const tour = tours.find(t => t.id === tourId);
    if (!tour || !tour.venues[venueIndex]) return;

    const venue = tour.venues[venueIndex];
    
    try {
      // Simulate show performance
      const performanceScore = Math.random() * 0.4 + 0.6; // 60-100% performance
      const ticketsSold = Math.floor(venue.venue_capacity * performanceScore);
      const revenue = ticketsSold * venue.ticket_price;
      const expenses = Math.floor(revenue * 0.3); // 30% expenses

      // Update tour venue
      await supabase
        .from('tour_venues')
        .update({
          status: 'completed',
          tickets_sold: ticketsSold,
          revenue: revenue
        })
        .eq('id', venue.id);

      // Update profile
      const netEarnings = revenue - expenses;
      await updateProfile({
        cash: profile.cash + netEarnings,
        fame: profile.fame + Math.floor(ticketsSold / 100),
        experience: profile.experience + Math.floor(performanceScore * 100)
      });

      await addActivity(
        'tour_show',
        `Performed at ${venue.venue_name} - ${ticketsSold} tickets sold`,
        netEarnings
      );

      try {
        const wearSummary = await applyEquipmentWear(user.id, 'tour');
        if (wearSummary?.updates.length) {
          toast.info('Your gear took some wear on the road. Visit the inventory manager to plan repairs.');
        }
      } catch (wearError) {
        console.error('Failed to apply equipment wear after executing tour show', wearError);
      }

      toast.success(`Show completed! Sold ${ticketsSold} tickets for $${revenue.toLocaleString()}`);
      loadTourData();

    } catch (error: unknown) {
      const fallbackMessage = 'Failed to execute show';
      const errorMessage = error instanceof Error ? error.message : fallbackMessage;
      console.error('Error executing show:', errorMessage, error);
      toast.error(errorMessage);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600';
      case 'active': return 'text-blue-600';
      case 'cancelled': return 'text-red-600';
      default: return 'text-yellow-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'cancelled': return <XCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const calculateTourStats = (tour: Tour) => {
    const totalRevenue = tour.venues.reduce((sum, venue) => sum + venue.revenue, 0);
    const totalTicketsSold = tour.venues.reduce((sum, venue) => sum + venue.tickets_sold, 0);
    const totalCapacity = tour.venues.reduce((sum, venue) => sum + venue.venue_capacity, 0);
    const averageAttendance = totalCapacity > 0 ? (totalTicketsSold / totalCapacity) * 100 : 0;
    
    return {
      totalRevenue,
      totalTicketsSold,
      totalCapacity,
      averageAttendance,
      completedShows: tour.venues.filter(v => v.status === 'completed').length,
      totalShows: tour.venues.length
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Touring System</h1>
          <p className="text-muted-foreground">Plan and execute multi-city tours</p>
        </div>
        <Button onClick={() => setShowCreateTour(true)}>
          <Route className="w-4 h-4 mr-2" />
          Create Tour
        </Button>
      </div>

      {showCreateTour && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Tour</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Tour Name</label>
                <Input
                  value={newTour.name}
                  onChange={(e) => setNewTour(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="World Domination Tour 2024"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={newTour.description}
                  onChange={(e) => setNewTour(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="An epic journey across the globe..."
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold">Select Venues</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {availableVenues.map((venue) => (
                  <Card 
                    key={venue.id}
                    className={`cursor-pointer transition-colors ${
                      selectedVenues.includes(venue.id) ? 'border-primary bg-primary/10' : ''
                    }`}
                    onClick={() => {
                      setSelectedVenues(prev => 
                        prev.includes(venue.id) 
                          ? prev.filter(id => id !== venue.id)
                          : [...prev, venue.id]
                      );
                    }}
                  >
                    <CardContent className="p-3">
                      <div className="font-medium">{venue.name}</div>
                      <div className="text-sm text-muted-foreground">{venue.location}</div>
                      <div className="text-sm">Capacity: {venue.capacity}</div>
                      <Badge variant="outline" className="mt-1">
                        Prestige: {venue.prestige_level}/5
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold">Tour Logistics</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(logistics).map(([key, value]) => (
                  <div key={key}>
                    <label className="text-sm font-medium capitalize">
                      {key.replace('_', ' ')}
                    </label>
                    <Input
                      type="number"
                      value={value}
                      onChange={(e) => setLogistics(prev => ({
                        ...prev,
                        [key]: parseInt(e.target.value) || 0
                      }))}
                    />
                  </div>
                ))}
              </div>
              <div className="text-right">
                <div className="text-lg font-bold">
                  Total Cost: ${Object.values(logistics).reduce((sum, cost) => sum + cost, 0).toLocaleString()}
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <Button onClick={createTour} className="flex-1">
                Create Tour
              </Button>
              <Button 
                onClick={() => setShowCreateTour(false)} 
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-6">
        {tours.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Route className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Tours Yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first tour to start performing across multiple venues
              </p>
              <Button onClick={() => setShowCreateTour(true)}>
                Create Your First Tour
              </Button>
            </CardContent>
          </Card>
        ) : (
          tours.map((tour) => {
            const stats = calculateTourStats(tour);
            return (
              <Card key={tour.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Music className="w-6 h-6" />
                        {tour.name}
                      </CardTitle>
                      <p className="text-muted-foreground">{tour.description}</p>
                    </div>
                    <Badge className={getStatusColor(tour.status)}>
                      {getStatusIcon(tour.status)}
                      <span className="ml-1 capitalize">{tour.status}</span>
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-500">
                        ${stats.totalRevenue.toLocaleString()}
                      </div>
                      <div className="text-sm text-muted-foreground">Total Revenue</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-500">
                        {stats.totalTicketsSold.toLocaleString()}
                      </div>
                      <div className="text-sm text-muted-foreground">Tickets Sold</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-500">
                        {stats.averageAttendance.toFixed(1)}%
                      </div>
                      <div className="text-sm text-muted-foreground">Avg Attendance</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-500">
                        {stats.completedShows}/{stats.totalShows}
                      </div>
                      <div className="text-sm text-muted-foreground">Shows</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-500">
                        {tour.venues.length}
                      </div>
                      <div className="text-sm text-muted-foreground">Cities</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3">Tour Schedule</h4>
                    <div className="space-y-3">
                      {tour.venues.map((venue, index) => (
                        <div key={venue.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-4">
                            <div className="text-center min-w-[60px]">
                              <div className="font-bold">{format(new Date(venue.date), 'MMM')}</div>
                              <div className="text-lg">{format(new Date(venue.date), 'dd')}</div>
                            </div>
                            <div>
                              <div className="font-medium">{venue.venue_name}</div>
                              <div className="text-sm text-muted-foreground flex items-center gap-2">
                                <MapPin className="w-4 h-4" />
                                {venue.city}
                                {index > 0 && (
                                  <>
                                    <Truck className="w-4 h-4" />
                                    {venue.distance_from_previous} km
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">
                              {venue.tickets_sold}/{venue.venue_capacity}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              ${venue.ticket_price} per ticket
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={venue.status === 'completed' ? 'default' : 'secondary'}>
                              {venue.status}
                            </Badge>
                            {venue.status === 'scheduled' && tour.status === 'active' && (
                              <Button 
                                size="sm"
                                onClick={() => executeTourShow(tour.id, index)}
                              >
                                Perform
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};

export default TouringSystem;