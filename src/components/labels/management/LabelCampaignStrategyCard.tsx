import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Target, Radio, ListMusic, Share2, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

interface Props { labelId: string; }

const FOCUS = [
  { id: "balanced", name: "Balanced", desc: "Even split across discovery and conversion." },
  { id: "radio", name: "Radio Push", desc: "More broadcast-style discovery; slight sales lift." },
  { id: "playlist", name: "Playlist Push", desc: "Strongest streaming lift; weaker physical conversion." },
  { id: "social", name: "Social / Viral", desc: "Strong streaming and moderate sales discovery." },
  { id: "retail", name: "Retail / Physical", desc: "Strongest physical and digital purchase conversion." },
] as const;

export function LabelCampaignStrategyCard({ labelId }: Props) {
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["label-marketing-strategy", labelId],
    queryFn: async () => {
      const [{ data: label, error: lErr }, { data: contracts, error: cErr }] = await Promise.all([
        supabase.from("labels").select("priority_release_id, marketing_focus, marketing_regions").eq("id", labelId).single(),
        supabase.from("artist_label_contracts").select("id").eq("label_id", labelId).eq("status", "active"),
      ]);
      if (lErr) throw lErr;
      if (cErr) throw cErr;
      const ids = (contracts || []).map(c => c.id);
      let releases: any[] = [];
      if (ids.length) {
        const { data: rows, error } = await supabase
          .from("releases")
          .select("id,title,release_type,release_status,manufacturing_complete_at")
          .in("label_contract_id", ids)
          .in("release_status", ["released", "manufacturing"])
          .order("created_at", { ascending: false });
        if (error) throw error;
        releases = rows || [];
      }
      return { label: label as any, releases };
    },
  });

  const current = data?.label;
  const [priority, setPriority] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [regions, setRegions] = useState<string | null>(null);

  const selectedPriority = priority ?? current?.priority_release_id ?? "none";
  const selectedFocus = focus ?? current?.marketing_focus ?? "balanced";
  const regionText = regions ?? ((current?.marketing_regions || ["global"]) as string[]).join(", ");

  const save = useMutation({
    mutationFn: async () => {
      const parsedRegions = regionText.split(",").map(s => s.trim()).filter(Boolean);
      const { error } = await (supabase as any).rpc("set_label_marketing_strategy", {
        p_label_id: labelId,
        p_priority_release_id: selectedPriority === "none" ? null : selectedPriority,
        p_focus: selectedFocus,
        p_regions: parsedRegions.length ? parsedRegions : ["global"],
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["label-marketing-strategy", labelId] });
      queryClient.invalidateQueries({ queryKey: ["label-management"] });
      setPriority(null); setFocus(null); setRegions(null);
      toast.success("Marketing strategy updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const focusInfo = useMemo(() => FOCUS.find(x => x.id === selectedFocus) ?? FOCUS[0], [selectedFocus]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Target className="h-4 w-4" /> Campaign Strategy</CardTitle>
        <CardDescription>
          Concentrate 65% of the general label budget on one priority release; the remaining 35% supports the rest of the active roster.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Priority release</Label>
          <Select value={selectedPriority} onValueChange={setPriority}>
            <SelectTrigger><SelectValue placeholder="No priority release" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No priority — spread budget evenly</SelectItem>
              {(data?.releases || []).map((r: any) => (
                <SelectItem key={r.id} value={r.id}>{r.title} · {r.release_type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Campaign focus</Label>
          <Select value={selectedFocus} onValueChange={setFocus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {FOCUS.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{focusInfo.desc}</p>
        </div>

        <div className="space-y-2">
          <Label>Target markets</Label>
          <Input value={regionText} onChange={e => setRegions(e.target.value)} placeholder="global or UK, USA, Germany" />
          <p className="text-xs text-muted-foreground">Comma-separated countries/markets. Use “global” for worldwide campaigns.</p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline"><Radio className="h-3 w-3 mr-1" /> Radio</Badge>
          <Badge variant="outline"><ListMusic className="h-3 w-3 mr-1" /> Playlists</Badge>
          <Badge variant="outline"><Share2 className="h-3 w-3 mr-1" /> Social</Badge>
          <Badge variant="outline"><ShoppingBag className="h-3 w-3 mr-1" /> Retail</Badge>
        </div>

        <p className="text-xs text-muted-foreground">
          Repeated heavy promotion builds audience saturation, reducing the marginal return of additional spend. Pausing or shifting campaigns lets that pressure fall over time.
        </p>

        <Button className="w-full" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Saving..." : "Save Campaign Strategy"}
        </Button>
      </CardContent>
    </Card>
  );
}
