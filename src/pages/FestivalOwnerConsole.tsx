import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { CanonicalOrganiserBookingWorkspace } from "@/features/festivals/booking/components";
import { OwnerEditionSelector } from "@/features/festivals/admin/components/OwnerEditionSelector";
import { useOwnerFestivalEditions } from "@/features/festivals/admin/hooks";
import { FestivalStageManagement } from "@/features/festivals/admin/components/FestivalStageManagement";
import { FestivalStaffManagement } from "@/features/festivals/admin/components/FestivalStaffManagement";
import { FestivalPermitManagement } from "@/features/festivals/admin/components/FestivalPermitManagement";
import { FestivalInsuranceManagement } from "@/features/festivals/admin/components/FestivalInsuranceManagement";
import { FestivalFinanceManagement } from "@/features/festivals/admin/components/FestivalFinanceManagement";
import { FestivalOutcomesManagement } from "@/features/festivals/admin/components/FestivalOutcomesManagement";
import { FestivalSettlementManagement } from "@/features/festivals/admin/components/FestivalSettlementManagement";

export default function FestivalOwnerConsole() {
  const { festivalId, editionId } = useParams();
  const { data: editions = [], isLoading, error } = useOwnerFestivalEditions(festivalId);
  const selectedEdition = editions.find((edition) => edition.id === editionId);

  if (!festivalId) {
    return <FMPageScaffold title="Festival management"><Card><CardContent className="p-6 text-destructive">Missing festival id.</CardContent></Card></FMPageScaffold>;
  }

  if (isLoading) {
    return <FMPageScaffold title="Festival management"><Card><CardContent className="p-6">Loading authorised editions…</CardContent></Card></FMPageScaffold>;
  }

  if (error) {
    return <FMPageScaffold title="Festival management"><Card><CardContent className="p-6 text-destructive">This festival edition could not be loaded. Reference FESTIVAL_EDITION_OPTIONS.</CardContent></Card></FMPageScaffold>;
  }

  if (!editionId && editions[0]) {
    return <Navigate to={`/festivals/${festivalId}/manage/editions/${editions[0].id}`} replace />;
  }

  return <FMPageScaffold title="Festival management" subtitle="Canonical brand and edition management for festival owners and delegated managers.">
    <div className="mb-4"><Button asChild variant="ghost" size="sm"><Link to="/festivals"><ArrowLeft className="mr-2 h-4 w-4" />Back to festivals</Link></Button></div>
    <div className="space-y-6">
      <OwnerEditionSelector festivalId={festivalId} selectedEditionId={editionId} />
      {!selectedEdition ? <Card>
        <CardHeader><CardTitle>{editionId ? "Festival edition unavailable" : "Choose an edition before managing operations"}</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">{editionId ? "The edition in the URL is not authorised for this festival, does not belong to this brand, or needs admin migration. Reference FESTIVAL_INVALID_EDITION_ROUTE." : "The owner console no longer silently derives a current occurrence from permanent brand dates. Select a planning, upcoming, live, settling or completed edition to open edition-scoped stages, staff, permits, insurance, outcomes and finance."}</CardContent>
      </Card> : <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="booking">Booking</TabsTrigger>
          <TabsTrigger value="lineup">Lineup</TabsTrigger>
          <TabsTrigger value="stages">Stages</TabsTrigger>
          <TabsTrigger value="staff">Staff</TabsTrigger>
          <TabsTrigger value="permits">Permits</TabsTrigger>
          <TabsTrigger value="insurance">Insurance</TabsTrigger>
          <TabsTrigger value="finance">Finance</TabsTrigger>
          <TabsTrigger value="live">Live</TabsTrigger>
          <TabsTrigger value="outcomes">Outcomes</TabsTrigger>
          <TabsTrigger value="settlement">Settlement</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5" />{selectedEdition.title}<Badge>{selectedEdition.status}</Badge></CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-3 text-sm"><div><p className="text-muted-foreground">City</p><p>{selectedEdition.cityName ?? "Not assigned"}</p></div><div><p className="text-muted-foreground">Dates</p><p>{selectedEdition.startAt ? new Date(selectedEdition.startAt).toLocaleDateString() : "Unscheduled"}</p></div><div><p className="text-muted-foreground">Currency</p><p>{selectedEdition.currencyCode}</p></div></CardContent></Card>
        </TabsContent>
        <TabsContent value="booking"><CanonicalOrganiserBookingWorkspace editionId={selectedEdition.id} /></TabsContent>
        <TabsContent value="lineup"><CanonicalOrganiserBookingWorkspace editionId={selectedEdition.id} /></TabsContent>
        <TabsContent value="stages"><FestivalStageManagement editionId={selectedEdition.id} /></TabsContent>
        <TabsContent value="staff"><FestivalStaffManagement editionId={selectedEdition.id} /></TabsContent>
        <TabsContent value="permits"><FestivalPermitManagement editionId={selectedEdition.id} /></TabsContent>
        <TabsContent value="insurance"><FestivalInsuranceManagement editionId={selectedEdition.id} /></TabsContent>
        <TabsContent value="finance"><FestivalFinanceManagement editionId={selectedEdition.id} /></TabsContent>
        <TabsContent value="live"><FestivalOutcomesManagement editionId={selectedEdition.id} /></TabsContent>
        <TabsContent value="outcomes"><FestivalOutcomesManagement editionId={selectedEdition.id} /></TabsContent>
        <TabsContent value="settlement"><FestivalSettlementManagement editionId={selectedEdition.id} /></TabsContent>
        <TabsContent value="history"><Card><CardHeader><CardTitle>Edition history</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">Historical edition records are read-only here; admin legacy migration tools live in /admin/festivals.</CardContent></Card></TabsContent>
        <TabsContent value="settings"><Card><CardHeader><CardTitle>Edition settings</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">Use the edition selector above to change editions. Server-projected permissions remain authoritative for all actions.</CardContent></Card></TabsContent>
      </Tabs>}
    </div>
  </FMPageScaffold>;
}
