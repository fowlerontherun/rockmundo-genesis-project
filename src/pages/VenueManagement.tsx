import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  MapPin, 
  Users, 
  Star, 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  Music, 
  Clock,
  Heart,
  Award
} from "lucide-react";

const VenueManagement = () => {
  const { toast } = useToast();
  const [playerReputation] = useState(75);

  const venues = [
    {
      id: 1,
      name: "The Underground",
      capacity: 150,
      location: "Downtown",
      relationship: 85,
      bookedShows: 3,
      revenue: 12000,
      reputation: "Rising",
      unlocked: true,
      requirements: "None",
      perks: ["Intimate setting", "Great acoustics", "Loyal fanbase"]
    },
    {
      id: 2,
      name: "City Music Hall",
      capacity: 500,
      location: "Midtown",
      relationship: 60,
      bookedShows: 1,
      revenue: 25000,
      reputation: "Established",
      unlocked: true,
      requirements: "200+ fan following",
      perks: ["Professional sound", "VIP area", "Merchandise booth"]
    },
    {
      id: 3,
      name: "Arena Stadium",
      capacity: 15000,
      location: "Sports District",
      relationship: 0,
      bookedShows: 0,
      revenue: 0,
      reputation: "Elite",
      unlocked: false,
      requirements: "50,000+ fans, Major label deal",
      perks: ["Massive exposure", "Premium sound system", "Media coverage"]
    },
    {
      id: 4,
      name: "Festival Grounds",
      capacity: 25000,
      location: "City Outskirts",
      relationship: 20,
      bookedShows: 0,
      revenue: 0,
      reputation: "Legendary",
      unlocked: false,
      requirements: "100,000+ fans, Chart success",
      perks: ["Festival circuit access", "International exposure", "Record deal opportunities"]
    }
  ];

  const bookings = [
    {
      id: 1,
      venue: "The Underground",
      date: "Dec 15, 2024",
      time: "8:00 PM",
      capacity: 150,
      ticketPrice: 25,
      soldTickets: 120,
      status: "Confirmed",
      revenue: 3000
    },
    {
      id: 2,
      venue: "City Music Hall",
      date: "Jan 20, 2025",
      time: "7:30 PM",
      capacity: 500,
      ticketPrice: 45,
      soldTickets: 350,
      status: "Selling",
      revenue: 15750
    },
    {
      id: 3,
      venue: "The Underground",
      date: "Feb 10, 2025",
      time: "9:00 PM",
      capacity: 150,
      ticketPrice: 30,
      soldTickets: 0,
      status: "Upcoming",
      revenue: 0
    }
  ];

  const handleImproveRelationship = (venueId: number) => {
    toast({
      title: "Relationship Improved!",
      description: "Your relationship with the venue has been strengthened.",
    });
  };

  const handleBookVenue = (venue: any) => {
    if (!venue.unlocked) {
      toast({
        title: "Venue Locked",
        description: `Requirements: ${venue.requirements}`,
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Show Booked!",
      description: `Your show at ${venue.name} has been scheduled.`,
    });
  };

  const getRelationshipColor = (relationship: number) => {
    if (relationship >= 80) return "text-green-400";
    if (relationship >= 60) return "text-yellow-400";
    if (relationship >= 40) return "text-orange-400";
    return "text-red-400";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Confirmed": return "bg-green-500";
      case "Selling": return "bg-blue-500";
      case "Upcoming": return "bg-purple-500";
      default: return "bg-gray-500";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-primary p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-bebas text-cream tracking-wider">
            VENUE MANAGEMENT
          </h1>
          <p className="text-xl text-cream/80 font-oswald">
            Build relationships and unlock bigger stages
          </p>
          <div className="flex justify-center items-center gap-4">
            <div className="flex items-center gap-2 text-cream">
              <Award className="h-6 w-6" />
              <span className="text-lg">Reputation: {playerReputation}/100</span>
            </div>
          </div>
        </div>

        <Tabs defaultValue="venues" className="space-y-6">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-3">
            <TabsTrigger value="venues">Venues</TabsTrigger>
            <TabsTrigger value="bookings">Bookings</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="venues" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {venues.map((venue) => (
                <Card 
                  key={venue.id} 
                  className={`border-2 transition-all ${
                    venue.unlocked 
                      ? "bg-card/80 border-accent hover:bg-card/90" 
                      : "bg-card/40 border-accent/40"
                  }`}
                >
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className={`${venue.unlocked ? 'text-cream' : 'text-cream/60'}`}>
                          {venue.name}
                          {!venue.unlocked && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              Locked
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          {venue.location}
                        </CardDescription>
                      </div>
                      <Badge variant="secondary">{venue.reputation}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-cream/60">
                          <Users className="h-4 w-4" />
                          <span className="text-sm">Capacity</span>
                        </div>
                        <p className="text-xl font-bold text-accent">{venue.capacity.toLocaleString()}</p>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-cream/60">
                          <DollarSign className="h-4 w-4" />
                          <span className="text-sm">Revenue</span>
                        </div>
                        <p className="text-xl font-bold text-accent">${venue.revenue.toLocaleString()}</p>
                      </div>
                    </div>

                    {venue.unlocked && (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-cream/60 text-sm">Relationship</span>
                            <span className={`font-bold ${getRelationshipColor(venue.relationship)}`}>
                              {venue.relationship}%
                            </span>
                          </div>
                          <Progress value={venue.relationship} className="h-2" />
                        </div>

                        <div className="space-y-2">
                          <p className="text-cream/60 text-sm">Perks</p>
                          <div className="flex flex-wrap gap-1">
                            {venue.perks.map((perk, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {perk}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button 
                            onClick={() => handleBookVenue(venue)}
                            className="flex-1 bg-accent hover:bg-accent/80 text-background"
                          >
                            Book Show
                          </Button>
                          <Button 
                            onClick={() => handleImproveRelationship(venue.id)}
                            variant="outline"
                            className="border-accent text-accent hover:bg-accent/10"
                          >
                            <Heart className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}

                    {!venue.unlocked && (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <p className="text-cream/60 text-sm">Requirements</p>
                          <p className="text-sm text-cream/80">{venue.requirements}</p>
                        </div>
                        <Button 
                          disabled
                          className="w-full bg-accent/50 text-background/50"
                        >
                          Unlock Required
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="bookings" className="space-y-6">
            <div className="space-y-4">
              {bookings.map((booking) => (
                <Card key={booking.id} className="bg-card/80 border-accent">
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                      <div className="space-y-1">
                        <h3 className="font-semibold text-cream">{booking.venue}</h3>
                        <div className="flex items-center gap-2 text-cream/60 text-sm">
                          <Calendar className="h-4 w-4" />
                          {booking.date}
                        </div>
                        <div className="flex items-center gap-2 text-cream/60 text-sm">
                          <Clock className="h-4 w-4" />
                          {booking.time}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <p className="text-cream/60 text-sm">Capacity</p>
                        <p className="text-lg font-bold text-accent">{booking.capacity}</p>
                      </div>

                      <div className="space-y-1">
                        <p className="text-cream/60 text-sm">Tickets Sold</p>
                        <div className="space-y-1">
                          <p className="text-lg font-bold text-accent">
                            {booking.soldTickets}/{booking.capacity}
                          </p>
                          <Progress 
                            value={(booking.soldTickets / booking.capacity) * 100} 
                            className="h-2" 
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <p className="text-cream/60 text-sm">Revenue</p>
                        <p className="text-lg font-bold text-accent">${booking.revenue.toLocaleString()}</p>
                      </div>

                      <div className="space-y-2">
                        <Badge 
                          className={`${getStatusColor(booking.status)} text-white`}
                        >
                          {booking.status}
                        </Badge>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="border-accent text-accent">
                            Edit
                          </Button>
                          <Button size="sm" className="bg-accent hover:bg-accent/80 text-background">
                            Promote
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-card/80 border-accent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-cream text-sm">Total Shows</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-accent">24</div>
                  <p className="text-cream/60 text-sm">+4 this month</p>
                </CardContent>
              </Card>
              <Card className="bg-card/80 border-accent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-cream text-sm">Average Attendance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-accent">78%</div>
                  <p className="text-cream/60 text-sm">+12% improvement</p>
                </CardContent>
              </Card>
              <Card className="bg-card/80 border-accent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-cream text-sm">Total Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-accent">$45,200</div>
                  <p className="text-cream/60 text-sm">From live shows</p>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-card/80 border-accent">
              <CardHeader>
                <CardTitle className="text-cream">Venue Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {venues.filter(v => v.unlocked && v.bookedShows > 0).map((venue) => (
                    <div key={venue.id} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-cream">{venue.name}</span>
                        <span className="text-accent font-bold">{venue.bookedShows} shows</span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-cream/60">Revenue: </span>
                          <span className="text-accent">${venue.revenue.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-cream/60">Relationship: </span>
                          <span className={getRelationshipColor(venue.relationship)}>
                            {venue.relationship}%
                          </span>
                        </div>
                        <div>
                          <span className="text-cream/60">Capacity: </span>
                          <span className="text-cream">{venue.capacity}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default VenueManagement;