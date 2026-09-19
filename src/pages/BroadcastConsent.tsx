import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, ShieldCheck, Tv } from "lucide-react";
import { getMyTotpBroadcastConsent, setMyTotpBroadcastConsent } from "@/features/top-of-the-pops/complianceApi";

const SCOPE_LABELS: Record<string, string> = {
  band_name: "Your band and character names",
  avatar: "Your character's look and outfits",
  recording: "Your recordings as performed on the show",
  lyrics: "Your song titles and lyrics shown on screen",
};

function formatWhen(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

export default function BroadcastConsent() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const consent = useQuery({
    queryKey: ["totp", "my-consent"],
    queryFn: getMyTotpBroadcastConsent,
  });

  const update = useMutation({
    mutationFn: (granted: boolean) => setMyTotpBroadcastConsent(granted),
    onSuccess: (data) => {
      queryClient.setQueryData(["totp", "my-consent"], data);
      toast({
        title: data.granted ? "Permission given" : "Permission withdrawn",
        description: data.granted
          ? "Your acts can now appear in episodes published outside the game."
          : "Your acts will be left out of anything published outside the game.",
      });
    },
    onError: (error: Error) =>
      toast({ title: "Could not save your choice", description: error.message, variant: "destructive" }),
  });

  const granted = consent.data?.granted ?? false;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <div>
        <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
          <Tv className="h-4 w-4" /> Television
        </div>
        <h1 className="text-3xl font-bold">Broadcast permission</h1>
        <p className="text-muted-foreground">
          Top of the Pops episodes can be published outside the game as videos. Nothing of yours is used out there
          unless you say yes here.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShieldCheck className="h-4 w-4" /> Your choice
              </CardTitle>
              <CardDescription>You can change this at any time, and it applies to all of your characters.</CardDescription>
            </div>
            <Badge variant={granted ? "secondary" : "outline"}>{granted ? "Permission given" : "Not given"}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {consent.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading your choice…</p>
          ) : consent.isError ? (
            <p className="text-sm text-destructive">{(consent.error as Error).message}</p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4 rounded-md bg-muted/40 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Let my acts appear in published episodes</p>
                  <p className="text-xs text-muted-foreground">
                    Without this, your band is left out of any episode published outside the game, and you keep every
                    reward you earned in the game.
                  </p>
                </div>
                <Switch
                  checked={granted}
                  disabled={update.isPending}
                  onCheckedChange={(next) => update.mutate(next)}
                  data-totp-consent-toggle
                />
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  What this covers
                </p>
                <ul className="space-y-1">
                  {(consent.data?.scopes ?? []).map((scope) => (
                    <li key={scope} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      <span>{SCOPE_LABELS[scope] ?? scope}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Separator />

              <div className="space-y-1 text-xs text-muted-foreground">
                {formatWhen(consent.data?.granted_at ?? null) ? (
                  <p>Permission given on {formatWhen(consent.data?.granted_at ?? null)}.</p>
                ) : null}
                {!granted && formatWhen(consent.data?.withdrawn_at ?? null) ? (
                  <p>Permission withdrawn on {formatWhen(consent.data?.withdrawn_at ?? null)}.</p>
                ) : null}
                <p>
                  If you withdraw permission after an episode has been published, tell us and the act is removed or
                  replaced in that episode. Your in-game fame, money and chart placings are never taken away.
                </p>
              </div>

              <Button variant="outline" size="sm" disabled={update.isPending} onClick={() => update.mutate(!granted)}>
                {granted ? "Withdraw permission" : "Give permission"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
