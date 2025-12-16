import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FestivalSlotOffers } from "./FestivalSlotOffers";
import { useFestivalSlotApplications } from "@/hooks/useFestivalSlotApplications";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Music, Clock } from "lucide-react";
import { format } from "date-fns";

interface FestivalManagementTabsProps {
  bandId: string;
}

export const FestivalManagementTabs = ({ bandId }: FestivalManagementTabsProps) => {
  const { applications, isLoading } = useFestivalSlotApplications(undefined, bandId);

  const pendingApps = applications?.filter((a) => a.status === "pending") || [];
  const acceptedApps = applications?.filter((a) => a.status === "accepted") || [];

  return (
    <Tabs defaultValue="offers" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="offers">Slot Offers</TabsTrigger>
        <TabsTrigger value="applications">
          My Applications
          {pendingApps.length > 0 && (
            <Badge variant="secondary" className="ml-2">{pendingApps.length}</Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="confirmed">
          Confirmed
          {acceptedApps.length > 0 && (
            <Badge variant="default" className="ml-2">{acceptedApps.length}</Badge>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="offers" className="mt-4">
        <FestivalSlotOffers bandId={bandId} />
      </TabsContent>

      <TabsContent value="applications" className="mt-4">
        {isLoading ? (
          <div className="text-muted-foreground">Loading applications...</div>
        ) : pendingApps.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No pending applications</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {pendingApps.map((app) => (
              <Card key={app.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{app.festival?.name}</CardTitle>
                    <Badge variant="outline">{app.slot_type}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {app.festival?.start_date && format(new Date(app.festival.start_date), "MMM d, yyyy")}
                    </div>
                    {app.setlist && (
                      <div className="flex items-center gap-1">
                        <Music className="h-4 w-4" />
                        {app.setlist.name}
                      </div>
                    )}
                  </div>
                  {app.application_message && (
                    <p className="text-sm mt-2 italic">"{app.application_message}"</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="confirmed" className="mt-4">
        {acceptedApps.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Music className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No confirmed festival slots yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {acceptedApps.map((app) => (
              <Card key={app.id} className="border-primary/50">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{app.festival?.name}</CardTitle>
                    <Badge>{app.slot_type}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {app.festival?.start_date && format(new Date(app.festival.start_date), "MMM d, yyyy")}
                    </div>
                  </div>
                  {app.offered_payment && (
                    <p className="mt-2 text-primary font-medium">
                      Payment: ${app.offered_payment.toLocaleString()}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
};
