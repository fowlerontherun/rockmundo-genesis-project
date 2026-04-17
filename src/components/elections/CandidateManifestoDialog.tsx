import { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ScrollText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ManifestoPlank } from "@/hooks/usePartyManifesto";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateName: string;
  partyIds: string[];
  partyNameMap: Record<string, { name: string; colour_hex: string }>;
}

interface PartyManifestoBundle {
  party_id: string;
  planks: ManifestoPlank[];
}

export function CandidateManifestoDialog({
  open,
  onOpenChange,
  candidateName,
  partyIds,
  partyNameMap,
}: Props) {
  const sortedIds = useMemo(() => [...partyIds].sort(), [partyIds]);

  const { data, isLoading } = useQuery({
    queryKey: ["candidate-manifestos", sortedIds.join(",")],
    queryFn: async (): Promise<PartyManifestoBundle[]> => {
      if (sortedIds.length === 0) return [];
      const { data, error } = await supabase
        .from("party_manifestos")
        .select("*")
        .in("party_id", sortedIds)
        .order("position_order", { ascending: true });
      if (error) throw error;

      const grouped = new Map<string, ManifestoPlank[]>();
      for (const id of sortedIds) grouped.set(id, []);
      for (const row of (data ?? []) as ManifestoPlank[]) {
        grouped.get(row.party_id)?.push(row);
      }
      return sortedIds.map((id) => ({ party_id: id, planks: grouped.get(id) ?? [] }));
    },
    enabled: open && sortedIds.length > 0,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScrollText className="h-5 w-5" />
            Platforms backing {candidateName}
          </DialogTitle>
          <DialogDescription>
            Each endorsing party's published manifesto. A vote for this candidate is, in part, a
            vote for these platforms.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-3">
          {isLoading ? (
            <div className="animate-pulse space-y-2">
              <div className="h-20 bg-muted rounded" />
              <div className="h-20 bg-muted rounded" />
            </div>
          ) : (data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No endorsing party has published a manifesto yet.
            </p>
          ) : (
            <div className="space-y-5">
              {(data ?? []).map((bundle) => {
                const meta = partyNameMap[bundle.party_id];
                return (
                  <div key={bundle.party_id} className="space-y-2">
                    <div className="flex items-center gap-2 pb-1 border-b border-border">
                      <span
                        className="inline-block h-3 w-3 rounded-full"
                        style={{ backgroundColor: meta?.colour_hex ?? "hsl(var(--muted-foreground))" }}
                      />
                      <h4 className="font-semibold text-sm">{meta?.name ?? "Unknown party"}</h4>
                      <Badge variant="outline" className="text-[10px] ml-auto">
                        {bundle.planks.length} planks
                      </Badge>
                    </div>
                    {bundle.planks.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic pl-5">
                        This party has not published a manifesto.
                      </p>
                    ) : (
                      <ul className="space-y-1.5">
                        {bundle.planks.map((p) => (
                          <li key={p.id} className="text-xs pl-5">
                            <div className="flex items-baseline gap-2">
                              <Badge variant="secondary" className="text-[10px] flex-shrink-0">
                                {p.topic}
                              </Badge>
                              <span className="font-medium">{p.position}</span>
                            </div>
                            {p.details && (
                              <p className="text-muted-foreground mt-0.5 ml-1">{p.details}</p>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
