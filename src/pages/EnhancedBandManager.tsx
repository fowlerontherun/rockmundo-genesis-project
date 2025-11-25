import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useBandChemistry } from "@/hooks/useBandChemistry";
import { useAdvancedGigs } from "@/hooks/useAdvancedGigs";
import { Users, TrendingUp, Calendar, AlertTriangle, Music } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const EnhancedBandManager = () => {
  const [user, setUser] = useState<any>(null);
  const [band, setBand] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });
  }, []);

  useEffect(() => {
    if (!user) return;

    supabase
      .from("band_members")
      .select("band_id")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          supabase
            .from("bands")
            .select("*")
            .eq("id", data.band_id)
            .single()
            .then(({ data: bandData }) => setBand(bandData));
        }
      });
  }, [user]);

  const { band: chemistryData, events, members, chemistryBreakdown } = useBandChemistry(band?.id);
  const { offers, conflicts } = useAdvancedGigs(band?.id);

  const activeOffers = offers.filter((o) => o.status === "pending");
  const unresolvedConflicts = conflicts.filter((c) => !c.resolved);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Enhanced Band Manager</h1>
        <p className="text-muted-foreground">Advanced analytics and coordination tools</p>
      </div>

      {!band ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">Join or create a band to access features</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Chemistry</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{chemistryData?.chemistry_level || 0}</div>
                <Progress value={(chemistryData?.chemistry_level || 0) * 10} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Cohesion</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{chemistryData?.cohesion_score || 0}</div>
                <p className="text-xs text-muted-foreground">Days: {chemistryData?.days_together || 0}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Offers</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activeOffers.length}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Conflicts</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{unresolvedConflicts.length}</div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="chemistry">
            <TabsList>
              <TabsTrigger value="chemistry">Chemistry</TabsTrigger>
              <TabsTrigger value="members">Members</TabsTrigger>
            </TabsList>

            <TabsContent value="chemistry">
              <Card>
                <CardHeader>
                  <CardTitle>Chemistry Events</CardTitle>
                </CardHeader>
                <CardContent>
                  {events.slice(0, 5).map((event) => (
                    <div key={event.id} className="flex justify-between border-b pb-2 mb-2">
                      <span className="capitalize">{event.event_type.replace("_", " ")}</span>
                      <Badge variant={event.chemistry_change > 0 ? "default" : "destructive"}>
                        {event.chemistry_change > 0 ? "+" : ""}{event.chemistry_change}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="members">
              <div className="grid gap-4 md:grid-cols-2">
                {members.map((member) => (
                  <Card key={member.id}>
                    <CardHeader>
                      <CardTitle className="text-base capitalize">{member.instrument_role}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm">Contribution: {member.chemistry_contribution || 0}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
};

export default EnhancedBandManager;
