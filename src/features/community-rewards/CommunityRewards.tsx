import { useEffect, useMemo, useState } from "react";
import { Copy, Gift, Loader2, ShieldCheck, Users, ExternalLink, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const DISCORD_INVITE_URL = "https://discord.gg/KB45k3XJuZ";
const FACEBOOK_URL = import.meta.env.VITE_ROCKMUNDO_FACEBOOK_URL as string | undefined;

type Reward = {
  xp: number;
  ap: number;
  cash: number;
  player_fame: number;
  band_fame: number;
};

type Dashboard = {
  code: string;
  stats: {
    joined: number;
    qualified: number;
    signup_rewarded: number;
    vip_paid: number;
    vip_rewarded: number;
  };
  pending: { signup: number; vip: number };
  rewards: Record<string, Reward>;
  discord: { verified: boolean; rewarded: boolean; verified_at?: string | null };
};

const rewardSummary = (reward?: Reward) => {
  if (!reward) return "Reward unavailable";
  return `${reward.xp.toLocaleString()} XP · ${reward.ap} AP · $${reward.cash.toLocaleString()} · +${reward.player_fame} player fame · +${reward.band_fame} band fame`;
};

export default function CommunityRewards({ profileId }: { profileId?: string | null }) {
  const { toast } = useToast();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [discordLoading, setDiscordLoading] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [binding, setBinding] = useState(false);

  const loadDashboard = async () => {
    if (!profileId) {
      setDashboard(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await (supabase as any).rpc("get_referral_dashboard", { p_profile_id: profileId });
    if (error) {
      toast({ title: "Unable to load rewards", description: error.message, variant: "destructive" });
    } else {
      setDashboard(data as Dashboard);
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadDashboard();
  }, [profileId]);

  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get("discord");
    if (!status) return;
    const messages: Record<string, { title: string; description: string; destructive?: boolean }> = {
      verified: { title: "Discord verified", description: "Your Discord membership is verified. Claim the reward below." },
      not_member: { title: "Join the Discord first", description: "We couldn't find your Discord account in the RockMundo server." },
      already_linked: { title: "Discord account already used", description: "That Discord account has already verified another RockMundo account.", destructive: true },
      oauth_failed: { title: "Discord verification failed", description: "Discord sign-in did not complete. Please try again.", destructive: true },
      verification_failed: { title: "Discord verification failed", description: "We couldn't verify membership. Please try again.", destructive: true },
    };
    const message = messages[status];
    if (message) toast({ title: message.title, description: message.description, variant: message.destructive ? "destructive" : "default" });
    if (status === "verified") void loadDashboard();
  }, []);

  const referralUrl = useMemo(() => dashboard?.code ? `${window.location.origin}/auth?ref=${encodeURIComponent(dashboard.code)}` : "", [dashboard?.code]);
  const totalClaimable = (dashboard?.pending.signup ?? 0) + (dashboard?.pending.vip ?? 0) + (dashboard?.discord.verified && !dashboard.discord.rewarded ? 1 : 0);

  const copy = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    toast({ title: `${label} copied` });
  };

  const claim = async () => {
    if (!profileId) return;
    setClaiming(true);
    const { data, error } = await (supabase as any).rpc("claim_referral_rewards", { p_profile_id: profileId });
    setClaiming(false);
    if (error) {
      toast({ title: "Reward claim failed", description: error.message, variant: "destructive" });
      return;
    }
    const claimed = data?.claimed ?? {};
    const count = Number(claimed.signup ?? 0) + Number(claimed.vip ?? 0) + Number(claimed.discord ?? 0);
    toast({ title: count > 0 ? "Rewards claimed" : "Nothing ready yet", description: count > 0 ? `${count} reward${count === 1 ? "" : "s"} added to this character.` : "Pending referrals will become claimable once they meet the qualification rules." });
    await loadDashboard();
  };

  const startDiscordVerification = async () => {
    setDiscordLoading(true);
    const { data, error } = await supabase.functions.invoke("discord-community-auth", { body: { action: "start" } });
    setDiscordLoading(false);
    if (error || !data?.url) {
      toast({ title: "Discord verification unavailable", description: error?.message ?? data?.error ?? "Discord verification is not configured yet.", variant: "destructive" });
      return;
    }
    window.location.assign(data.url);
  };

  const bindManualCode = async () => {
    const code = manualCode.trim().toUpperCase();
    if (!code) return;
    setBinding(true);
    const { error } = await (supabase as any).rpc("bind_referral_code", { p_code: code });
    setBinding(false);
    if (error) {
      toast({ title: "Referral code not linked", description: error.message, variant: "destructive" });
      return;
    }
    localStorage.removeItem("rockmundo_referral_code");
    setManualCode("");
    toast({ title: "Referral code linked", description: "The referrer will earn their signup reward once your account qualifies." });
  };

  if (!profileId) {
    return <Card><CardHeader><CardTitle>Rewards & referrals</CardTitle><CardDescription>Select or create a character before claiming account rewards.</CardDescription></CardHeader></Card>;
  }

  if (loading) {
    return <div className="flex h-40 items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading rewards…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Rewards & referrals</h2>
          <p className="text-sm text-muted-foreground">Grow the RockMundo community and earn rewards without creating an easy farm for fake accounts.</p>
        </div>
        <Button onClick={claim} disabled={claiming || totalClaimable === 0}>
          {claiming ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Gift className="mr-2 h-4 w-4" />}
          Claim rewards {totalClaimable > 0 ? `(${totalClaimable})` : ""}
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Your referral code</CardTitle>
            <CardDescription>Share the link or code. A signup only qualifies after email confirmation, 24 hours and genuine game progress.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input readOnly value={dashboard?.code ?? ""} className="font-mono font-semibold" />
              <Button variant="outline" onClick={() => copy(dashboard?.code ?? "", "Code")}><Copy className="mr-2 h-4 w-4" />Copy code</Button>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input readOnly value={referralUrl} className="text-xs" />
              <Button variant="outline" onClick={() => copy(referralUrl, "Referral link")}><Copy className="mr-2 h-4 w-4" />Copy link</Button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <div><div className="text-2xl font-semibold">{dashboard?.stats.joined ?? 0}</div><div className="text-xs text-muted-foreground">Joined</div></div>
              <div><div className="text-2xl font-semibold">{dashboard?.stats.qualified ?? 0}</div><div className="text-xs text-muted-foreground">Qualified</div></div>
              <div><div className="text-2xl font-semibold">{dashboard?.stats.signup_rewarded ?? 0}</div><div className="text-xs text-muted-foreground">Signup paid</div></div>
              <div><div className="text-2xl font-semibold">{dashboard?.stats.vip_paid ?? 0}</div><div className="text-xs text-muted-foreground">Bought VIP</div></div>
              <div><div className="text-2xl font-semibold">{dashboard?.stats.vip_rewarded ?? 0}</div><div className="text-xs text-muted-foreground">VIP paid</div></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Enter a referral code</CardTitle><CardDescription>For new accounts that received a code directly. Codes can only be linked in the first 7 days.</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            <Input value={manualCode} onChange={(event) => setManualCode(event.target.value.toUpperCase())} placeholder="RMXXXXXXXX" maxLength={20} />
            <Button className="w-full" variant="outline" onClick={bindManualCode} disabled={binding || !manualCode.trim()}>{binding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Link code</Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Qualified signup</CardTitle><CardDescription>Paid to the referrer after the anti-farm qualification checks.</CardDescription></CardHeader>
          <CardContent><Badge variant="secondary" className="whitespace-normal text-left">{rewardSummary(dashboard?.rewards.referral_signup)}</Badge></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>First paid VIP</CardTitle><CardDescription>Paid once after Stripe confirms payment and the 7-day hold expires.</CardDescription></CardHeader>
          <CardContent><Badge variant="secondary" className="whitespace-normal text-left">{rewardSummary(dashboard?.rewards.referral_vip)}</Badge></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Discord member</CardTitle><CardDescription>One verified Discord account can reward only one RockMundo account.</CardDescription></CardHeader>
          <CardContent><Badge variant="secondary" className="whitespace-normal text-left">{rewardSummary(dashboard?.rewards.discord_verified)}</Badge></CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" />Discord verification</CardTitle>
            <CardDescription>Join the official server, then verify membership through Discord.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><a href={DISCORD_INVITE_URL} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Join Discord</a></Button>
            <Button onClick={startDiscordVerification} disabled={discordLoading || dashboard?.discord.verified}>
              {discordLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : dashboard?.discord.verified ? <CheckCircle2 className="mr-2 h-4 w-4" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
              {dashboard?.discord.verified ? "Verified" : "Verify membership"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Facebook</CardTitle><CardDescription>Follow RockMundo for news and community updates. Facebook engagement is not tied to game currency or rewards.</CardDescription></CardHeader>
          <CardContent>
            {FACEBOOK_URL ? <Button asChild variant="outline"><a href={FACEBOOK_URL} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Open Facebook page</a></Button> : <p className="text-sm text-muted-foreground">Set VITE_ROCKMUNDO_FACEBOOK_URL to show the official page link here.</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Anti-cheat rules</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Referral ownership cannot be changed; self-referrals are rejected; signup rewards require a confirmed email, a 24-hour account age and real play progress; paid VIP rewards come only from a signed Stripe webhook and wait seven days; every reward grant has a unique idempotency key; and each Discord identity can verify only one RockMundo account.
        </CardContent>
      </Card>
    </div>
  );
}
