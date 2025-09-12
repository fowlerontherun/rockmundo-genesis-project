import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Users, DollarSign, Clock, Star, Music, Volume2 } from "lucide-react";

const GigBooking = () => {
  const [selectedGig, setSelectedGig] = useState<number | null>(null);
  
  const [availableGigs] = useState([
    {
      id: 1,
      venue: "The Underground Club",
      location: "Downtown",
      date: "2025-09-15",
      time: "21:00",
      duration: "3 hours",
      payment: 850,
      difficulty: "Easy",
      audience: 120,
      genre: "Alternative Rock",
      requirements: ["2+ band members", "Own equipment"],
      description: "Popular local venue known for discovering new talent. Great for building fanbase.",
      prestigeBonus: 15,
      fanGrowth: "50-80 new fans"
    },
    {
      id: 2,
      venue: "Electric Arena",
      location: "City Center",
      date: "2025-09-20",
      time: "20:00", 
      duration: "4 hours",
      payment: 2500,
      difficulty: "Medium",
      audience: 800,
      genre: "Rock/Metal",
      requirements: ["Professional sound check", "4+ band members", "2+ albums"],
      description: "Mid-size arena with excellent acoustics. Opportunity for significant exposure.",
      prestigeBonus: 45,
      fanGrowth: "200-350 new fans"
    },
    {
      id: 3,
      venue: "Acoustic Café",
      location: "Arts District",
      date: "2025-09-18",
      time: "19:30",
      duration: "2 hours",
      payment: 400,
      difficulty: "Easy",
      audience: 60,
      genre: "Acoustic/Folk",
      requirements: ["Acoustic setup only", "1-2 members"],
      description: "Intimate venue perfect for acoustic performances and singer-songwriter material.",
      prestigeBonus: 8,
      fanGrowth: "20-40 new fans"
    },
    {
      id: 4,
      venue: "Rocktoberfest Festival",
      location: "Festival Grounds",
      date: "2025-10-05",
      time: "16:00",
      duration: "45 minutes",
      payment: 5000,
      difficulty: "Hard",
      audience: 5000,
      genre: "All Rock Genres",
      requirements: ["Chart position top 50", "Professional rider", "Security clearance"],
      description: "Major festival appearance. Huge exposure but high pressure performance.",
      prestigeBonus: 120,
      fanGrowth: "800-1200 new fans"
    },
    {
      id: 5,
      venue: "The Garage",
      location: "Suburbs",
      date: "2025-09-22",
      time: "22:00",
      duration: "2.5 hours",
      payment: 600,
      difficulty: "Easy",
      audience: 90,
      genre: "Punk/Alternative",
      requirements: ["High energy performance", "Original material"],
      description: "Raw, energetic venue. Great for punk and alternative acts. Very loyal audience.",
      prestigeBonus: 12,
      fanGrowth: "30-60 new fans"
    }
  ]);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Easy": return "border-success text-success";
      case "Medium": return "border-warning text-warning";
      case "Hard": return "border-destructive text-destructive";
      default: return "border-muted text-muted-foreground";
    }
  };

  const handleBookGig = (gigId: number) => {
    // In real app, this would make an API call
    console.log("Booking gig:", gigId);
    alert("Gig booked successfully! Check your schedule for details.");
  };

  return (
    <div className="min-h-screen bg-gradient-stage p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Gig Booking
            </h1>
            <p className="text-muted-foreground">Find and book performances for your band</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="border-primary/20 hover:bg-primary/10">
              <Calendar className="h-4 w-4 mr-2" />
              View Schedule
            </Button>
            <Button className="bg-gradient-primary hover:shadow-electric">
              <Music className="h-4 w-4 mr-2" />
              Request Custom Gig
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">This Month</p>
                  <p className="text-2xl font-bold text-primary">3</p>
                </div>
                <Music className="h-8 w-8 text-primary/60" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Earnings</p>
                  <p className="text-2xl font-bold text-success">$4,200</p>
                </div>
                <DollarSign className="h-8 w-8 text-success/60" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">New Fans</p>
                  <p className="text-2xl font-bold text-accent">+287</p>
                </div>
                <Users className="h-8 w-8 text-accent/60" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Prestige</p>
                  <p className="text-2xl font-bold text-warning">+72</p>
                </div>
                <Star className="h-8 w-8 text-warning/60" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Available Gigs */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {availableGigs.map((gig) => (
            <Card 
              key={gig.id} 
              className={`bg-card/80 backdrop-blur-sm cursor-pointer transition-all duration-300 ${
                selectedGig === gig.id 
                  ? "border-primary shadow-electric" 
                  : "border-primary/20 hover:border-primary/40"
              }`}
              onClick={() => setSelectedGig(selectedGig === gig.id ? null : gig.id)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Volume2 className="h-5 w-5 text-primary" />
                      {gig.venue}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-1 mt-1">
                      <MapPin className="h-3 w-3" />
                      {gig.location}
                    </CardDescription>
                  </div>
                  <Badge 
                    variant="outline" 
                    className={getDifficultyColor(gig.difficulty)}
                  >
                    {gig.difficulty}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{gig.date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{gig.time} ({gig.duration})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>{gig.audience} audience</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-success" />
                    <span className="text-success font-semibold">${gig.payment}</span>
                  </div>
                </div>

                {/* Genre */}
                <div>
                  <Badge variant="secondary" className="text-xs">
                    {gig.genre}
                  </Badge>
                </div>

                {/* Rewards */}
                <div className="flex gap-2 text-xs">
                  <Badge variant="outline" className="border-primary/20 text-primary">
                    +{gig.prestigeBonus} Prestige
                  </Badge>
                  <Badge variant="outline" className="border-accent/20 text-accent">
                    {gig.fanGrowth}
                  </Badge>
                </div>

                {/* Description */}
                <p className="text-sm text-muted-foreground">
                  {gig.description}
                </p>

                {/* Requirements (shown when selected) */}
                {selectedGig === gig.id && (
                  <div className="border-t border-primary/20 pt-4 space-y-3">
                    <div>
                      <h4 className="text-sm font-semibold mb-2">Requirements:</h4>
                      <ul className="text-xs text-muted-foreground space-y-1">
                        {gig.requirements.map((req, index) => (
                          <li key={index} className="flex items-center gap-2">
                            <div className="w-1 h-1 bg-primary rounded-full" />
                            {req}
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <Button 
                      className="w-full bg-gradient-primary hover:shadow-electric"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleBookGig(gig.id);
                      }}
                    >
                      Book This Gig
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Instructions */}
        <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg">How Gig Booking Works</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>• Click on any gig to see detailed requirements and rewards</p>
            <p>• Higher difficulty gigs offer better pay and prestige but require more preparation</p>
            <p>• Build your fanbase with smaller venues before attempting major festivals</p>
            <p>• Each gig contributes to your band's overall popularity and chart position</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default GigBooking;