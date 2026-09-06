import { useQuery } from "@tanstack/react-query";
import { Building2, Flame, Loader2, MapPin, Radio, ShieldAlert, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";

type Rival = { cityId: string; cityName: string; name: string; intensity: number; description: string };
type CitySceneResponse = {
  ok: boolean;
  reason?: string;
  cityId?: string;
  cityName?: string;
  country?: string;
  scene?: {
    name: string;
    tagline: string;
    styles: string[];
    tags: string[];
    riskLevel: number;
    mediaAttention: number;
    authorityPressure: number;
    networkingStrength: number;
    undergroundDepth: number;
    flagship: boolean;
  };
  reputation?: number;
  visits?: number;
  successfulStories?: number;
  failedStories?: number;
  rivals?: Rival[];
};

export const CityScenePanel = ({ profileId }: { profileId: string | null }) => {
  const query = useQuery({
    queryKey: ["city-underground-scene", profileId],
    enabled: Boolean(profileId),
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_current_city_scene", { p_profile_id: profileId });
      if (error) throw error;
      return data as CitySceneResponse;
    },
  });

  if (!profileId) return null;
  if (query.isLoading) return <Card><CardContent className="flex items-center justify-center py-5 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Reading the local scene...</CardContent></Card>;
  if (!query.data?.ok || !query.data.scene) return null;

  const data = query.data;
  const scene = data.scene;
  const rep = data.reputation ?? 0;
  const repLabel = rep >= 80 ? "Local legend" : rep >= 60 ? "Scene fixture" : rep >= 40 ? "Known face" : rep >= 20 ? "Getting noticed" : "Outsider";

  return (
    <Card className="border-primary/25 bg-primary/[0.025]">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base"><MapPin className="h-4 w-4 text-primary" /> {scene.name}</CardTitle>
            <CardDescription className="mt-1">{scene.tagline}</CardDescription>
          </div>
          {scene.flagship && <Badge variant="secondary">Flagship scene</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="mb-1 flex items-center justify-between text-xs"><span className="font-medium">Local reputation · {repLabel}</span><span>{rep}/100</span></div>
          <Progress value={rep} className="h-2" />
          <p className="mt-1 text-[11px] text-muted-foreground">Built by completing Scene Stories in {data.cityName}. Reputation stays with this city when you travel.</p>
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <div className="rounded-lg border p-2"><div className="flex items-center gap-1 text-[11px] text-muted-foreground"><Flame className="h-3 w-3" /> Risk</div><div className="font-semibold">{scene.riskLevel}/5</div></div>
          <div className="rounded-lg border p-2"><div className="flex items-center gap-1 text-[11px] text-muted-foreground"><Radio className="h-3 w-3" /> Media</div><div className="font-semibold">{scene.mediaAttention}</div></div>
          <div className="rounded-lg border p-2"><div className="flex items-center gap-1 text-[11px] text-muted-foreground"><ShieldAlert className="h-3 w-3" /> Authority</div><div className="font-semibold">{scene.authorityPressure}</div></div>
          <div className="rounded-lg border p-2"><div className="flex items-center gap-1 text-[11px] text-muted-foreground"><Users className="h-3 w-3" /> Network</div><div className="font-semibold">{scene.networkingStrength}</div></div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {scene.styles.map((style) => <Badge key={style} variant="outline" className="text-[10px]">{style}</Badge>)}
          {scene.tags.slice(0, 4).map((tag) => <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>)}
        </div>

        {(data.rivals ?? []).length > 0 && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
            <div className="flex items-center gap-2 text-xs font-medium"><Building2 className="h-3.5 w-3.5" /> Scene rivalries</div>
            <div className="mt-2 space-y-1.5">
              {(data.rivals ?? []).map((rival) => <div key={rival.cityId} className="text-xs"><span className="font-medium">{rival.cityName}</span> · {rival.name} <span className="text-muted-foreground">({rival.intensity}/100)</span></div>)}
            </div>
          </div>
        )}

        <div className="text-[11px] text-muted-foreground">Scene activity: {data.successfulStories ?? 0} successful stories · {data.failedStories ?? 0} messy outcomes</div>
      </CardContent>
    </Card>
  );
};
