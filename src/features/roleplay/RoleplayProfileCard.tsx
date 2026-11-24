import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Drama } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export type RoleplaySettings = { profile_id: string; mood: string | null; hooks: string | null; rp_enabled: boolean; open_romance: boolean; open_rivalry: boolean; open_collab: boolean };

export function useRoleplaySettings(profileId?: string | null) {
  return useQuery({
    queryKey: ["roleplay-settings", profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("profile_roleplay_settings").select("*").eq("profile_id", profileId).maybeSingle();
      if (error) throw error;
      return (data ?? null) as RoleplaySettings | null;
    },
  });
}

export function RoleplayProfileCard({ profileId, isOwn }: { profileId: string; isOwn?: boolean }) {
  const { data } = useRoleplaySettings(profileId);
  if (!data && !isOwn) return null;
  return (
    <Card>
      <CardContent className="space-y-1 p-3 text-xs">
        <div className="flex items-center gap-2 font-semibold"><Drama className="h-4 w-4 text-primary" />Roleplay
          {isOwn && <Link className="ml-auto text-[11px] font-normal underline" to="/social/roleplay?tab=profile">Edit</Link>}</div>
        {!data ? <p className="text-muted-foreground">Set your mood and roleplay hooks so others know how to approach you.</p> : !data.rp_enabled ? <p className="text-muted-foreground">Not roleplaying right now.</p> : <>
          {data.mood && <p><span className="text-muted-foreground">Mood:</span> {data.mood}</p>}
          {data.hooks && <p className="whitespace-pre-line">{data.hooks}</p>}
          <div className="flex flex-wrap gap-1 pt-1">
            {data.open_collab && <Badge variant="outline" className="text-[10px]">Open to collabs</Badge>}
            {data.open_rivalry && <Badge variant="outline" className="text-[10px]">Open to rivalries</Badge>}
            {data.open_romance && <Badge variant="outline" className="text-[10px]">Open to romance</Badge>}
          </div></>}
      </CardContent>
    </Card>
  );
}
