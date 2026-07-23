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
import { useFestivalCompanyFoundingEligibility } from "../application/useFestivalCompanyCapabilities";
import { FESTIVAL_FOUNDING_COST } from "../domain/festivalCompany";

const formatCurrency = (amount: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
const newKey = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

export const FestivalCompanyEligibilityCard = () => {
  const flags = useFestivalFeatureFlags();
  const { profile } = useActiveProfile();
  const { data: vipStatus, isLoading: vipLoading } = useVipStatus();
  const { data: eligibility, isLoading: capabilitiesLoading } = useFestivalCompanyFoundingEligibility();
  const foundFestival = useFoundFestivalCompany();
  const [companyName, setCompanyName] = useState("");
  const [publicName, setPublicName] = useState("");
  const [description, setDescription] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(newKey);

  const personalCash = Number(eligibility?.authoritativePersonalBalance ?? profile?.cash ?? 0);
  const localCreationEnabled = flags.newFestivalSystemEnabled && flags.festivalCreationEnabled;
  const serverSystemEnabled = Boolean(eligibility?.newFestivalSystemEnabled);
  const serverCreationEnabled = Boolean(eligibility?.festivalCompanyCreationEnabled);
  const effectiveVip = Boolean(eligibility?.vipEligible ?? vipStatus?.isVip);
  const canSubmit = useMemo(() => (
    localCreationEnabled && !capabilitiesLoading && serverSystemEnabled && serverCreationEnabled && effectiveVip && Boolean(eligibility?.canAfford) && Boolean(eligibility?.canFoundCompany) && companyName.trim().length >= 3 && publicName.trim().length >= 3
  ), [localCreationEnabled, capabilitiesLoading, serverSystemEnabled, serverCreationEnabled, effectiveVip, eligibility?.canAfford, eligibility?.canFoundCompany, companyName, publicName]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    foundFestival.mutate({ companyName: companyName.trim(), publicName: publicName.trim(), description: description.trim() || undefined, idempotencyKey }, {
      onSuccess: () => {
        setCompanyName("");
        setPublicName("");
        setDescription("");
        setIdempotencyKey(newKey());
      },
      onError: (error) => {
        if (error.message.includes("idempotency_conflict")) setIdempotencyKey(newKey());
      },
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
        {capabilitiesLoading && <p className="text-sm text-muted-foreground">Checking server festival creation capabilities...</p>}
        {!localCreationEnabled && <p className="text-sm text-amber-600">Festival creation is disabled by the local emergency UI flag.</p>}
        {!capabilitiesLoading && !serverSystemEnabled && <p className="text-sm text-amber-600">The replacement festival system is disabled on the server.</p>}
        {!capabilitiesLoading && serverSystemEnabled && !serverCreationEnabled && <p className="text-sm text-amber-600">Festival company creation is paused on the server.</p>}
        {!vipLoading && !effectiveVip && <p className="text-sm text-amber-600">An active VIP subscription is required. The backend verifies VIP again during founding.</p>}
        {eligibility && !eligibility.canAfford && <p className="text-sm text-amber-600">You do not currently have enough authoritative personal cash.</p>}
        {eligibility && !eligibility.canFoundCompany && eligibility.companyLimitReason === "company_limit_reached" && <p className="text-sm text-amber-600">Company limit reached ({eligibility.ownedCompanyCount}/{eligibility.companyLimit}).</p>}
        {canSubmit && <p className="text-sm text-emerald-600">Eligible to found a festival company.</p>}
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
