import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Calendar, Users, DollarSign, Plus, Map } from "lucide-react";
import { Link } from "react-router-dom";

const TourManager = () => {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tour Manager</h1>
          <p className="text-muted-foreground">Plan and manage your band's tours</p>
        </div>
        <Button>
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
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">No tours scheduled</p>
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
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Plan your first tour</p>
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
            <div className="text-2xl font-bold">$0</div>
            <p className="text-xs text-muted-foreground">Lifetime earnings</p>
          </CardContent>
        </Card>
      </div>

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
    </div>
  );
};

export default TourManager;
