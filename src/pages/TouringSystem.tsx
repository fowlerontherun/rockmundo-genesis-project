import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Map, Calendar, Truck, Users, DollarSign, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const TouringSystem = () => {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Touring System</h1>
        <p className="text-muted-foreground">Complete touring infrastructure and logistics</p>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>System Integration</AlertTitle>
        <AlertDescription>
          The touring system integrates Travel, Gigs, Band Crew, and Schedule features.
          Use these existing systems to manage your tours.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link to="/travel">
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Map className="h-5 w-5" />
                Travel
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Plan routes and book transportation
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/gigs">
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Gigs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Book shows and manage performances
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/band-crew">
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-5 w-5" />
                Crew
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Hire and manage touring crew
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/schedule">
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Schedule
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Coordinate tour timing
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="logistics">Logistics</TabsTrigger>
          <TabsTrigger value="finances">Finances</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tour Planning Guide</CardTitle>
              <CardDescription>Essential steps for a successful tour</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-semibold">1. Route Planning</h3>
                <p className="text-sm text-muted-foreground">
                  Use the Travel system to plan your route between cities
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="font-semibold">2. Venue Booking</h3>
                <p className="text-sm text-muted-foreground">
                  Book gigs at venues in each tour stop
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold">3. Crew Assembly</h3>
                <p className="text-sm text-muted-foreground">
                  Hire road crew, tour managers, and support staff
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold">4. Schedule Coordination</h3>
                <p className="text-sm text-muted-foreground">
                  Plan daily activities and manage time between shows
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logistics">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Logistics Management
              </CardTitle>
              <CardDescription>Transportation, equipment, and accommodations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                Use the Travel, Band Crew, and Stage Equipment systems to manage tour logistics
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="finances">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Tour Finances
              </CardTitle>
              <CardDescription>Revenue, expenses, and budgeting</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                Track your tour finances through the Finances page and gig earnings
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TouringSystem;
