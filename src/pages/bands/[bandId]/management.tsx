import { useMemo } from "react";
import { useParams, Navigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BandRosterTab } from "@/components/bands/BandRosterTab";
import { BandRehearsalsTab } from "@/components/bands/BandRehearsalsTab";
import { BandFinancesTab } from "@/components/bands/BandFinancesTab";
import { Card, CardContent } from "@/components/ui/card";

const tabConfig = [
  { value: "roster", label: "Roster", description: "Manage lineup, roles, and leadership readiness." },
  { value: "rehearsals", label: "Rehearsals", description: "Oversee rehearsal cadence, costs, and preparation." },
  { value: "finances", label: "Finances", description: "Track band earnings, balance, and transactions." },
] as const;

export default function BandManagementPage() {
  const { bandId } = useParams<{ bandId: string }>();

  const defaultTab = useMemo(() => tabConfig[0]?.value ?? "roster", []);

  if (!bandId) {
    return <Navigate to="/band" replace />;
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Band management</h1>
        <p className="text-muted-foreground">
          Operate your band with clarity—monitor who is on the roster, how rehearsals are progressing, and where the
          finances stand.
        </p>
      </div>

      <Card className="border-dashed border-primary/30 bg-primary/5">
        <CardContent className="grid gap-2 p-6 text-sm text-muted-foreground md:grid-cols-3">
          {tabConfig.map((tab) => (
            <div key={tab.value}>
              <p className="font-semibold text-primary">{tab.label}</p>
              <p>{tab.description}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Tabs defaultValue={defaultTab} className="space-y-6">
        <TabsList className="w-full justify-start overflow-x-auto">
          {tabConfig.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="px-6">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="roster" className="space-y-6">
          <BandRosterTab bandId={bandId} />
        </TabsContent>

        <TabsContent value="rehearsals" className="space-y-6">
          <BandRehearsalsTab bandId={bandId} />
        </TabsContent>

        <TabsContent value="finances" className="space-y-6">
          <BandFinancesTab bandId={bandId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
