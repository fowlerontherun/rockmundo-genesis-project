import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Guitar, Mic } from "lucide-react";

export function ClassifiedAds() {
  const { data: ads } = useQuery({
    queryKey: ["classified-ads"],
    queryFn: async () => {
      const items: Array<{ type: string; title: string; detail: string }> = [];

      // Band member ads
      const { data: memberAds } = await supabase
        .from("band_member_ads")
        .select("instrument_role, vocal_role, description, bands(name)")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(6);

      memberAds?.forEach((ad: any) => {
        items.push({
          type: "wanted",
          title: `WANTED: ${ad.instrument_role}${ad.vocal_role ? ` / ${ad.vocal_role}` : ""} for ${ad.bands?.name || "a band"}`,
          detail: ad.description || "Serious inquiries only.",
        });
      });

      // Open band invitations
      const { data: invites } = await supabase
        .from("band_invitations")
        .select("instrument_role, vocal_role, bands(name)")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(4);

      invites?.forEach((inv: any) => {
        items.push({
          type: "opportunity",
          title: `${inv.bands?.name || "A band"} looking for ${inv.instrument_role}`,
          detail: inv.vocal_role ? `Vocal role: ${inv.vocal_role}` : "Join an active band!",
        });
      });

      return items.slice(0, 8);
    },
    staleTime: 10 * 60 * 1000,
  });

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-serif flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Classifieds
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {ads && ads.length > 0 ? (
          ads.map((ad, i) => (
            <div key={i} className="border border-dashed border-border rounded px-3 py-2">
              <div className="flex items-center gap-1.5 mb-0.5">
                {ad.type === "wanted" ? (
                  <Guitar className="h-3 w-3 text-primary" />
                ) : (
                  <Mic className="h-3 w-3 text-primary" />
                )}
                <p className="text-xs font-bold uppercase tracking-wide">{ad.title}</p>
              </div>
              <p className="text-[11px] text-muted-foreground">{ad.detail}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground italic font-serif py-2">
            No classifieds today.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
