import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Music, Ticket, Radio } from "lucide-react";
import { FestivalBrowser } from "@/components/festivals/FestivalBrowser";
import { LiveFestivalView } from "@/components/festivals/LiveFestivalView";

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
    <div className="container mx-auto px-4 py-6 space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <Music className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Festivals</h1>
          <Badge variant="secondary" className="text-xs">Live Experience</Badge>
        </div>
        <p className="text-muted-foreground max-w-2xl">
          Browse upcoming festivals, buy tickets, and experience live multi-stage events with commentary, voice chat, and watch rewards.
        </p>
      </header>

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
      </Tabs>
    </div>
  );
}
