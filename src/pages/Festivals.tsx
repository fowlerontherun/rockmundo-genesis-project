import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Music, Ticket, Radio, History } from "lucide-react";
import { FestivalBrowser } from "@/components/festivals/FestivalBrowser";
import { LiveFestivalView } from "@/components/festivals/LiveFestivalView";
import { FestivalHistoryTab } from "@/components/festivals/FestivalHistoryTab";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";

export default function Festivals() {
  const [activeTab, setActiveTab] = useState("browse");
  const [liveFestivalId, setLiveFestivalId] = useState<string | null>(null);

  const handleGoLive = (festivalId: string) => {
    setLiveFestivalId(festivalId);
    setActiveTab("live");
  };

  const handleBackFromLive = () => {
    setLiveFestivalId(null);
    setActiveTab("browse");
  };

  return (
    <FMPageScaffold
      title="Festivals"
      subtitle="Browse upcoming festivals, buy tickets, and experience live multi-stage events with commentary, voice chat, and watch rewards."
      icon={Music}
      backTo="/hub/events"
      headerActions={<Badge variant="secondary" className="text-[10px]">Live Experience</Badge>}
    >
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="browse" className="gap-2">
            <Ticket className="h-4 w-4" /> Browse & Tickets
          </TabsTrigger>
          <TabsTrigger value="live" className="gap-2" disabled={!liveFestivalId}>
            <Radio className="h-4 w-4" /> Live Festival
            {liveFestivalId && (
              <Badge variant="default" className="ml-1 text-xs animate-pulse">LIVE</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" /> History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="mt-4">
          <FestivalBrowser onSelectLive={handleGoLive} />
        </TabsContent>

        <TabsContent value="live" className="mt-4">
          {liveFestivalId ? (
            <LiveFestivalView festivalId={liveFestivalId} onBack={handleBackFromLive} />
          ) : (
            <div className="text-center text-muted-foreground py-12">
              <Radio className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Select a live festival from the browse tab to enter</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <FestivalHistoryTab />
        </TabsContent>
      </Tabs>
    </FMPageScaffold>
  );
}
