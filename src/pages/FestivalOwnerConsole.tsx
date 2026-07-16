import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, FileText, ShieldCheck, Ticket, Users } from "lucide-react";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { CanonicalOrganiserBookingWorkspace } from "@/features/festivals/booking/components";
import { OwnerEditionSelector } from "@/features/festivals/admin/components/OwnerEditionSelector";
import { useOwnerFestivalEditions } from "@/features/festivals/admin/hooks";

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

  return <FMPageScaffold title="Festival management" description="Canonical brand and edition management for festival owners and delegated managers.">
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
          <TabsTrigger value="operations">Operations</TabsTrigger>
          <TabsTrigger value="outcomes">Outcomes</TabsTrigger>
          <TabsTrigger value="finance">Finance</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5" />{selectedEdition.title}<Badge>{selectedEdition.status}</Badge></CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-3 text-sm"><div><p className="text-muted-foreground">City</p><p>{selectedEdition.cityName ?? "Not assigned"}</p></div><div><p className="text-muted-foreground">Dates</p><p>{selectedEdition.startAt ? new Date(selectedEdition.startAt).toLocaleDateString() : "Unscheduled"}</p></div><div><p className="text-muted-foreground">Currency</p><p>{selectedEdition.currencyCode}</p></div></CardContent></Card>
        </TabsContent>
        <TabsContent value="booking"><CanonicalOrganiserBookingWorkspace editionId={selectedEdition.id} /></TabsContent>
        <TabsContent value="operations"><EditionOperationsSummary /></TabsContent>
        <TabsContent value="outcomes"><ReadOnlyOutcomeSummary /></TabsContent>
        <TabsContent value="finance"><SettlementReadinessSummary /></TabsContent>
      </Tabs>}
    </div>
  </FMPageScaffold>;
}

function EditionOperationsSummary() {
  return <div className="grid gap-4 md:grid-cols-3">
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Staff</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">Hiring and termination are server-authoritative, edition scoped and based on deterministic staff candidates.</CardContent></Card>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />Permits</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">Permit requirements derive from city, capacity, duration, stage count and operating policy. Owners cannot directly insert approvals.</CardContent></Card>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" />Insurance</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">Quotes and purchases are edition scoped and ledger-backed without arbitrary client balance changes.</CardContent></Card>
  </div>;
}

function ReadOnlyOutcomeSummary() {
  return <Card><CardHeader><CardTitle>Read-only outcomes</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">Audience generation, attendance, cohorts, crowd snapshots, performance outcomes, song outcomes, highlights and pending effects are displayed as canonical outcomes. Owners cannot edit scores.</CardContent></Card>;
}

function SettlementReadinessSummary() {
  return <Card><CardHeader><CardTitle className="flex items-center gap-2"><Ticket className="h-5 w-5" />Settlement readiness</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">This console surfaces blockers from festival_edition_settlement_readiness. Fame, fans, streaming and money settlement are intentionally deferred to the next PR.</CardContent></Card>;
}
