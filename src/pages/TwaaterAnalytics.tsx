import { useGameData } from "@/hooks/useGameData";
import { useTwaaterAccount } from "@/hooks/useTwaaterAccount";
import { useTwaaterAnalytics } from "@/hooks/useTwaaterAnalytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, BarChart3, Eye, Heart, MessageCircle, Repeat2, TrendingUp, Users, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const StatCard = ({ icon: Icon, label, value, hint }: { icon: any; label: string; value: string | number; hint?: string }) => (
  <Card>
    <CardContent className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="text-2xl font-bold">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </CardContent>
  </Card>
);

export default function TwaaterAnalytics() {
  const { profile } = useGameData();
  const { account } = useTwaaterAccount("persona", profile?.id);
  const { data, isLoading } = useTwaaterAnalytics(account?.id);

  if (!account) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">You need a Twaater account first.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "hsl(var(--twaater-bg))" }}>
      <div className="max-w-5xl mx-auto p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/twaater"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Link>
          </Button>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <BarChart3 className="h-5 w-5" /> Analytics
          </h1>
          <Badge variant="outline" className="ml-2">@{account.handle}</Badge>
          <Badge variant="secondary" className="ml-auto">Last 30 days</Badge>
        </div>

        {isLoading || !data ? (
          <Card><CardContent className="p-6 text-center text-muted-foreground">Loading…</CardContent></Card>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <StatCard icon={MessageCircle} label="Twaats" value={data.totals.twaats} />
              <StatCard icon={Eye} label="Views" value={data.totals.views.toLocaleString()} />
              <StatCard icon={Heart} label="Likes" value={data.totals.likes.toLocaleString()} />
              <StatCard icon={Repeat2} label="Retwaats" value={data.totals.retwaats.toLocaleString()} />
              <StatCard icon={MessageCircle} label="Replies" value={data.totals.replies.toLocaleString()} />
              <StatCard icon={Users} label="Followers" value={data.totals.followers.toLocaleString()} />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" /> Engagement rate
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{data.engagementRate.toFixed(2)}%</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    (likes + retwaats + replies) / views
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-4 w-4" /> Best hour to post
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {data.bestHourToPost !== null ? `${data.bestHourToPost}:00` : "Not enough data"}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Hour of day with highest avg engagement (≥2 posts).
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Follower growth</CardTitle>
              </CardHeader>
              <CardContent>
                {data.followerGrowth.length > 0 ? (
                  <div style={{ width: "100%", height: 220 }}>
                    <ResponsiveContainer>
                      <LineChart data={data.followerGrowth}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="followers" stroke="hsl(var(--twaater-purple))" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No followers yet.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Engagement by hour</CardTitle>
              </CardHeader>
              <CardContent>
                <div style={{ width: "100%", height: 200 }}>
                  <ResponsiveContainer>
                    <BarChart data={data.hourlyEngagement}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="avgEngagement" fill="hsl(var(--twaater-purple))" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Top performing twaats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.topTwaats.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No posts yet.</p>
                ) : (
                  data.topTwaats.map((t) => (
                    <div key={t.id} className="border rounded-md p-3 space-y-1">
                      <p className="text-sm line-clamp-2">{t.body}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> {t.likes}</span>
                        <span className="flex items-center gap-1"><Repeat2 className="h-3 w-3" /> {t.retwaats}</span>
                        <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {t.replies}</span>
                        <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {t.views}</span>
                        <span className="ml-auto">Score: {t.score.toFixed(1)}</span>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
