import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePrimaryBand } from "@/hooks/usePrimaryBand";
import { useAuth } from "@/hooks/use-auth-context";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, Music2, TrendingUp, DollarSign, Settings, UserPlus } from "lucide-react";
import { Link } from "react-router-dom";

const SimpleBandManager = () => {
  const { user } = useAuth();
  const { data: bandData, isLoading } = usePrimaryBand();
  const band = bandData?.bands;
  
  const { data: members = [] } = useQuery({
    queryKey: ["band-members", band?.id],
    queryFn: async () => {
      if (!band?.id) return [];
      const { data } = await supabase
        .from("band_members")
        .select("*")
        .eq("band_id", band.id);
      return data || [];
    },
    enabled: !!band?.id,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-muted-foreground">Loading band data...</p>
      </div>
    );
  }

  if (!band) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>No Band Found</CardTitle>
            <CardDescription>Create or join a band to get started</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/bands">
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Go to Bands Page
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8" />
            {band.name}
          </h1>
          <p className="text-muted-foreground">{band.genre} • {members.length} members</p>
        </div>
        <Link to="/bands">
          <Button variant="outline">
            <Settings className="h-4 w-4 mr-2" />
            Advanced Settings
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Fame</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{band.fame || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Chemistry</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{band.chemistry_level || 0}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${band.band_balance?.toLocaleString() || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Weekly Fans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{band.weekly_fans?.toLocaleString() || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="songs">Songs</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Band Members</CardTitle>
              <CardDescription>{members.length} active members</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{member.user_id}</p>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="outline">{member.instrument_role}</Badge>
                        {member.vocal_role && <Badge variant="outline">{member.vocal_role}</Badge>}
                        {member.role === 'leader' && <Badge>Leader</Badge>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="songs">
          <Card>
            <CardHeader>
              <CardTitle>Band Repertoire</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <Music2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Song catalog coming soon</p>
                <p className="text-sm mt-2">View and manage your band's songs</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance">
          <Card>
            <CardHeader>
              <CardTitle>Performance Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-sm">Total Performances</span>
                  </div>
                  <p className="text-2xl font-bold">{band.performance_count || 0}</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <DollarSign className="h-4 w-4" />
                    <span className="text-sm">Total Earnings</span>
                  </div>
                  <p className="text-2xl font-bold">${band.band_balance?.toLocaleString() || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SimpleBandManager;