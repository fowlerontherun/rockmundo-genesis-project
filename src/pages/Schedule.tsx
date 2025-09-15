import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
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
  XCircle
} from "lucide-react";

interface ScheduleEvent {
  id: number;
  title: string;
  type: 'gig' | 'recording' | 'rehearsal' | 'meeting' | 'tour';
  date: string;
  time: string;
  location: string;
  description: string;
  status: 'upcoming' | 'in_progress' | 'completed' | 'cancelled';
  payout?: number;
  capacity?: number;
  attendees?: number;
  bandMembers: string[];
}

const Schedule = () => {
  const { toast } = useToast();
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('list');

  useEffect(() => {
    loadSchedule();
  }, []);

  const loadSchedule = async () => {
    try {
      // Simulated schedule data
      const mockEvents: ScheduleEvent[] = [
        {
          id: 1,
          title: "Live at The Underground",
          type: "gig",
          date: "2024-02-15",
          time: "21:00",
          location: "The Underground Club, Downtown",
          description: "Headlining show with local support acts",
          status: "upcoming",
          payout: 1500,
          capacity: 300,
          attendees: 285,
          bandMembers: ["Alex Storm", "Jamie Thunder", "Sam Lightning", "Casey Bolt"]
        },
        {
          id: 2,
          title: "Studio Session - New Album",
          type: "recording",
          date: "2024-02-12",
          time: "14:00",
          location: "Sonic Studios",
          description: "Recording vocals for new single 'Electric Dreams'",
          status: "completed",
          bandMembers: ["Alex Storm", "Jamie Thunder"]
        },
        {
          id: 3,
          title: "Band Rehearsal",
          type: "rehearsal",
          date: "2024-02-18",
          time: "19:00",
          location: "Practice Room B12",
          description: "Preparing for upcoming tour dates",
          status: "upcoming",
          bandMembers: ["Alex Storm", "Jamie Thunder", "Sam Lightning", "Casey Bolt"]
        },
        {
          id: 4,
          title: "Record Label Meeting",
          type: "meeting",
          date: "2024-02-20",
          time: "15:30",
          location: "Thunder Records Office",
          description: "Discussing new album contract and tour support",
          status: "upcoming",
          bandMembers: ["Alex Storm", "Jamie Thunder"]
        },
        {
          id: 5,
          title: "Rock Festival Mainstage",
          type: "gig",
          date: "2024-02-25",
          time: "20:30",
          location: "Central Park Amphitheater",
          description: "Festival headliner slot - 45 minute set",
          status: "upcoming",
          payout: 8500,
          capacity: 5000,
          attendees: 4200,
          bandMembers: ["Alex Storm", "Jamie Thunder", "Sam Lightning", "Casey Bolt"]
        },
        {
          id: 6,
          title: "Radio Interview",
          type: "meeting",
          date: "2024-02-22",
          time: "10:00",
          location: "KROCK 94.5 Studios",
          description: "Live interview and acoustic performance",
          status: "upcoming",
          bandMembers: ["Alex Storm", "Jamie Thunder"]
        }
      ];
      setEvents(mockEvents);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load schedule",
        variant: "destructive"
      });
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'gig': return <Music className="h-4 w-4" />;
      case 'recording': return <Music className="h-4 w-4" />;
      case 'rehearsal': return <Users className="h-4 w-4" />;
      case 'meeting': return <Users className="h-4 w-4" />;
      case 'tour': return <MapPin className="h-4 w-4" />;
      default: return <CalendarIcon className="h-4 w-4" />;
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'in_progress': return 'warning';
      case 'cancelled': return 'destructive';
      default: return 'default';
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
                      {filteredEvents.map((event) => (
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
                              <Badge variant={getStatusColor(event.status) as any} className="text-xs">
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

                          <div className="text-right">
                            {getStatusIcon(event.status)}
                          </div>
                        </div>
                      ))}
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
                {upcomingEvents.map((event) => (
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
                            <Badge variant={getStatusColor(event.status) as any}>
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
                              <div className="flex items-center gap-1 text-sm">
                                <Users className="h-4 w-4" />
                                <span>{event.bandMembers.length} members</span>
                              </div>
                              
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

                            <Button variant="outline" size="sm" className="border-primary/20">
                              View Details
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="today">
              <div className="space-y-4">
                {todayEvents.length > 0 ? (
                  todayEvents.map((event) => (
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
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
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
                {events.map((event) => (
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
                            <Badge variant={getStatusColor(event.status) as any}>
                              {event.status.replace('_', ' ')}
                            </Badge>
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
          </Tabs>
        )}
      </div>
    </div>
  );
};

export default Schedule;