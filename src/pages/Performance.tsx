import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Music4, Mic } from 'lucide-react';
import { GigPerformanceTab } from '@/components/performance/GigPerformanceTab';
import { JamSessionsTab } from '@/components/performance/JamSessionsTab';
import { BuskingTab } from '@/components/performance/BuskingTab';

export default function Performance() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'gigs';

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Performance</h1>
        <p className="text-muted-foreground">
          Choose how you want to perform: scheduled gigs, collaborative jams, or street busking.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="mb-6">
          <TabsTrigger value="gigs">
            <Calendar className="mr-2 h-4 w-4" />
            Gigs
          </TabsTrigger>
          <TabsTrigger value="jams">
            <Music4 className="mr-2 h-4 w-4" />
            Jam Sessions
          </TabsTrigger>
          <TabsTrigger value="busking">
            <Mic className="mr-2 h-4 w-4" />
            Busking
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gigs">
          <GigPerformanceTab />
        </TabsContent>

        <TabsContent value="jams">
          <JamSessionsTab />
        </TabsContent>

        <TabsContent value="busking">
          <BuskingTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
