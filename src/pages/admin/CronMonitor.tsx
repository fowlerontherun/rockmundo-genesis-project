import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Clock, AlertCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

interface CronJob {
  jobid: number;
  schedule: string;
  command: string;
  nodename: string;
  nodeport: number;
  database: string;
  username: string;
  active: boolean;
  jobname: string;
}

interface CronJobStats {
  runid: bigint;
  jobid: number;
  job_pid: number;
  database: string;
  username: string;
  command: string;
  status: string;
  return_message: string;
  start_time: string;
  end_time: string;
}

export default function CronMonitor() {
  const { toast } = useToast();

  const { data: cronJobs, isLoading: jobsLoading, refetch: refetchJobs } = useQuery({
    queryKey: ["cron-jobs"],
    queryFn: async () => {
      // Since we can't query cron.job directly via Supabase client,
      // we'll return a placeholder for now
      return [] as CronJob[];
    },
  });

  const { data: jobStats, refetch: refetchStats } = useQuery({
    queryKey: ["cron-job-stats"],
    queryFn: async () => {
      // Since we can't query cron.job_run_details directly via Supabase client,
      // we'll return a placeholder for now
      return [] as CronJobStats[];
    },
  });

  const handleRefresh = () => {
    refetchJobs();
    refetchStats();
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
    { name: "university-attendance", schedule: "Daily at 10:00 UTC", description: "Process daily university attendance" },
    { name: "book-reading-attendance", schedule: "Daily at 23:00 UTC", description: "Update book reading progress" },
    { name: "shift-clock-out", schedule: "Every 15 minutes", description: "Auto-complete work shifts" },
    { name: "cleanup-songwriting", schedule: "Every 15 minutes", description: "Complete expired songwriting sessions" },
    { name: "complete-rehearsals", schedule: "Every 30 minutes", description: "Complete finished rehearsals" },
    { name: "complete-recording-sessions", schedule: "Every 30 minutes", description: "Complete recording sessions" },
    { name: "calculate-weekly-activity", schedule: "Daily at 01:00 UTC", description: "Calculate weekly XP for bonuses" },
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

      {/* Database Cron Jobs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Database Cron Jobs
          </CardTitle>
          <CardDescription>Scheduled tasks running in PostgreSQL</CardDescription>
        </CardHeader>
        <CardContent>
          {jobsLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading cron jobs...</div>
          ) : cronJobs && cronJobs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job Name</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Database</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cronJobs.map((job) => (
                  <TableRow key={job.jobid}>
                    <TableCell className="font-medium">{job.jobname}</TableCell>
                    <TableCell className="font-mono text-sm">{job.schedule}</TableCell>
                    <TableCell>
                      {job.active ? (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{job.database}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No cron jobs configured in database
            </div>
          )}
        </CardContent>
      </Card>

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

      {/* Recent Job Runs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Job Runs</CardTitle>
          <CardDescription>Last execution results from cron jobs</CardDescription>
        </CardHeader>
        <CardContent>
          {jobStats && jobStats.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Command</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Start Time</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobStats.slice(0, 10).map((stat) => (
                  <TableRow key={stat.runid.toString()}>
                    <TableCell className="font-mono text-xs max-w-xs truncate">
                      {stat.command}
                    </TableCell>
                    <TableCell>
                      {stat.status === 'succeeded' ? (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Success
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Failed
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDistanceToNow(new Date(stat.start_time), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-sm">
                      {stat.end_time 
                        ? `${((new Date(stat.end_time).getTime() - new Date(stat.start_time).getTime()) / 1000).toFixed(2)}s`
                        : 'Running...'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                      {stat.return_message || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No recent job runs found
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
