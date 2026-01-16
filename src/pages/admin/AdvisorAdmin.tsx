import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MessageSquare, TrendingUp, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { format, differenceInMilliseconds } from "date-fns";
import { useMemo } from "react";

// Component to calculate real stats
const AdvisorStats = ({ chatSessions, insights }: { chatSessions: any[]; insights: any[] }) => {
  // Calculate average response time from consecutive messages
  const avgResponseTime = useMemo(() => {
    if (chatSessions.length < 2) return "—";
    
    // Sort by band and time to find response pairs
    const sortedChats = [...chatSessions].sort((a, b) => {
      if (a.band_id !== b.band_id) return a.band_id.localeCompare(b.band_id);
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
    
    let totalTime = 0;
    let pairCount = 0;
    
    for (let i = 1; i < sortedChats.length; i++) {
      if (sortedChats[i].band_id === sortedChats[i - 1].band_id) {
        const diff = differenceInMilliseconds(
          new Date(sortedChats[i].created_at),
          new Date(sortedChats[i - 1].created_at)
        );
        // Only count if response was within 5 minutes (likely a conversation)
        if (diff > 0 && diff < 300000) {
          totalTime += diff;
          pairCount++;
        }
      }
    }
    
    if (pairCount === 0) return "—";
    const avgMs = totalTime / pairCount;
    return avgMs < 1000 ? `${Math.round(avgMs)}ms` : `${(avgMs / 1000).toFixed(1)}s`;
  }, [chatSessions]);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Total Conversations</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{chatSessions.length}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Active Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{insights.length}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Avg Response Time</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{avgResponseTime}</p>
        </CardContent>
      </Card>
    </div>
  );
};

const AdvisorAdmin = () => {
  const { data: chatSessions = [] } = useQuery({
    queryKey: ["admin-advisor-chats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("band_chat_messages")
        .select("*, bands(name)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: insights = [] } = useQuery({
    queryKey: ["admin-insights"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("game_insights")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <MessageSquare className="h-8 w-8" />
          Advisor Administration
        </h1>
        <p className="text-muted-foreground">Monitor AI advisor usage and insights</p>
      </div>

      <Tabs defaultValue="chats">
        <TabsList>
          <TabsTrigger value="chats">Recent Chats</TabsTrigger>
          <TabsTrigger value="insights">Game Insights</TabsTrigger>
          <TabsTrigger value="stats">Statistics</TabsTrigger>
        </TabsList>

        <TabsContent value="chats">
          <Card>
            <CardHeader>
              <CardTitle>Recent Advisor Conversations</CardTitle>
              <CardDescription>Latest messages from band chat</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Band</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {chatSessions.map((chat: any) => (
                    <TableRow key={chat.id}>
                      <TableCell>{chat.bands?.name}</TableCell>
                      <TableCell className="max-w-md truncate">{chat.message}</TableCell>
                      <TableCell>{format(new Date(chat.created_at), "PPp")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights">
          <Card>
            <CardHeader>
              <CardTitle>Game Insights</CardTitle>
              <CardDescription>System-generated insights for advisors</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {insights.map((insight: any) => (
                  <Card key={insight.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{insight.insight_type}</CardTitle>
                        <Badge>{insight.priority || "normal"}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm">{JSON.stringify(insight.data)}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {format(new Date(insight.created_at), "PPp")}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats">
          <AdvisorStats chatSessions={chatSessions} insights={insights} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdvisorAdmin;
