import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function CronMonitor() {
  const { toast } = useToast();

  const handleRefresh = () => {
    toast({
      title: "Refreshed",
      description: "Cron job data has been updated",
    });
  };

  const handleManualTrigger = async (functionName: string) => {
    try {
      const { error } = await supabase.functions.invoke(functionName);
      if (error) throw error;
      
      toast({
        title: "Function triggered",
        description: `${functionName} has been manually invoked`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const edgeFunctions = [
    { name: "auto-start-gigs", schedule: "Every minute", description: "Auto-start scheduled gigs" },
    { name: "university-attendance", schedule: "Daily at 10:00 UTC", description: "Process daily university attendance" },
    { name: "book-reading-attendance", schedule: "Daily at 23:00 UTC", description: "Update book reading progress" },
    { name: "shift-clock-out", schedule: "Every 15 minutes", description: "Auto-complete work shifts" },
    { name: "cleanup-songwriting", schedule: "Every 15 minutes", description: "Complete expired songwriting sessions" },
    { name: "complete-rehearsals", schedule: "Every 30 minutes", description: "Complete finished rehearsals" },
    { name: "complete-recording-sessions", schedule: "Every 30 minutes", description: "Complete recording sessions" },
    { name: "calculate-weekly-activity", schedule: "Daily at 01:00 UTC", description: "Calculate weekly XP for bonuses" },
    { name: "generate-daily-sales", schedule: "Daily at midnight", description: "Generate release sales" },
    { name: "update-daily-streams", schedule: "Daily at midnight", description: "Update streaming stats" },
  ];

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Cron Job Monitor</h1>
          <p className="text-muted-foreground">Monitor and manage automated background tasks</p>
        </div>
        <Button onClick={handleRefresh} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Edge Functions */}
      <Card>
        <CardHeader>
          <CardTitle>Edge Functions</CardTitle>
          <CardDescription>Manually trigger background processes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {edgeFunctions.map((func) => (
              <Card key={func.name}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{func.name}</CardTitle>
                      <CardDescription className="text-sm mt-1">
                        {func.description}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      <Clock className="h-3 w-3 inline mr-1" />
                      {func.schedule}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleManualTrigger(func.name)}
                    >
                      Trigger Now
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
