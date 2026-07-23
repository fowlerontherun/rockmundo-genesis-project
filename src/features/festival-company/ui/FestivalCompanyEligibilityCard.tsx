import { useMemo, useState, type FormEvent } from "react";
import { Tent, Crown, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useVipStatus } from "@/hooks/useVipStatus";
import { useFestivalFeatureFlags } from "../config/featureFlags";
import { useFoundFestivalCompany } from "../application/useFoundFestivalCompany";
import { FESTIVAL_FOUNDING_COST } from "../domain/festivalCompany";

const formatCurrency = (amount: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
const newKey = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

export const FestivalCompanyEligibilityCard = () => {
  const flags = useFestivalFeatureFlags();
  const { profile } = useActiveProfile();
  const { data: vipStatus, isLoading: vipLoading } = useVipStatus();
  const foundFestival = useFoundFestivalCompany();
  const [companyName, setCompanyName] = useState("");
  const [publicName, setPublicName] = useState("");
  const [description, setDescription] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(newKey);

  const personalCash = Number(profile?.cash ?? 0);
  const creationEnabled = flags.newFestivalSystemEnabled && flags.festivalCreationEnabled;
  const canSubmit = useMemo(() => (
    creationEnabled && Boolean(vipStatus?.isVip) && personalCash >= FESTIVAL_FOUNDING_COST && companyName.trim().length >= 3 && publicName.trim().length >= 3
  ), [creationEnabled, vipStatus?.isVip, personalCash, companyName, publicName]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    foundFestival.mutate({ companyName: companyName.trim(), publicName: publicName.trim(), description: description.trim() || undefined, idempotencyKey }, {
      onError: () => setIdempotencyKey(newKey()),
    });
  };

  return (
    <Card className="border-fuchsia-500/30 bg-fuchsia-500/5">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2"><Tent className="h-5 w-5 text-fuchsia-500" /> Festival Company</CardTitle>
            <CardDescription>VIP-only secure founding for annual music festival brands.</CardDescription>
          </div>
          <Badge variant="secondary" className="gap-1"><Crown className="h-3 w-3" /> VIP only</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border p-3"><div className="text-sm text-muted-foreground">Founding cost</div><div className="font-semibold">{formatCurrency(FESTIVAL_FOUNDING_COST)}</div></div>
          <div className="rounded-lg border p-3"><div className="text-sm text-muted-foreground">Company balance</div><div className="font-semibold">{formatCurrency(0)}</div></div>
          <div className="rounded-lg border p-3"><div className="text-sm text-muted-foreground">Personal cash</div><div className="font-semibold">{formatCurrency(personalCash)}</div></div>
        </div>
        <p className="text-sm text-muted-foreground flex gap-2"><DollarSign className="h-4 w-4 shrink-0" /> The $2,000,000 is a founding/setup expense charged from personal cash. It does not become company capital; owner funding transfers arrive in a later PR.</p>
        {!creationEnabled && <p className="text-sm text-amber-600">New festival creation is currently disabled by feature flag.</p>}
        {!vipLoading && !vipStatus?.isVip && <p className="text-sm text-amber-600">An active VIP subscription is required. The backend verifies VIP again during founding.</p>}
        {personalCash < FESTIVAL_FOUNDING_COST && <p className="text-sm text-amber-600">You do not currently have enough personal cash.</p>}
        <form onSubmit={onSubmit} className="space-y-3">
          <Input placeholder="Company legal name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
          <Input placeholder="Public festival name" value={publicName} onChange={(e) => setPublicName(e.target.value)} />
          <Textarea placeholder="Optional description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <Button type="submit" disabled={!canSubmit || foundFestival.isPending}>{foundFestival.isPending ? "Founding..." : "Found Festival Company"}</Button>
        </form>
      </CardContent>
    </Card>
  );
};
