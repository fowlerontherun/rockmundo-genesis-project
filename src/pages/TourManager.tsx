import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  MapPin, 
  Calendar, 
  DollarSign, 
  Users, 
  Plane,
  Bus,
  Car,
  Star,
  Clock,
  TrendingUp,
  Music
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const TourManager = () => {
  const { toast } = useToast();
  const [activeTour, setActiveTour] = useState({
    name: "Electric Dreams World Tour",
    status: "active",
    progress: 65,
    cities: 8,
    completedCities: 5,
    totalRevenue: 45600,
    nextShow: {
      venue: "Madison Square Garden",
      city: "New York",
      date: "2024-04-15",
      capacity: 20000,
      ticketPrice: 85,
      expectedRevenue: 12000
    }
  });

  const [plannedTours] = useState([
    {
      id: 1,
      name: "Summer Festival Circuit",
      cities: ["Los Angeles", "Austin", "Chicago", "Nashville"],
      duration: "2 months",
      estimatedRevenue: 75000,
      status: "planning",
      startDate: "2024-06-01"
    },
    {
      id: 2,
      name: "European Adventure",
      cities: ["London", "Berlin", "Paris", "Amsterdam", "Madrid"],
      duration: "3 months",
      estimatedRevenue: 120000,
      status: "draft",
      startDate: "2024-09-01"
    }
  ]);

  const [tourHistory] = useState([
    {
      venue: "The Underground Club",
      city: "Los Angeles",
      date: "2024-03-28",
      attendance: 250,
      capacity: 300,
      revenue: 3200,
      rating: 4.8
    },
    {
      venue: "Electric Ballroom",
      city: "San Francisco", 
      date: "2024-03-25",
      attendance: 450,
      capacity: 500,
      revenue: 5400,
      rating: 4.9
    },
    {
      venue: "Rock Paradise",
      city: "Seattle",
      date: "2024-03-22",
      attendance: 800,
      capacity: 900,
      revenue: 8900,
      rating: 4.7
    },
    {
      venue: "Metro Arena",
      city: "Denver",
      date: "2024-03-19",
      attendance: 1200,
      capacity: 1200,
      revenue: 15600,
      rating: 5.0
    },
    {
      venue: "Crystal Theatre",
      city: "Phoenix",
      date: "2024-03-16",
      attendance: 600,
      capacity: 750,
      revenue: 7800,
      rating: 4.6
    }
  ]);

  const getTransportIcon = (distance: string) => {
    if (distance === "local") return <Car className="h-4 w-4" />;
    if (distance === "regional") return <Bus className="h-4 w-4" />;
    return <Plane className="h-4 w-4" />;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-success text-success-foreground";
      case "planning": return "bg-warning text-warning-foreground";
      case "draft": return "bg-secondary text-secondary-foreground";
      default: return "bg-secondary text-secondary-foreground";
    }
  };

  const handleStartTour = (tourId: number) => {
    toast({
      title: "Tour Started!",
      description: "Your tour has been scheduled and venues are being booked",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-stage p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Tour Manager
            </h1>
            <p className="text-muted-foreground">Plan and manage your touring schedule</p>
          </div>
          <Button className="bg-gradient-primary hover:shadow-electric">
            <Music className="h-4 w-4 mr-2" />
            Plan New Tour
          </Button>
        </div>

        {/* Active Tour */}
        <Card className="bg-card/80 backdrop-blur-sm border-primary/20 shadow-electric">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl text-primary">{activeTour.name}</CardTitle>
                <CardDescription>Currently touring • {activeTour.completedCities}/{activeTour.cities} cities completed</CardDescription>
              </div>
              <Badge className={getStatusColor(activeTour.status)}>
                {activeTour.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Tour Progress</p>
                <Progress value={activeTour.progress} className="h-3" />
                <p className="text-xs text-muted-foreground">{activeTour.progress}% complete</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <div className="flex items-center gap-1 text-success font-bold text-lg">
                  <DollarSign className="h-4 w-4" />
                  {activeTour.totalRevenue.toLocaleString()}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Next Show</p>
                <div className="space-y-1">
                  <p className="font-semibold">{activeTour.nextShow.venue}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {activeTour.nextShow.city}
                    <Calendar className="h-3 w-3 ml-2" />
                    {activeTour.nextShow.date}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Planned Tours */}
          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-accent" />
                Planned Tours
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {plannedTours.map((tour) => (
                <div key={tour.id} className="p-4 rounded-lg bg-secondary/30 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold">{tour.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {tour.cities.length} cities • {tour.duration}
                      </p>
                    </div>
                    <Badge className={getStatusColor(tour.status)}>
                      {tour.status}
                    </Badge>
                  </div>
                  
                  <div className="flex flex-wrap gap-1">
                    {tour.cities.map((city, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {city}
                      </Badge>
                    ))}
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-success text-sm">
                      <DollarSign className="h-3 w-3" />
                      Est. ${tour.estimatedRevenue.toLocaleString()}
                    </div>
                    <Button 
                      size="sm" 
                      onClick={() => handleStartTour(tour.id)}
                      className="bg-gradient-primary hover:shadow-electric"
                    >
                      Start Tour
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Tour Statistics */}
          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Tour Statistics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 rounded-lg bg-primary/10">
                  <div className="text-2xl font-bold text-primary">{tourHistory.length}</div>
                  <p className="text-xs text-muted-foreground">Shows Played</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-success/10">
                  <div className="text-2xl font-bold text-success">
                    {Math.round(tourHistory.reduce((acc, show) => acc + show.rating, 0) / tourHistory.length * 10) / 10}
                  </div>
                  <p className="text-xs text-muted-foreground">Avg Rating</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-accent/10">
                  <div className="text-2xl font-bold text-accent">
                    {tourHistory.reduce((acc, show) => acc + show.attendance, 0).toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">Total Fans</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-warning/10">
                  <div className="text-2xl font-bold text-warning">
                    ${tourHistory.reduce((acc, show) => acc + show.revenue, 0).toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">Total Revenue</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Shows */}
          <Card className="bg-card/80 backdrop-blur-sm border-primary/20 lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Music className="h-5 w-5 text-accent" />
                Recent Shows
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {tourHistory.map((show, index) => (
                  <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                    <div className="flex items-center gap-4">
                      <div className="text-primary">
                        <MapPin className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-semibold">{show.venue}</h4>
                        <p className="text-sm text-muted-foreground">{show.city} • {show.date}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-center">
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {show.attendance}/{show.capacity}
                        </div>
                        <p className="text-xs text-muted-foreground">Attendance</p>
                      </div>
                      
                      <div className="text-center">
                        <div className="flex items-center gap-1 text-success">
                          <DollarSign className="h-3 w-3" />
                          {show.revenue.toLocaleString()}
                        </div>
                        <p className="text-xs text-muted-foreground">Revenue</p>
                      </div>
                      
                      <div className="text-center">
                        <div className="flex items-center gap-1 text-warning">
                          <Star className="h-3 w-3" />
                          {show.rating}
                        </div>
                        <p className="text-xs text-muted-foreground">Rating</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TourManager;