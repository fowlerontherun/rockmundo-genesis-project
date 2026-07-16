import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFestivalOffers, useOrganiserFestivalApplications } from "../hooks";
import { OrganiserApplicationQueue } from "./OrganiserApplicationQueue";
import { OrganiserContractQueue } from "./OrganiserContractQueue";
import { OrganiserOfferQueue } from "./OrganiserOfferQueue";
import { OrganiserSetlistQueue } from "./OrganiserSetlistQueue";
export function CanonicalOrganiserBookingWorkspace({
  editionId,
}: {
  editionId?: string;
}) {
  const applications = useOrganiserFestivalApplications(editionId);
  const offers = useFestivalOffers(undefined, editionId);
  const appData = applications.data ?? [];
  return (
    <Tabs defaultValue="new">
      <TabsList className="grid h-auto grid-cols-2 sm:grid-cols-4 lg:grid-cols-8">
        <TabsTrigger value="new">New</TabsTrigger>
        <TabsTrigger value="review">Under Review</TabsTrigger>
        <TabsTrigger value="shortlisted">Shortlisted</TabsTrigger>
        <TabsTrigger value="waitlisted">Waitlisted</TabsTrigger>
        <TabsTrigger value="offers">Offers</TabsTrigger>
        <TabsTrigger value="signatures">Awaiting Signatures</TabsTrigger>
        <TabsTrigger value="active">Active Bookings</TabsTrigger>
        <TabsTrigger value="setlists">Setlists</TabsTrigger>
      </TabsList>
      <TabsContent value="new">
        <OrganiserApplicationQueue
          title="New Applications"
          statuses={["submitted"]}
          applications={appData}
          isLoading={applications.isLoading}
          editionId={editionId}
        />
      </TabsContent>
      <TabsContent value="review">
        <OrganiserApplicationQueue
          title="Under Review"
          statuses={["under_review"]}
          applications={appData}
          isLoading={applications.isLoading}
          editionId={editionId}
        />
      </TabsContent>
      <TabsContent value="shortlisted">
        <OrganiserApplicationQueue
          title="Shortlisted"
          statuses={["shortlisted"]}
          applications={appData}
          isLoading={applications.isLoading}
          editionId={editionId}
        />
      </TabsContent>
      <TabsContent value="waitlisted">
        <OrganiserApplicationQueue
          title="Waitlisted"
          statuses={["waitlisted"]}
          applications={appData}
          isLoading={applications.isLoading}
          editionId={editionId}
        />
      </TabsContent>
      <TabsContent value="offers">
        <OrganiserOfferQueue offers={offers.data ?? []} />
      </TabsContent>
      <TabsContent value="signatures">
        <OrganiserContractQueue />
      </TabsContent>
      <TabsContent value="active">
        <OrganiserContractQueue />
      </TabsContent>
      <TabsContent value="setlists">
        <OrganiserSetlistQueue />
      </TabsContent>
    </Tabs>
  );
}
