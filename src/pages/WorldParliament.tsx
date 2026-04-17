import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Landmark } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MotionsList } from "@/components/parliament/MotionsList";
import { ProposeMotionDialog } from "@/components/parliament/ProposeMotionDialog";
import { MayorPayPanel } from "@/components/parliament/MayorPayPanel";
import { useParliamentMotions, useMyMayorSeat } from "@/hooks/useParliament";
import { MOTION_STATUS_COLOURS } from "@/types/parliament";
import { formatDistanceToNow } from "date-fns";

export default function WorldParliamentPage() {
  const { data: seat } = useMyMayorSeat();
  const { data: history } = useParliamentMotions("all");
  const [tab, setTab] = useState("floor");

  const { data: members } = useQuery({
    queryKey: ["parliament-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("city_mayors")
        .select("id, city_id, profile_id, approval_rating, term_end")
        .eq("is_current", true)
        .limit(200);
      if (error) throw error;
      const mayors = data ?? [];
      const profileIds = mayors.map((m) => m.profile_id);
      const cityIds = mayors.map((m) => m.city_id);

      const [{ data: profiles }, { data: cities }, { data: parties }] = await Promise.all([
        supabase.from("profiles").select("id, display_name, username, avatar_url").in("id", profileIds),
        supabase.from("cities").select("id, name, country").in("id", cityIds),
        supabase.from("party_memberships").select("profile_id, party_id, party:political_parties(name, colour_hex)").in("profile_id", profileIds),
      ]);

      const pMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
      const cMap = new Map((cities ?? []).map((c) => [c.id, c]));
      const partyMap = new Map((parties ?? []).map((pm: any) => [pm.profile_id, pm.party]));

      return mayors.map((m) => ({
        ...m,
        profile: pMap.get(m.profile_id),
        city: cMap.get(m.city_id),
        party: partyMap.get(m.profile_id),
      }));
    },
  });

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Landmark className="h-8 w-8 text-primary" />
            World Parliament
          </h1>
          <p className="text-sm text-muted-foreground">Where the world's mayors set global policy.</p>
        </div>
        {seat?.id && <ProposeMotionDialog />}
      </div>

      {!seat?.id && (
        <Card className="border-muted">
          <CardContent className="py-3 text-sm text-muted-foreground">
            You are observing as the public — only sitting mayors may table motions or vote.
          </CardContent>
        </Card>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="floor">Floor</TabsTrigger>
          <TabsTrigger value="pay">Mayor Pay</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="floor" className="space-y-3">
          <MotionsList />
        </TabsContent>

        <TabsContent value="pay">
          <MayorPayPanel />
        </TabsContent>

        <TabsContent value="members">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Sitting Mayors ({members?.length ?? 0})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(members ?? []).map((m: any) => (
                <div key={m.id} className="flex items-center justify-between p-2 rounded-md border border-border">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={m.profile?.avatar_url ?? undefined} />
                      <AvatarFallback>{(m.profile?.display_name ?? "?").slice(0, 2)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{m.profile?.display_name ?? m.profile?.username ?? "Unknown"}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {m.city?.name} · {m.city?.country}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {m.party && (
                      <Badge variant="outline" className="text-xs">
                        <span className="inline-block h-2 w-2 rounded-full mr-1" style={{ backgroundColor: m.party.colour_hex }} />
                        {m.party.name}
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-xs">{Math.round(Number(m.approval_rating ?? 0))}% approval</Badge>
                  </div>
                </div>
              ))}
              {(!members || members.length === 0) && <p className="text-sm text-muted-foreground">No sitting mayors yet.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Motion History</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(history ?? []).map((m) => (
                <div key={m.id} className="flex items-center justify-between p-2 rounded-md border border-border">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{m.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.yes_votes} yes · {m.no_votes} no · {m.abstain_votes} abstain · {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <Badge variant="outline" className={MOTION_STATUS_COLOURS[m.status]}>{m.status}</Badge>
                </div>
              ))}
              {(!history || history.length === 0) && <p className="text-sm text-muted-foreground">No motions yet.</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
