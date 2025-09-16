import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Users,
  Music,
  DollarSign,
  Star,
  Plus,
  CheckCircle,
  AlertCircle,
  XCircle,
  ExternalLink,
  Plane,
  Mic
} from "lucide-react";

interface ScheduleEvent {
  id: string;
  title: string;
  type: 'gig' | 'recording' | 'rehearsal' | 'meeting' | 'tour' | 'other';
  date: string;
  time: string;
  location: string;
  description: string;
  status: 'upcoming' | 'in_progress' | 'completed' | 'cancelled';
  payout?: number;
  capacity?: number;
  attendees?: number;
  bandMembers?: string[];
  linkPath?: string;
  linkLabel?: string;
  gigId?: string;
  tourId?: string;
  tourVenueId?: string;
}

interface ScheduleEventRow {
  id: string;
  title: string | null;
  event_type: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  description: string | null;
  status: string | null;
  gig_id: string | null;
  tour_venue_id: string | null;
  gig?: {
    id: string;
    scheduled_date: string | null;
    payment: number | null;
    status: string | null;
    attendance: number | null;
    venue?: {
      id: string;
      name: string | null;
      location: string | null;
      capacity: number | null;
    } | null;
  } | null;
  tour_stop?: {
    id: string;
    date: string | null;
    status: string | null;
    ticket_price: number | null;
    tickets_sold: number | null;
    revenue: number | null;
    tour?: {
      id: string;
      name: string | null;
    } | null;
    venue?: {
      id: string;
      name: string | null;
      location: string | null;
      capacity: number | null;
    } | null;
  } | null;
}

const Schedule = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('list');

  useEffect(() => {
    if (user) {
      void loadSchedule();
    } else {
      setEvents([]);
    }
  }, [user, loadSchedule]);

  const normalizeType = (type?: string | null): ScheduleEvent['type'] => {
    switch ((type || '').toLowerCase()) {
      case 'gig':
        return 'gig';
      case 'tour':
        return 'tour';
      case 'recording':
        return 'recording';
      case 'rehearsal':
        return 'rehearsal';
      case 'meeting':
        return 'meeting';
      default:
        return 'other';
    }
  };

  const normalizeStatus = (status?: string | null): ScheduleEvent['status'] => {
    switch ((status || '').toLowerCase()) {
      case 'in_progress':
      case 'in-progress':
      case 'active':
        return 'in_progress';
      case 'completed':
      case 'done':
        return 'completed';
      case 'cancelled':
      case 'canceled':
        return 'cancelled';
      default:
        return 'upcoming';
    }
  };

  const loadSchedule = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('schedule_events')
        .select(`
          id,
          title,
          event_type,
          start_time,
          end_time,
          location,
          description,
          status,
          gig_id,
          tour_venue_id,
          gig:gigs (
            id,
            scheduled_date,
            payment,
            status,
            attendance,
            venue:venues (
              id,
              name,
              location,
              capacity
            )
          ),
          tour_stop:tour_venues (
            id,
            date,
            status,
            ticket_price,
            tickets_sold,
            revenue,
            tour:tours (
              id,
              name
            ),
            venue:venues (
              id,
              name,
              location,
              capacity
            )
          )
        `)
        .eq('user_id', user.id);

      if (error) throw error;

      const rows: ScheduleEventRow[] = (data ?? []) as ScheduleEventRow[];
      const mappedEvents: ScheduleEvent[] = rows.map((event) => {
        const normalizedType = normalizeType(event.event_type);
        const startDateString = event.start_time || event.gig?.scheduled_date || event.tour_stop?.date;
        const eventDate = startDateString ? new Date(startDateString) : null;
        const isoDate = eventDate ? eventDate.toISOString() : new Date().toISOString();
        const timeDisplay = eventDate
          ? eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : 'All Day';

        const gigId = event.gig?.id ?? event.gig_id ?? undefined;
        const tourId = event.tour_stop?.tour?.id ?? undefined;
        const tourVenueId = event.tour_stop?.id ?? event.tour_venue_id ?? undefined;

        let linkPath: string | undefined;
        let linkLabel: string | undefined;

        if (normalizedType === 'gig') {
          if (gigId) {
            const params = new URLSearchParams({ gigId });
            linkPath = `/gigs?${params.toString()}`;
          } else {
            linkPath = '/gigs';
          }
          linkLabel = 'Open Gig';
        } else if (normalizedType === 'tour') {
          const params = new URLSearchParams();
          if (tourId) params.set('tourId', tourId);
          if (tourVenueId) params.set('stopId', tourVenueId);
          const query = params.toString();
          linkPath = `/tours${query ? `?${query}` : ''}`;
          linkLabel = 'Open Tour';
        }

        const location = event.location || event.gig?.venue?.location || event.tour_stop?.venue?.location || 'TBA';

        const title = event.title || (
          normalizedType === 'gig'
            ? `Gig at ${event.gig?.venue?.name ?? 'Venue'}`
            : normalizedType === 'tour'
              ? `${event.tour_stop?.tour?.name ?? 'Tour'} - ${event.tour_stop?.venue?.name ?? 'Venue'}`
              : 'Scheduled Event'
        );

        const description = event.description || (
          normalizedType === 'gig'
            ? `Live performance at ${event.gig?.venue?.name ?? 'the venue'}.`
            : normalizedType === 'tour'
              ? `Tour stop for ${event.tour_stop?.tour?.name ?? 'your tour'}.`
              : 'Scheduled event'
        );

        return {
          id: event.id,
          title,
          type: normalizedType,
          date: isoDate,
          time: timeDisplay,
          location,
          description,
          status: normalizeStatus(event.status || event.gig?.status || event.tour_stop?.status),
          payout: event.gig?.payment ?? event.tour_stop?.revenue ?? undefined,
          capacity: event.gig?.venue?.capacity ?? event.tour_stop?.venue?.capacity ?? undefined,
          attendees: event.gig?.attendance ?? event.tour_stop?.tickets_sold ?? undefined,
          bandMembers: [],
          linkPath,
          linkLabel,
          gigId,
          tourId,
          tourVenueId
        };
      });

      mappedEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setEvents(mappedEvents);
    } catch (error) {
      console.error('Error loading schedule:', error);
      toast({
        title: "Error",
        description: "Failed to load schedule",
        variant: "destructive"
      });
    }
  }, [toast, user]);

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'gig':
        return <Music className="h-4 w-4" />;
      case 'recording':
        return <Mic className="h-4 w-4" />;
      case 'rehearsal':
      case 'meeting':
        return <Users className="h-4 w-4" />;
      case 'tour':
        return <Plane className="h-4 w-4" />;
      default:
        return <CalendarIcon className="h-4 w-4" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-success" />;
      case 'in_progress': return <AlertCircle className="h-4 w-4 text-warning" />;
      case 'cancelled': return <XCircle className="h-4 w-4 text-destructive" />;
      default: return <Clock className="h-4 w-4 text-primary" />;
    }
  };

  const getStatusStyles = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-success/10 text-success border-success/30';
      case 'in_progress':
        return 'bg-warning/10 text-warning border-warning/30';
      case 'cancelled':
        return 'bg-destructive text-destructive-foreground border-destructive/50';
      default:
        return 'bg-secondary/20 text-secondary-foreground border-transparent';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'gig': return 'bg-gradient-primary';
      case 'recording': return 'bg-gradient-accent';
      case 'rehearsal': return 'bg-secondary';
      case 'meeting': return 'bg-muted';
      default: return 'bg-secondary';
    }
  };

  const renderLinkButton = (event: ScheduleEvent, variant: 'button' | 'icon' = 'button') => {
    if (!event.linkPath) return null;

    if (variant === 'icon') {
      return (
        <Button variant="ghost" size="icon" asChild className="h-8 w-8 text-primary hover:text-primary">
          <Link to={event.linkPath}>
            <ExternalLink className="h-4 w-4" />
            <span className="sr-only">{event.linkLabel ?? 'Open source'}</span>
          </Link>
        </Button>
      );
    }

    return (
      <Button variant="outline" size="sm" asChild className="border-primary/20">
        <Link to={event.linkPath} className="flex items-center gap-1">
          <ExternalLink className="h-4 w-4" />
          <span>{event.linkLabel ?? 'Open'}</span>
        </Link>
      </Button>
    );
  };

  const filteredEvents = selectedDate
    ? events.filter(event => {
        const eventDate = new Date(event.date);
        return eventDate.toDateString() === selectedDate.toDateString();
      })
    : events;

  const upcomingEvents = events.filter(event => event.status === 'upcoming');
  const todayEvents = events.filter(event => {
    const today = new Date();
    const eventDate = new Date(event.date);
    return eventDate.toDateString() === today.toDateString();
  });

  return (
    <div className="min-h-screen bg-gradient-stage p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Schedule
            </h1>
            <p className="text-muted-foreground">
              {upcomingEvents.length} upcoming events • {todayEvents.length} today
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant={viewMode === 'list' ? 'default' : 'outline'}
              onClick={() => setViewMode('list')}
              size="sm"
            >
              List View
            </Button>
            <Button 
              variant={viewMode === 'calendar' ? 'default' : 'outline'}
              onClick={() => setViewMode('calendar')}
              size="sm"
            >
              Calendar View
            </Button>
          </div>
        </div>

        {viewMode === 'calendar' ? (
          /* Calendar View */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1 bg-card/80 backdrop-blur-sm border-primary/20">
              <CardHeader>
                <CardTitle>Calendar</CardTitle>
                <CardDescription>Select a date to view events</CardDescription>
              </CardHeader>
              <CardContent>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  className="rounded-md border"
                />
              </CardContent>
            </Card>

            <div className="lg:col-span-2 space-y-4">
              <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
                <CardHeader>
                  <CardTitle>
                    Events for {selectedDate?.toLocaleDateString() || 'Selected Date'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {filteredEvents.length > 0 ? (
                    <div className="space-y-3">
                      {filteredEvents.map((event) => {
                        const linkIcon = renderLinkButton(event, 'icon');
                        return (
                          <div
                            key={event.id}
                            className="flex items-center gap-4 p-4 rounded-lg bg-secondary/30"
                          >
                            <div className={`p-2 rounded-lg ${getTypeColor(event.type)} text-white`}>
                              {getEventIcon(event.type)}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold truncate">{event.title}</h3>
                                <Badge variant="outline" className={`text-xs ${getStatusStyles(event.status)}`}>
                                  {event.status.replace('_', ' ')}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {event.time}
                                </span>
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {event.location}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {linkIcon}
                              {getStatusIcon(event.status)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">
                      No events scheduled for this date
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          /* List View */
          <Tabs defaultValue="upcoming" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
              <TabsTrigger value="today">Today</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
              <TabsTrigger value="all">All Events</TabsTrigger>
            </TabsList>

            <TabsContent value="upcoming">
              <div className="space-y-4">
                {upcomingEvents.map((event) => {
                  const linkButton = renderLinkButton(event);
                  return (
                    <Card key={event.id} className="bg-card/80 backdrop-blur-sm border-primary/20">
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                          <div className={`p-3 rounded-lg ${getTypeColor(event.type)} text-white`}>
                            {getEventIcon(event.type)}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="text-xl font-semibold">{event.title}</h3>
                              <Badge variant="outline" className="capitalize">
                                {event.type}
                              </Badge>
                              <Badge variant="outline" className={getStatusStyles(event.status)}>
                                {event.status.replace('_', ' ')}
                              </Badge>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                              <div className="flex items-center gap-2 text-sm">
                                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                                <span>{new Date(event.date).toLocaleDateString()}</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <span>{event.time}</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                <span className="truncate">{event.location}</span>
                              </div>
                            </div>

                            <p className="text-muted-foreground mb-3">{event.description}</p>

                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                {event.bandMembers && event.bandMembers.length > 0 && (
                                  <div className="flex items-center gap-1 text-sm">
                                    <Users className="h-4 w-4" />
                                    <span>{event.bandMembers.length} members</span>
                                  </div>
                                )}

                                {event.payout && (
                                  <div className="flex items-center gap-1 text-sm text-success">
                                    <DollarSign className="h-4 w-4" />
                                    <span>${event.payout.toLocaleString()}</span>
                                  </div>
                                )}

                                {event.capacity && (
                                  <div className="flex items-center gap-1 text-sm">
                                    <Star className="h-4 w-4" />
                                    <span>{event.attendees}/{event.capacity}</span>
                                  </div>
                                )}
                              </div>

                              {linkButton ?? (
                                <Button variant="outline" size="sm" className="border-primary/20">
                                  View Details
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="today">
              <div className="space-y-4">
                {todayEvents.length > 0 ? (
                  todayEvents.map((event) => {
                    const todayLink = renderLinkButton(event);
                    return (
                      <Card key={event.id} className="bg-card/80 backdrop-blur-sm border-primary/20 border-l-4 border-l-primary">
                        <CardContent className="p-6">
                          <div className="flex items-start gap-4">
                            <div className={`p-3 rounded-lg ${getTypeColor(event.type)} text-white`}>
                              {getEventIcon(event.type)}
                            </div>

                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className="text-xl font-semibold">{event.title}</h3>
                                <Badge variant="default" className="bg-gradient-primary">
                                  Today
                                </Badge>
                              </div>

                              <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-4 w-4" />
                                  {event.time}
                                </span>
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-4 w-4" />
                                  {event.location}
                                </span>
                              </div>

                              <p className="text-muted-foreground">{event.description}</p>

                              {todayLink && (
                                <div className="mt-4 flex justify-end">
                                  {todayLink}
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                ) : (
                  <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
                    <CardContent className="p-12 text-center">
                      <CalendarIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No events today</h3>
                      <p className="text-muted-foreground">Enjoy your free day or schedule something new!</p>
                      <Button className="mt-4 bg-gradient-primary">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Event
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="completed">
              <div className="space-y-4">
                {events.filter(e => e.status === 'completed').map((event) => (
                  <Card key={event.id} className="bg-card/80 backdrop-blur-sm border-primary/20 opacity-75">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="p-3 rounded-lg bg-success/20 text-success">
                          <CheckCircle className="h-4 w-4" />
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-xl font-semibold">{event.title}</h3>
                            <Badge variant="secondary">Completed</Badge>
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                            <span>{new Date(event.date).toLocaleDateString()}</span>
                            <span>{event.time}</span>
                            <span>{event.location}</span>
                          </div>

                          <p className="text-muted-foreground">{event.description}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="all">
              <div className="space-y-4">
                {events.map((event) => {
                  const linkButton = renderLinkButton(event);
                  return (
                    <Card key={event.id} className="bg-card/80 backdrop-blur-sm border-primary/20">
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                          <div className={`p-3 rounded-lg ${getTypeColor(event.type)} text-white`}>
                            {getEventIcon(event.type)}
                          </div>

                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="text-xl font-semibold">{event.title}</h3>
                              <Badge variant="outline" className="capitalize">
                                {event.type}
                              </Badge>
                              <Badge variant="outline" className={getStatusStyles(event.status)}>
                                {event.status.replace('_', ' ')}
                              </Badge>
                            </div>

                            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                              <span>{new Date(event.date).toLocaleDateString()}</span>
                              <span>{event.time}</span>
                              <span>{event.location}</span>
                            </div>

                            <p className="text-muted-foreground">{event.description}</p>

                            {(event.bandMembers && event.bandMembers.length > 0) || event.payout || event.capacity || linkButton ? (
                              <div className="mt-4 flex items-center justify-between text-sm">
                                <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
                                  {event.bandMembers && event.bandMembers.length > 0 && (
                                    <span className="flex items-center gap-1">
                                      <Users className="h-4 w-4" />
                                      {event.bandMembers.length} members
                                    </span>
                                  )}
                                  {event.payout && (
                                    <span className="flex items-center gap-1 text-success">
                                      <DollarSign className="h-4 w-4" />
                                      ${event.payout.toLocaleString()}
                                    </span>
                                  )}
                                  {event.capacity && (
                                    <span className="flex items-center gap-1">
                                      <Star className="h-4 w-4" />
                                      {event.attendees}/{event.capacity}
                                    </span>
                                  )}
                                </div>

                                {linkButton && (
                                  <div className="flex-shrink-0">{linkButton}</div>
                                )}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
};

export default Schedule;