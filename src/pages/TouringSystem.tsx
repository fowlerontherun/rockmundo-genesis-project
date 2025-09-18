import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth-context';
import { useGameData } from '@/hooks/useGameData';
import { applyAttributeToValue } from '@/utils/attributeProgression';
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
  show_type: ShowType;
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

type ShowType = Database['public']['Enums']['show_type'];
const DEFAULT_SHOW_TYPE: ShowType = 'standard';

const SHOW_TYPE_OPTIONS: Array<{ value: ShowType; label: string; description: string }> = [
  { value: 'standard', label: 'Standard', description: 'Full production show with amplified sound' },
  { value: 'acoustic', label: 'Acoustic', description: 'Intimate unplugged arrangement' },
];

const getShowTypeLabel = (showType: ShowType) =>
  SHOW_TYPE_OPTIONS.find(option => option.value === showType)?.label ?? 'Standard';

const getShowTypeBadgeClass = (showType: ShowType) =>
  showType === 'acoustic'
    ? 'bg-amber-500/10 text-amber-500 border-amber-500/40'
    : 'bg-blue-500/10 text-blue-500 border-blue-500/40';

const TOUR_SHOW_BEHAVIOR: Record<ShowType, {
  attendance: number;
  revenue: number;
  fame: number;
  experience: number;
  ticket: number;
}> = {
  standard: { attendance: 1, revenue: 1, fame: 1, experience: 1, ticket: 1 },
  acoustic: { attendance: 0.75, revenue: 0.85, fame: 1.35, experience: 1.2, ticket: 0.9 },
};

const TOUR_EXPERIENCE_ATTRIBUTES: AttributeKey[] = ['stage_presence', 'musical_ability'];

type TourRecord = TourRow & {
  tour_venues: (TourVenueRow & { venue: VenueRow | null })[] | null;
};

const TouringSystem: React.FC = () => {
  const { user } = useAuth();
  const { profile, attributes, updateProfile, addActivity, awardActionXp } = useGameData();
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
  const [newTourShowTypes, setNewTourShowTypes] = useState<Record<string, ShowType>>({});
  const [logistics, setLogistics] = useState<TourLogistics>({
    transport_cost: 5000,
    accommodation_cost: 3000,
    crew_cost: 8000,
    equipment_cost: 2000,
    marketing_cost: 4000,
    insurance_cost: 1500,
    misc_cost: 1000
  });

  const loadTourData = useCallback(async () => {
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
            distance_from_previous: Math.floor(Math.random() * 500) + 100,
            show_type: (tv.show_type ?? DEFAULT_SHOW_TYPE) as ShowType
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
  }, [user]);

  useEffect(() => {
    if (user) {
      loadTourData();
    }
  }, [user, loadTourData]);

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
        const showType = newTourShowTypes[venueId] ?? DEFAULT_SHOW_TYPE;
        const behavior = TOUR_SHOW_BEHAVIOR[showType] ?? TOUR_SHOW_BEHAVIOR[DEFAULT_SHOW_TYPE];
        const ticketPrice = Math.max(40, Math.floor((basePayment / 10) * behavior.ticket));

        return {
          tour_id: tourData.id,
          venue_id: venueId,
          date: showDate.toISOString(),
          ticket_price: ticketPrice,
          status: 'scheduled',
          show_type: showType
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
      setNewTourShowTypes({});
      loadTourData();

    } catch (error: unknown) {
      const fallbackMessage = 'Failed to create tour';
      const errorMessage = error instanceof Error ? error.message : fallbackMessage;
      console.error('Error creating tour:', errorMessage, error);
      toast.error(errorMessage);
    }
  };

  const updateTourShowType = async (tourVenueId: string, showType: ShowType) => {
    try {
      const { error } = await supabase
        .from('tour_venues')
        .update({ show_type: showType })
        .eq('id', tourVenueId);

      if (error) throw error;

      setTours(prev => prev.map(tour => ({
        ...tour,
        venues: tour.venues.map(venue =>
          venue.id === tourVenueId
            ? { ...venue, show_type: showType }
            : venue
        )
      })));

      toast.success('Show type updated');
    } catch (error: unknown) {
      const fallbackMessage = 'Failed to update show type';
      const errorMessage = error instanceof Error ? error.message : fallbackMessage;
      console.error('Error updating show type:', errorMessage, error);
      toast.error(errorMessage);
    }
  };

  const executeTourShow = async (tourId: string, venueIndex: number) => {
    if (!user || !profile) return;

    const tour = tours.find(t => t.id === tourId);
    if (!tour || !tour.venues[venueIndex]) return;

    const venue = tour.venues[venueIndex];
    const showType = venue.show_type ?? DEFAULT_SHOW_TYPE;
    const behavior = TOUR_SHOW_BEHAVIOR[showType] ?? TOUR_SHOW_BEHAVIOR[DEFAULT_SHOW_TYPE];
    
    try {
      // Simulate show performance
      const performanceScore = showType === 'acoustic'
        ? Math.random() * 0.35 + 0.55
        : Math.random() * 0.4 + 0.6;
      const ticketsSold = Math.floor(venue.venue_capacity * performanceScore * behavior.attendance);
      const revenue = Math.floor(ticketsSold * venue.ticket_price * behavior.revenue);
      const expenses = Math.floor(revenue * (showType === 'acoustic' ? 0.25 : 0.3));

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
      const fameGain = Math.max(1, Math.floor((ticketsSold / 100) * behavior.fame));
      const baseExperienceGain = Math.max(10, Math.floor(performanceScore * 100 * behavior.experience));
      const experienceResult = applyAttributeToValue(baseExperienceGain, attributes, TOUR_EXPERIENCE_ATTRIBUTES);
      const experienceGain = experienceResult.value;

      if (experienceGain > 0) {
        await awardActionXp({
          amount: experienceGain,
          category: "performance",
          actionKey: "tour_show",
          uniqueEventId: `${tour.id}:${venue.id}`,
          metadata: {
            tour_id: tour.id,
            tour_venue_id: venue.id,
            show_type: showType,
            tickets_sold: ticketsSold,
            net_earnings: netEarnings,
            fame_gained: fameGain,
            performance_score: performanceScore,
          },
        });
      }

      await updateProfile({
        cash: profile.cash + netEarnings,
        fame: profile.fame + fameGain,
      });

      await addActivity(
        'tour_show',
        `Performed a ${getShowTypeLabel(showType).toLowerCase()} set at ${venue.venue_name} - ${ticketsSold} tickets sold`,
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

      toast.success(`Show completed! ${getShowTypeLabel(showType)} night sold ${ticketsSold} tickets for $${revenue.toLocaleString()}`);
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
                {availableVenues.map((venue) => {
                  const isSelected = selectedVenues.includes(venue.id);
                  const showType = newTourShowTypes[venue.id] ?? DEFAULT_SHOW_TYPE;
                  const optionDetails = SHOW_TYPE_OPTIONS.find(option => option.value === showType);

                  return (
                    <Card
                      key={venue.id}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'border-primary bg-primary/10' : ''
                      }`}
                      onClick={() => {
                        setSelectedVenues(prev => {
                          if (prev.includes(venue.id)) {
                            setNewTourShowTypes(current => {
                              const next = { ...current };
                              delete next[venue.id];
                              return next;
                            });
                            return prev.filter(id => id !== venue.id);
                          }
                          setNewTourShowTypes(current => ({
                            ...current,
                            [venue.id]: current[venue.id] ?? DEFAULT_SHOW_TYPE,
                          }));
                          return [...prev, venue.id];
                        });
                      }}
                    >
                      <CardContent className="p-3 space-y-2">
                        <div className="font-medium">{venue.name}</div>
                        <div className="text-sm text-muted-foreground">{venue.location}</div>
                        <div className="text-sm">Capacity: {venue.capacity}</div>
                        <Badge variant="outline" className="mt-1">
                          Prestige: {venue.prestige_level}/5
                        </Badge>

                        {isSelected && (
                          <div className="space-y-1 pt-2" onClick={(event) => event.stopPropagation()}>
                            <Select
                              value={showType}
                              onValueChange={(value) =>
                                setNewTourShowTypes(prev => ({
                                  ...prev,
                                  [venue.id]: value as ShowType,
                                }))
                              }
                            >
                              <SelectTrigger className="w-full text-sm">
                                <SelectValue placeholder="Select show type" />
                              </SelectTrigger>
                              <SelectContent>
                                {SHOW_TYPE_OPTIONS.map(option => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {optionDetails && (
                              <p className="text-xs text-muted-foreground">{optionDetails.description}</p>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
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
                      {tour.venues.map((venue, index) => {
                        const showType = venue.show_type ?? DEFAULT_SHOW_TYPE;
                        const showTypeLabel = getShowTypeLabel(showType);
                        const optionDetails = SHOW_TYPE_OPTIONS.find(option => option.value === showType);

                        return (
                          <div key={venue.id} className="flex flex-col gap-3 p-3 border rounded-lg md:flex-row md:items-center md:justify-between">
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
                            <div className="flex flex-col items-end gap-1 min-w-[160px]">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className={getShowTypeBadgeClass(showType)}>
                                  {showTypeLabel}
                                </Badge>
                                {venue.status === 'scheduled' && (
                                  <Select
                                    value={showType}
                                    onValueChange={(value) => updateTourShowType(venue.id, value as ShowType)}
                                  >
                                    <SelectTrigger className="w-[140px] text-xs">
                                      <SelectValue placeholder="Show type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {SHOW_TYPE_OPTIONS.map(option => (
                                        <SelectItem key={option.value} value={option.value}>
                                          {option.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              </div>
                              {optionDetails && (
                                <span className="text-xs text-muted-foreground text-right">
                                  {optionDetails.description}
                                </span>
                              )}
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
                        );
                      })}
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