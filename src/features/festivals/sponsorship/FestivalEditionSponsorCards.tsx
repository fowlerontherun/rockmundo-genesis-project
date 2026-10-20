import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SponsorIdentity } from "@/features/festival-company/ui/SponsorIdentity";
import { supabase } from "@/integrations/supabase/client";
import {
  parseEditionSponsorIdentities,
  type EditionSponsorIdentity,
} from "./model";

type RpcClient = {
  rpc(name: string, args: Record<string, unknown>): Promise<{
    data: unknown; error: { message: string } | null;
  }>;
};
const client = supabase as unknown as RpcClient;

const SponsorCard = ({ identity, role }: {
  identity: EditionSponsorIdentity | null;
  role: "main" | "supporting";
}) => (
  <div className="flex min-h-24 items-center gap-3 rounded-lg border p-3">
    {identity ? (
      <>
        <div className="w-24 shrink-0">
          <SponsorIdentity name={identity.name} logoReference={identity.logoUrl} />
        </div>
        <div className="min-w-0">
          <p className="font-semibold">{identity.name}</p>
          <p className="text-xs text-muted-foreground">
            {identity.category} · {identity.source === "npc_fallback" ? "Fictional NPC identity" : "Sponsor"}
          </p>
        </div>
      </>
    ) : (
      <p className="text-sm text-muted-foreground">
        {role === "main" ? "Main sponsor not yet assigned" : "Optional supporting sponsor slot"}
      </p>
    )}
  </div>
);

/** A compact owner view: no detailed sponsor CRM or invented financial promises. */
export function FestivalEditionSponsorCards({ editionId }: { editionId: string }) {
  const queryClient = useQueryClient();
  const queryKey = ["festival-edition-sponsors", editionId] as const;
  const sponsors = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await client.rpc("get_festival_edition_sponsor_identities", {
        p_festival_edition_id: editionId,
      });
      if (error) throw new Error(error.message);
      return parseEditionSponsorIdentities(data, editionId);
    },
  });
  const assign = useMutation({
    mutationFn: async () => {
      const { error } = await client.rpc("ensure_festival_edition_npc_main_sponsor", {
        p_festival_edition_id: editionId,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Festival sponsors</CardTitle>
        <CardDescription>
          One main sponsor and up to four supporting partners. These fictional brand
          identities do not create signed deals or extra sponsorship income.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {sponsors.isPending ? <p role="status">Loading festival sponsors…</p> : null}
        {sponsors.isError ? (
          <p role="alert" className="text-sm text-destructive">
            Sponsor assignments could not be loaded: {sponsors.error.message}
          </p>
        ) : null}
        {sponsors.data ? (
          <>
            <div className="space-y-2">
              <p className="text-sm font-medium">Main sponsor</p>
              <SponsorCard role="main" identity={sponsors.data.main} />
              {!sponsors.data.main ? (
                <Button size="sm" variant="outline" disabled={assign.isPending}
                  onClick={() => assign.mutate()}>
                  {assign.isPending ? "Assigning…" : "Choose automatic NPC main sponsor"}
                </Button>
              ) : null}
              {assign.isError ? (
                <p role="alert" className="text-sm text-destructive">
                  Could not allocate main sponsor: {assign.error.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Supporting sponsors (optional)</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {Array.from({ length: 4 }, (_, index) => (
                  <SponsorCard key={index} role="supporting"
                    identity={sponsors.data.supporting[index] ?? null} />
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Your existing automatic sponsorship forecast is unchanged.
              No money is credited by selecting a sponsor identity.
            </p>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
