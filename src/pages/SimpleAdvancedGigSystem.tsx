import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, DollarSign, Users, Music, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { StandardPageLayout } from "@/components/ui/StandardPageLayout";

const SimpleAdvancedGigSystem = () => {
  return (
    <StandardPageLayout
      title="Advanced Gig System"
      subtitle="Simplified view of your performance schedule"
      icon={Music}
      bareContent
      headerActions={
        <Link to="/gigs">
          <Button>View Full Gig Manager</Button>
        </Link>
      }
      stats={
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Calendar className="h-3 w-3" /> Total Gigs
            </div>
            <div className="text-lg font-bold">0</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <DollarSign className="h-3 w-3" /> Earnings
            </div>
            <div className="text-lg font-bold">$0</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Users className="h-3 w-3" /> Attendance
            </div>
            <div className="text-lg font-bold">0</div>
          </div>
        </div>
      }
      secondaryActions={
        <>
          <Link to="/gigs"><Button variant="outline" size="sm">Browse Venues</Button></Link>
          <Link to="/setlists"><Button variant="outline" size="sm">Manage Setlists</Button></Link>
          <Link to="/band"><Button variant="outline" size="sm">Band Manager</Button></Link>
        </>
      }
    >
      <Tabs defaultValue="upcoming">
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="stats">Statistics</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Performances</CardTitle>
              <CardDescription>Your scheduled gigs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No upcoming gigs scheduled</p>
                <p className="text-sm mt-2">Book a gig to see it here</p>
                <Link to="/gigs">
                  <Button className="mt-4">Browse Venues</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance History</CardTitle>
              <CardDescription>Your past gigs and outcomes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <Music className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No completed gigs yet</p>
                <p className="text-sm mt-2">Perform at venues to build your history</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Trends</CardTitle>
              <CardDescription>Track your improvement over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Not enough data yet</p>
                <p className="text-sm mt-2">Complete more gigs to see trends</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </StandardPageLayout>
  );
};

export default SimpleAdvancedGigSystem;
