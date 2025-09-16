import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Calendar, 
  Users, 
  MapPin, 
  Star, 
  TrendingUp, 
  DollarSign,
  AlertCircle,
  Plane,
  Music,
  Clock,
  Plus,
  Settings
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useGameData } from "@/hooks/useGameData";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { calculateGigPayment, meetsRequirements } from "@/utils/gameBalance";
import { applyEquipmentWear } from "@/utils/equipmentWear";

interface Tour {
  id: string;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  status: string;
  total_revenue: number;
  band_id?: string;
  venues: TourVenue[];
  tour_venues?: TourVenue[];
}

interface TourVenue {
  id: string;
  venue_id: string;
  date: string;
  ticket_price: number | null;
  tickets_sold: number | null;
  revenue: number | null;
  status: string | null;
  venues?: {
    name: string;
    location: string;
    capacity: number;
  };
  venue?: {
    name: string;
    location: string;
    capacity: number;
  };
}

interface EditTourForm {
  start_date: string;
  end_date: string;
  status: string;
  venues: Array<{
    id: string;
    venue_id: string;
    date: string;
    status: string | null;
    ticket_price: number | null;
  }>;
  newVenue: {
    venue_id: string;
    date: string;
    ticket_price: string;
  };
}

const TourManager = () => {
  const { user } = useAuth();
  const { profile, skills } = useGameData();
  const { toast } = useToast();
  const [tours, setTours] = useState<Tour[]>([]);
  const [venues, setVenues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingTour, setCreatingTour] = useState(false);
  const [editingTourId, setEditingTourId] = useState<string | null>(null);
  const [editForms, setEditForms] = useState<Record<string, EditTourForm>>({});
  const [newTour, setNewTour] = useState({
    name: "",
    description: "",
    start_date: "",
    end_date: ""
  });

  const normalizeDate = (date?: string | null) => (date ? date.split("T")[0] : "");

  const initializeEditForm = (tour: Tour): EditTourForm => ({
    start_date: normalizeDate(tour.start_date),
    end_date: normalizeDate(tour.end_date),
    status: tour.status || "planned",
    venues: (tour.venues || []).map((venue) => ({
      id: venue.id,
      venue_id: venue.venue_id,
      date: normalizeDate(venue.date),
      status: venue.status || "scheduled",
      ticket_price: venue.ticket_price
    })),
    newVenue: {
      venue_id: "",
      date: "",
      ticket_price: ""
    }
  });

  const tourStatusOptions = ['planned', 'active', 'completed', 'cancelled'];
  const venueStatusOptions = ['scheduled', 'completed', 'cancelled'];

  useEffect(() => {
    if (user) {
      loadTours();
      loadVenues();
    }
  }, [user]);

  const loadTours = async (): Promise<Tour[]> => {
    if (!user) return [];

    try {
      const { data, error } = await supabase
        .from('tours')
        .select(`
          *,
          tour_venues!tour_venues_tour_id_fkey (
            *,
            venues!tour_venues_venue_id_fkey (name, location, capacity)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const mappedTours = (data || []).map(tour => ({
        ...tour,
        venues: (tour.tour_venues || []).map(tv => ({
          ...tv,
          venue: tv.venues
        }))
      }));
      setTours(mappedTours);
      return mappedTours;
    } catch (error: any) {
      console.error('Error loading tours:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load tours"
      });
      return [];
    }
  };

  const loadVenues = async () => {
    try {
      const { data, error } = await supabase
        .from('venues')
        .select('*')
        .order('prestige_level', { ascending: true });

      if (error) throw error;
      setVenues(data || []);
    } catch (error: any) {
      console.error('Error loading venues:', error);
    } finally {
      setLoading(false);
    }
  };

  const createTour = async () => {
    if (!user || !profile || !skills) return;

    try {
      setCreatingTour(true);

      // Check if player meets tour requirements
      const tourRequirements = { fame: 1000, performance: 50 };
      const { meets, missing } = meetsRequirements(tourRequirements, {
        fame: profile.fame,
        performance: skills.performance
      });

      if (!meets) {
        toast({
          variant: "destructive",
          title: "Requirements Not Met",
          description: `You need: ${missing.join(', ')}`
        });
        return;
      }

      const { data, error } = await supabase
        .from('tours')
        .insert({
          user_id: user.id,
          name: newTour.name,
          description: newTour.description,
          start_date: newTour.start_date,
          end_date: newTour.end_date,
          status: 'planned'
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Tour Created!",
        description: `${newTour.name} has been added to your tour schedule`
      });

      setNewTour({ name: "", description: "", start_date: "", end_date: "" });
      await loadTours();
    } catch (error: any) {
      console.error('Error creating tour:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create tour"
      });
    } finally {
      setCreatingTour(false);
    }
  };

  const addVenueToTour = async (tourId: string, venueId: string, date: string, ticketPrice: number) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('tour_venues')
        .insert({
          tour_id: tourId,
          venue_id: venueId,
          date,
          ticket_price: ticketPrice,
          tickets_sold: 0,
          revenue: 0,
          status: 'scheduled'
        });

      if (error) throw error;

      toast({
        title: "Venue Added",
        description: "Venue has been added to your tour"
      });

      const updatedTours = await loadTours();
      const updatedTour = updatedTours.find((t) => t.id === tourId);
      if (updatedTour) {
        setEditForms((prev) => ({
          ...prev,
          [tourId]: initializeEditForm(updatedTour)
        }));
      }
    } catch (error: any) {
      console.error('Error adding venue to tour:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add venue to tour"
      });
    }
  };

  const handleManageClick = (tour: Tour) => {
    if (editingTourId === tour.id) {
      setEditingTourId(null);
      setEditForms((prev) => {
        const { [tour.id]: _removed, ...rest } = prev;
        return rest;
      });
      return;
    }

    setEditForms((prev) => ({
      ...prev,
      [tour.id]: initializeEditForm(tour)
    }));
    setEditingTourId(tour.id);
  };

  const handleCancelEditing = (tourId: string) => {
    setEditingTourId(null);
    setEditForms((prev) => {
      const { [tourId]: _removed, ...rest } = prev;
      return rest;
    });
  };

  const handleAddVenue = async (tourId: string) => {
    const form = editForms[tourId];
    if (!form) return;

    const { venue_id, date, ticket_price } = form.newVenue;
    const parsedPrice = parseFloat(ticket_price);

    if (!venue_id || !date || Number.isNaN(parsedPrice)) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please select a venue, date, and ticket price"
      });
      return;
    }

    await addVenueToTour(tourId, venue_id, date, parsedPrice);
    setEditForms((prev) => ({
      ...prev,
      [tourId]: {
        ...prev[tourId],
        newVenue: {
          venue_id: "",
          date: "",
          ticket_price: ""
        }
      }
    }));
  };

  const editTour = async (tourId: string) => {
    if (!user) return;
    const form = editForms[tourId];
    if (!form) return;

    try {
      const { error: tourError } = await supabase
        .from('tours')
        .update({
          start_date: form.start_date,
          end_date: form.end_date,
          status: form.status
        })
        .eq('id', tourId)
        .eq('user_id', user.id);

      if (tourError) throw tourError;

      if (form.venues.length > 0) {
        const venueResponses = await Promise.all(
          form.venues.map((venue) =>
            supabase
              .from('tour_venues')
              .update({
                venue_id: venue.venue_id,
                date: venue.date,
                status: venue.status,
                ticket_price: venue.ticket_price
              })
              .eq('id', venue.id)
          )
        );

        const venueError = venueResponses.find((response) => response.error)?.error;
        if (venueError) throw venueError;
      }

      toast({
        title: "Tour Updated",
        description: "Tour details have been updated"
      });

      await loadTours();
      handleCancelEditing(tourId);
    } catch (error: any) {
      console.error('Error updating tour:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update tour"
      });
    }
  };

  const cancelTour = async (tourId: string) => {
    if (!user) return;

    try {
      const { error: venueError } = await supabase
        .from('tour_venues')
        .delete()
        .eq('tour_id', tourId);

      if (venueError) throw venueError;

      const { error: tourError } = await supabase
        .from('tours')
        .delete()
        .eq('id', tourId)
        .eq('user_id', user.id);

      if (tourError) throw tourError;

      toast({
        title: "Tour Cancelled",
        description: "The tour has been removed from your schedule"
      });

      await loadTours();
      handleCancelEditing(tourId);
    } catch (error: any) {
      console.error('Error cancelling tour:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to cancel tour"
      });
    }
  };

  const simulateTourShow = async (tourVenueId: string, venue: any) => {
    if (!user || !profile || !skills) return;

    try {
      // Calculate show success based on skills and venue prestige
      const successRate = Math.min(0.9, skills.performance / 100);
      const attendance = Math.floor(venue.capacity * (0.4 + successRate * 0.5));
      const revenue = attendance * 25; // Assume $25 ticket price

      const { error } = await supabase
        .from('tour_venues')
        .update({
          tickets_sold: attendance,
          revenue: revenue,
          status: 'completed'
        })
        .eq('id', tourVenueId);

      if (error) throw error;

      // Update player cash and fame
      const fameGain = Math.floor(attendance / 10);
      await supabase
        .from('profiles')
        .update({
          cash: profile.cash + revenue,
          fame: profile.fame + fameGain
        })
        .eq('user_id', user.id);

      let wearNotice = '';

      try {
        const wearSummary = await applyEquipmentWear(user.id, 'tour');
        if (wearSummary?.updates.length) {
          wearNotice = ` Gear wear detected on ${wearSummary.updates.length} item${wearSummary.updates.length > 1 ? 's' : ''}. Check the inventory manager to repair them.`;
        }
      } catch (wearError) {
        console.error('Failed to apply equipment wear after tour show', wearError);
      }

      toast({
        title: "Show Complete!",
        description: `Great performance! Earned $${revenue} and ${fameGain} fame.${wearNotice}`
      });

      await loadTours();
    } catch (error: any) {
      console.error('Error simulating tour show:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to complete show"
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-success border-success bg-success/10';
      case 'active': return 'text-warning border-warning bg-warning/10';
      case 'cancelled': return 'text-destructive border-destructive bg-destructive/10';
      default: return 'text-primary border-primary bg-primary/10';
    }
  };

  const calculateTourStats = (tour: Tour) => {
    const totalRevenue = tour.venues?.reduce((sum, v) => sum + (v.revenue || 0), 0) || 0;
    const totalTickets = tour.venues?.reduce((sum, v) => sum + (v.tickets_sold || 0), 0) || 0;
    const completedShows = tour.venues?.filter(v => v.status === 'completed').length || 0;
    const totalShows = tour.venues?.length || 0;

    return { totalRevenue, totalTickets, completedShows, totalShows };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-stage flex items-center justify-center p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg font-oswald">Loading tour management...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-stage p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bebas tracking-wider bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
              Tour Manager
            </h1>
            <p className="text-muted-foreground font-oswald">Plan and manage your concert tours</p>
          </div>
          <Button 
            onClick={() => setCreatingTour(true)}
            className="bg-gradient-primary hover:shadow-electric"
            disabled={!profile || profile.fame < 1000}
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Tour
          </Button>
        </div>

        {/* Requirements Check */}
        {profile && profile.fame < 1000 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You need at least 1,000 fame and 50 performance skill to create tours. 
              Current fame: {profile.fame}
            </AlertDescription>
          </Alert>
        )}

        {/* Create Tour Form */}
        {creatingTour && (
          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader>
              <CardTitle>Create New Tour</CardTitle>
              <CardDescription>Plan your multi-city tour</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tour-name">Tour Name</Label>
                  <Input
                    id="tour-name"
                    value={newTour.name}
                    onChange={(e) => setNewTour({ ...newTour, name: e.target.value })}
                    placeholder="World Domination Tour"
                  />
                </div>
                <div>
                  <Label htmlFor="tour-description">Description</Label>
                  <Input
                    id="tour-description"
                    value={newTour.description}
                    onChange={(e) => setNewTour({ ...newTour, description: e.target.value })}
                    placeholder="Epic tour across multiple cities"
                  />
                </div>
                <div>
                  <Label htmlFor="start-date">Start Date</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={newTour.start_date}
                    onChange={(e) => setNewTour({ ...newTour, start_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="end-date">End Date</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={newTour.end_date}
                    onChange={(e) => setNewTour({ ...newTour, end_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={createTour}
                  disabled={!newTour.name || !newTour.start_date || !newTour.end_date}
                >
                  Create Tour
                </Button>
                <Button variant="outline" onClick={() => setCreatingTour(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tours List */}
        <div className="space-y-4">
          {tours.length > 0 ? tours.map((tour) => {
            const stats = calculateTourStats(tour);
            const editForm = editForms[tour.id];
            return (
              <Card key={tour.id} className="bg-card/80 backdrop-blur-sm border-primary/20">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Plane className="h-5 w-5 text-primary" />
                        {tour.name}
                      </CardTitle>
                      <CardDescription>{tour.description}</CardDescription>
                    </div>
                    <Badge variant="outline" className={getStatusColor(tour.status || 'planned')}>
                      {tour.status || 'planned'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Tour Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-success">${stats.totalRevenue.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Total Revenue</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-primary">{stats.totalTickets.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Tickets Sold</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-warning">{stats.completedShows}</p>
                      <p className="text-xs text-muted-foreground">Shows Done</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-accent">{stats.totalShows}</p>
                      <p className="text-xs text-muted-foreground">Total Shows</p>
                    </div>
                  </div>

                  {editingTourId === tour.id && editForm && (
                    <div className="rounded-lg border border-border/40 bg-secondary/20 p-4 space-y-4">
                      <div className="grid gap-3 md:grid-cols-3">
                        <div>
                          <Label className="text-xs uppercase text-muted-foreground">Start Date</Label>
                          <Input
                            type="date"
                            value={editForm.start_date}
                            onChange={(e) =>
                              setEditForms((prev) => ({
                                ...prev,
                                [tour.id]: {
                                  ...prev[tour.id],
                                  start_date: e.target.value
                                }
                              }))
                            }
                          />
                        </div>
                        <div>
                          <Label className="text-xs uppercase text-muted-foreground">End Date</Label>
                          <Input
                            type="date"
                            value={editForm.end_date}
                            onChange={(e) =>
                              setEditForms((prev) => ({
                                ...prev,
                                [tour.id]: {
                                  ...prev[tour.id],
                                  end_date: e.target.value
                                }
                              }))
                            }
                          />
                        </div>
                        <div>
                          <Label className="text-xs uppercase text-muted-foreground">Status</Label>
                          <select
                            className="mt-1 w-full rounded-md border border-border bg-background/80 px-3 py-2 text-sm capitalize focus:outline-none focus:ring-2 focus:ring-primary"
                            value={editForm.status}
                            onChange={(e) =>
                              setEditForms((prev) => ({
                                ...prev,
                                [tour.id]: {
                                  ...prev[tour.id],
                                  status: e.target.value
                                }
                              }))
                            }
                          >
                            {tourStatusOptions.map((status) => (
                              <option key={status} value={status}>
                                {status.charAt(0).toUpperCase() + status.slice(1)}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h5 className="font-semibold text-sm">Add New Tour Stop</h5>
                        <div className="grid gap-3 md:grid-cols-3">
                          <div>
                            <Label className="text-xs uppercase text-muted-foreground">Venue</Label>
                            <select
                              className="mt-1 w-full rounded-md border border-border bg-background/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                              value={editForm.newVenue.venue_id}
                              onChange={(e) =>
                                setEditForms((prev) => ({
                                  ...prev,
                                  [tour.id]: {
                                    ...prev[tour.id],
                                    newVenue: {
                                      ...prev[tour.id].newVenue,
                                      venue_id: e.target.value
                                    }
                                  }
                                }))
                              }
                            >
                              <option value="">Select venue</option>
                              {venues.map((venueOption) => (
                                <option key={venueOption.id} value={venueOption.id}>
                                  {venueOption.name} • {venueOption.location}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <Label className="text-xs uppercase text-muted-foreground">Date</Label>
                            <Input
                              type="date"
                              value={editForm.newVenue.date}
                              onChange={(e) =>
                                setEditForms((prev) => ({
                                  ...prev,
                                  [tour.id]: {
                                    ...prev[tour.id],
                                    newVenue: {
                                      ...prev[tour.id].newVenue,
                                      date: e.target.value
                                    }
                                  }
                                }))
                              }
                            />
                          </div>
                          <div>
                            <Label className="text-xs uppercase text-muted-foreground">Ticket Price</Label>
                            <Input
                              type="number"
                              min="0"
                              value={editForm.newVenue.ticket_price}
                              onChange={(e) =>
                                setEditForms((prev) => ({
                                  ...prev,
                                  [tour.id]: {
                                    ...prev[tour.id],
                                    newVenue: {
                                      ...prev[tour.id].newVenue,
                                      ticket_price: e.target.value
                                    }
                                  }
                                }))
                              }
                            />
                          </div>
                        </div>
                        <Button size="sm" onClick={() => handleAddVenue(tour.id)}>
                          Add Venue
                        </Button>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button onClick={() => editTour(tour.id)}>
                          Save Changes
                        </Button>
                        <Button variant="outline" onClick={() => handleCancelEditing(tour.id)}>
                          Cancel
                        </Button>
                        <Button variant="destructive" onClick={() => cancelTour(tour.id)}>
                          Cancel Tour
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Tour Dates */}
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Tour Dates ({tour.venues?.length || 0})
                    </h4>
                    <div
                      className={`space-y-2 ${editingTourId === tour.id ? 'overflow-visible' : 'max-h-40 overflow-y-auto'}`}
                    >
                      {tour.venues && tour.venues.length > 0 ? (
                        tour.venues.map((venue) => {
                          if (editingTourId === tour.id && editForm) {
                            const editableVenue = editForm.venues.find((v) => v.id === venue.id);
                            if (!editableVenue) {
                              return (
                                <div key={venue.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                                  <div className="flex-1">
                                    <p className="font-medium">{venue.venue.name}</p>
                                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                                      <MapPin className="h-3 w-3" />
                                      {venue.venue.location} • {new Date(venue.date).toLocaleDateString()}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {venue.tickets_sold}/{venue.venue.capacity} tickets • ${venue.ticket_price} each
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className={getStatusColor(venue.status || 'scheduled')}>
                                      {venue.status || 'scheduled'}
                                    </Badge>
                                  </div>
                                </div>
                              );
                            }

                            const selectedVenueInfo =
                              venues.find((option) => option.id === editableVenue.venue_id) || venue.venue;

                            return (
                              <div key={venue.id} className="space-y-3 rounded-lg bg-secondary/30 p-3">
                                <div className="grid gap-3 md:grid-cols-2">
                                  <div>
                                    <Label className="text-xs uppercase text-muted-foreground">Venue</Label>
                                    <select
                                      className="mt-1 w-full rounded-md border border-border bg-background/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                      value={editableVenue.venue_id}
                                      onChange={(e) =>
                                        setEditForms((prev) => ({
                                          ...prev,
                                          [tour.id]: {
                                            ...prev[tour.id],
                                            venues: prev[tour.id].venues.map((v) =>
                                              v.id === venue.id ? { ...v, venue_id: e.target.value } : v
                                            )
                                          }
                                        }))
                                      }
                                    >
                                      <option value="">Select venue</option>
                                      {venues.map((venueOption) => (
                                        <option key={venueOption.id} value={venueOption.id}>
                                          {venueOption.name} • {venueOption.location}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <Label className="text-xs uppercase text-muted-foreground">Date</Label>
                                    <Input
                                      type="date"
                                      value={editableVenue.date}
                                      onChange={(e) =>
                                        setEditForms((prev) => ({
                                          ...prev,
                                          [tour.id]: {
                                            ...prev[tour.id],
                                            venues: prev[tour.id].venues.map((v) =>
                                              v.id === venue.id ? { ...v, date: e.target.value } : v
                                            )
                                          }
                                        }))
                                      }
                                    />
                                  </div>
                                </div>
                                <div className="grid gap-3 md:grid-cols-2">
                                  <div>
                                    <Label className="text-xs uppercase text-muted-foreground">Ticket Price</Label>
                                    <Input
                                      type="number"
                                      min="0"
                                      value={editableVenue.ticket_price !== null ? editableVenue.ticket_price.toString() : ""}
                                      onChange={(e) =>
                                        setEditForms((prev) => {
                                          const rawValue = e.target.value;
                                          const parsedValue = rawValue === "" ? null : parseFloat(rawValue);
                                          const safeValue =
                                            parsedValue !== null && !Number.isNaN(parsedValue)
                                              ? parsedValue
                                              : null;
                                          return {
                                            ...prev,
                                            [tour.id]: {
                                              ...prev[tour.id],
                                              venues: prev[tour.id].venues.map((v) =>
                                                v.id === venue.id
                                                  ? {
                                                      ...v,
                                                      ticket_price: safeValue
                                                    }
                                                  : v
                                              )
                                            }
                                          };
                                        })
                                      }
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs uppercase text-muted-foreground">Status</Label>
                                    <select
                                      className="mt-1 w-full rounded-md border border-border bg-background/80 px-3 py-2 text-sm capitalize focus:outline-none focus:ring-2 focus:ring-primary"
                                      value={editableVenue.status || 'scheduled'}
                                      onChange={(e) =>
                                        setEditForms((prev) => ({
                                          ...prev,
                                          [tour.id]: {
                                            ...prev[tour.id],
                                            venues: prev[tour.id].venues.map((v) =>
                                              v.id === venue.id ? { ...v, status: e.target.value } : v
                                            )
                                          }
                                        }))
                                      }
                                    >
                                      {venueStatusOptions.map((status) => (
                                        <option key={status} value={status}>
                                          {status.charAt(0).toUpperCase() + status.slice(1)}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                                <div className="text-xs text-muted-foreground flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {selectedVenueInfo?.location} • Capacity {selectedVenueInfo?.capacity}
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div key={venue.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                              <div className="flex-1">
                                <p className="font-medium">{venue.venue.name}</p>
                                <p className="text-sm text-muted-foreground flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {venue.venue.location} • {new Date(venue.date).toLocaleDateString()}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {venue.tickets_sold}/{venue.venue.capacity} tickets • ${venue.ticket_price} each
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className={getStatusColor(venue.status || 'scheduled')}>
                                  {venue.status || 'scheduled'}
                                </Badge>
                                {venue.status === 'scheduled' && (
                                  <Button
                                    size="sm"
                                    onClick={() => simulateTourShow(venue.id, venue.venue)}
                                  >
                                    Perform
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-center text-muted-foreground py-4">
                          No venues added to this tour yet
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Quick Stats */}
                  <div className="flex items-center justify-between pt-2 border-t border-border/50">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{new Date(tour.start_date).toLocaleDateString()} - {new Date(tour.end_date).toLocaleDateString()}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleManageClick(tour)}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      {editingTourId === tour.id ? "Close" : "Manage"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          }) : (
            <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
              <CardContent className="text-center py-12">
                <Plane className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Tours Planned</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first tour to perform across multiple cities
                </p>
                <Button 
                  onClick={() => setCreatingTour(true)}
                  disabled={!profile || profile.fame < 1000}
                >
                  Plan Your First Tour
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default TourManager;