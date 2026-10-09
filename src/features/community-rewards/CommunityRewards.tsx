import { useEffect, useMemo, useState } from "react";
import { Copy, Gift, Loader2, ShieldCheck, Users, ExternalLink, CheckCircle2, Share2, MessageCircle, Trophy, Music2, Mic2, Award, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { copyText, nativeShare, referralUrlWithParams } from "@/features/shareable-moments/share";
import { trackShareAnalyticsEvent } from "@/features/shareable-moments/analytics";
import { DISCORD_INVITE_URL } from "@/lib/communityLinks";
const FACEBOOK_URL = import.meta.env.VITE_ROCKMUNDO_FACEBOOK_URL as string | undefined;

type Reward = {
  xp: number;
  ap: number;
  cash: number;
  player_fame: number;
  band_fame: number;
};

type RecruitStatus = { referral_id: string; joined_at: string; qualified: boolean; qualified_at?: string | null; vip_paid: boolean; source: string; band?: { band_id: string; name: string } | null; recruit: { profile_id?: string | null; name: string }; progress: { email_confirmed: boolean; account_age_met: boolean; activity_met: boolean; steps_complete: number } };

type Dashboard = {
  code: string;
  stats: {
    joined: number;
    qualified: number;
    signup_rewarded: number;
    vip_paid: number;
    vip_rewarded: number;
  };
  pending: { signup: number; vip: number; milestones?: number };
  rewards: Record<string, Reward>;
  discord: { verified: boolean; rewarded: boolean; verified_at?: string | null };
};

const referralSourceLabel = (source: string) => ({ band_recruitment: "Band recruitment", gig_share: "Gig share", song_chart_share: "Song chart", release_chart_share: "Release chart", achievement_share: "Achievement", referral_hub: "Invite Friends", manual_code: "Referral code", signup_metadata: "Direct invite", unknown: "Direct invite" } as Record<string, string>)[source] ?? source.replace(/_/g, " ");

const rewardSummary = (reward?: Reward) => {
  if (!reward) return "Reward unavailable";
  return `${reward.xp.toLocaleString()} XP · ${reward.ap} AP · $${reward.cash.toLocaleString()} · +${reward.player_fame} player fame · +${reward.band_fame} band fame`;
};

export default function CommunityRewards({ profileId, profileName }: { profileId?: string | null; profileName?: string | null }) {
  const { toast } = useToast();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [discordLoading, setDiscordLoading] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [binding, setBinding] = useState(false);
  const [recruits, setRecruits] = useState<RecruitStatus[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadDashboard = async () => {
    if (!profileId) {
      setDashboard(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const [{ data, error }, recruitResult] = await Promise.all([
        (supabase as any).rpc("get_referral_dashboard", { p_profile_id: profileId }),
        (supabase as any).rpc("get_my_referral_recruits", { p_profile_id: profileId }),
      ]);
      if (error) {
        setDashboard(null);
        setRecruits([]);
        setLoadError(error.message || "Referral rewards could not be loaded.");
        toast({ title: "Unable to load rewards", description: error.message, variant: "destructive" });
      } else {
        setDashboard(data as Dashboard);
        setRecruits(recruitResult.error ? [] : ((recruitResult.data ?? []) as RecruitStatus[]));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Referral rewards could not be loaded.";
      setDashboard(null);
      setRecruits([]);
      setLoadError(message);
      toast({ title: "Unable to load rewards", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
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

  const referralUrl = useMemo(() => dashboard?.code ? referralUrlWithParams(dashboard.code, { source: "referral_hub" }) : "", [dashboard?.code]);
  const totalClaimable = (dashboard?.pending.signup ?? 0) + (dashboard?.pending.vip ?? 0) + (dashboard?.pending.milestones ?? 0) + (dashboard?.discord.verified && !dashboard.discord.rewarded ? 1 : 0);
  const qualified = dashboard?.stats.qualified ?? 0;
  const promoterMilestones = [5, 10, 25];
  const promoterLabels: Record<number, string> = { 5: "Street Promoter", 10: "Scene Builder", 25: "RockMundo Ambassador" };
  const nextMilestone = promoterMilestones.find((value) => qualified < value);
  const nextProgress = nextMilestone ? Math.min(100, Math.round((qualified / nextMilestone) * 100)) : 100;
  const recruitsToNext = nextMilestone ? Math.max(0, nextMilestone - qualified) : 0;
  const shareText = `Join me in RockMundo — create a musician, form a band and build your music career. Use my invite so we both get credit: ${referralUrl}`;

  const copy = async (value: string, label: string) => {
    if (!value) {
      toast({ title: `${label} unavailable`, description: "Please refresh and try again.", variant: "destructive" });
      return false;
    }
    if (await copyText(value)) {
      toast({ title: `${label} copied` });
      return true;
    }
    toast({ title: `Couldn't copy ${label.toLowerCase()}`, description: "Your browser blocked clipboard access. Use Share invite instead, or select and copy the link manually.", variant: "destructive" });
    return false;
  };

  const share = async () => {
    if (!referralUrl) return;
    trackShareAnalyticsEvent("share_native_started", { momentType: "referral", channel: "native" });
    try {
      const result = await nativeShare({ title: "Join me in RockMundo", text: shareText, url: referralUrl });
      if (result === "shared" || result === "cancelled") return;
    } catch {
      // Fall through to the clipboard fallback below.
    }
    if (await copy(referralUrl, "Invite link")) {
      trackShareAnalyticsEvent("share_link_copied", { momentType: "referral", channel: "copy_link" });
    }
  };

  const claim = async () => {
    if (!profileId) return;
    setClaiming(true);
    const { data, error } = await (supabase as any).rpc("claim_referral_rewards", { p_profile_id: profileId });
    if (error) {
      setClaiming(false);
      toast({ title: "Reward claim failed", description: error.message, variant: "destructive" });
      return;
    }
    const { data: milestoneData, error: milestoneError } = await (supabase as any).rpc("claim_referral_milestones", { p_profile_id: profileId });
    setClaiming(false);
    if (milestoneError) {
      toast({ title: "Promoter reward claim failed", description: milestoneError.message, variant: "destructive" });
      await loadDashboard();
      return;
    }
    const claimed = data?.claimed ?? {};
    const milestoneCount = Array.isArray(milestoneData?.claimed) ? milestoneData.claimed.length : 0;
    const count = Number(claimed.signup ?? 0) + Number(claimed.vip ?? 0) + Number(claimed.discord ?? 0) + milestoneCount;
    toast({ title: count > 0 ? "Rewards claimed" : "Nothing ready yet", description: count > 0 ? `${count} reward${count === 1 ? "" : "s"} added to ${profileName || "this character"}.` : "Pending referrals will become claimable once they meet the qualification rules." });
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
    const { error } = await (supabase as any).rpc("bind_referral_code", { p_code: code, p_source: "manual_code" });
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
    return <Card><CardHeader><CardTitle>Invite friends</CardTitle><CardDescription>Select or create a character to access your invite link and promoter rewards.</CardDescription></CardHeader></Card>;
  }

  if (loading) {
    return <div className="flex h-40 items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading rewards…</div>;
  }

  if (loadError) {
    return (
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle>Invite friends unavailable</CardTitle>
          <CardDescription>The referral page loaded, but its reward data could not be fetched.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{loadError}</p>
          <Button type="button" variant="outline" onClick={() => void loadDashboard()}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Invite friends</h2>
          <p className="text-sm text-muted-foreground">Bring friends into RockMundo, help them become active musicians and earn promoter rewards as they progress.</p>
        </div>
        <Button onClick={claim} disabled={claiming || totalClaimable === 0}>
          {claiming ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Gift className="mr-2 h-4 w-4" />}
          Claim for {profileName || "selected character"} {totalClaimable > 0 ? `(${totalClaimable})` : ""}
        </Button>
      </div>

      {totalClaimable > 0 && <Card className="border-primary/30 bg-primary/5"><CardContent className="p-4 text-sm"><strong>{totalClaimable} account-earned reward{totalClaimable === 1 ? "" : "s"} ready.</strong> Claiming now permanently awards the character-bound XP, AP, cash, fame and promoter prestige to <strong>{profileName || "the selected character"}</strong>. Switch character before claiming if you want these rewards on someone else.</CardContent></Card>}

      <Card className="overflow-hidden border-primary/30 bg-gradient-to-r from-primary/10 via-background to-background"><CardContent className="p-5"><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><div className="flex items-center gap-2"><Trophy className="h-5 w-5 text-primary" /><span className="font-semibold">{nextMilestone ? `${recruitsToNext} more qualified ${recruitsToNext === 1 ? "recruit" : "recruits"} to ${promoterLabels[nextMilestone]}` : "All promoter milestones complete"}</span></div><p className="mt-1 text-sm text-muted-foreground">{nextMilestone ? `${qualified} of ${nextMilestone} qualified recruits. Keep sharing moments from your RockMundo career to reach the next promoter tier.` : "You have reached RockMundo Ambassador status."}</p></div><Button onClick={share}><Share2 className="mr-2 h-4 w-4" />Invite someone now</Button></div><div className="mt-4 h-3 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${nextProgress}%` }} /></div></CardContent></Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Invite your friends</CardTitle>
            <CardDescription>Share your personal invite. Rewards unlock only after friends confirm their account and make genuine game progress.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input readOnly value={dashboard?.code ?? ""} className="font-mono font-semibold" />
              <Button variant="outline" onClick={() => copy(dashboard?.code ?? "", "Code")}><Copy className="mr-2 h-4 w-4" />Copy code</Button>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input readOnly value={referralUrl} className="text-xs" />
              <Button variant="outline" onClick={async () => { if (await copy(referralUrl, "Invite link")) trackShareAnalyticsEvent("share_link_copied", { momentType: "referral", channel: "copy_link" }); }}><Copy className="mr-2 h-4 w-4" />Copy link</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={share}><Share2 className="mr-2 h-4 w-4" />Share invite</Button>
              <Button asChild variant="outline"><a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer"><MessageCircle className="mr-2 h-4 w-4" />WhatsApp</a></Button>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3"><p className="text-sm font-medium">What makes a referral qualified?</p><div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3"><span><strong className="text-foreground">1.</strong> Confirm their email</span><span><strong className="text-foreground">2.</strong> Keep the account for 24 hours</span><span><strong className="text-foreground">3.</strong> Make genuine game progress</span></div><p className="mt-2 text-xs text-muted-foreground">Registration alone does not unlock rewards. This keeps promoter rewards focused on real new players.</p></div>
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
          <CardHeader><CardTitle>Were you invited?</CardTitle><CardDescription>New accounts can recover a missed invite for up to 30 days by entering the code here.</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            <Input value={manualCode} onChange={(event) => setManualCode(event.target.value.toUpperCase())} placeholder="RMXXXXXXXX" maxLength={20} />
            <Button className="w-full" variant="outline" onClick={bindManualCode} disabled={binding || !manualCode.trim()}>{binding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Link code</Button>
          </CardContent>
        </Card>
      </div>


      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Share2 className="h-5 w-5" />Share your RockMundo story</CardTitle><CardDescription>The strongest invites come from something you actually achieved. Open an area below and share its contextual milestone.</CardDescription></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Button asChild variant="outline" className="h-auto justify-start py-3"><Link to="/charts"><Music2 className="mr-2 h-4 w-4" /><span className="text-left"><strong className="block">Chart success</strong><span className="text-xs text-muted-foreground">Share a top song position</span></span></Link></Button>
          <Button asChild variant="outline" className="h-auto justify-start py-3"><Link to="/releases"><Mic2 className="mr-2 h-4 w-4" /><span className="text-left"><strong className="block">Release milestone</strong><span className="text-xs text-muted-foreground">Share a charting release</span></span></Link></Button>
          <Button asChild variant="outline" className="h-auto justify-start py-3"><Link to="/home"><Award className="mr-2 h-4 w-4" /><span className="text-left"><strong className="block">Achievement</strong><span className="text-xs text-muted-foreground">Share an unlocked achievement</span></span></Link></Button>
          <Button asChild variant="outline" className="h-auto justify-start py-3"><Link to="/band/members"><UserPlus className="mr-2 h-4 w-4" /><span className="text-left"><strong className="block">Recruit a bandmate</strong><span className="text-xs text-muted-foreground">Create a band recruitment invite</span></span></Link></Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Your recruits</CardTitle><CardDescription>See who has joined through your invite and how close they are to becoming a qualified active player. Private play totals are not exposed.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          {recruits.length === 0 ? <p className="text-sm text-muted-foreground">No recruits have joined through your referral link yet.</p> : recruits.map((item) => {
            const pct = item.qualified ? 100 : Math.round((item.progress.steps_complete / 3) * 100);
            const sourceLabel = referralSourceLabel(item.source);
            return <div key={item.referral_id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><span className="font-medium">{item.recruit.name}</span><Badge variant={item.qualified ? "default" : "secondary"}>{item.qualified ? "Qualified" : item.progress.steps_complete === 2 ? "Close to qualifying" : "Activating"}</Badge>{item.vip_paid ? <Badge variant="outline">VIP</Badge> : null}</div><p className="mt-1 text-xs text-muted-foreground">Source: {sourceLabel}{item.band?.name ? ` · Recruited for ${item.band.name}` : ""}</p></div>{item.recruit.profile_id ? <Button asChild size="sm" variant="outline"><a href={`/player/${item.recruit.profile_id}`}>View player</a></Button> : null}</div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} /></div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span>{item.progress.email_confirmed ? "✓" : "○"} Email confirmed</span><span>{item.progress.account_age_met ? "✓" : "○"} 24h account age</span><span>{item.progress.activity_met ? "✓" : "○"} Active play</span></div>
            </div>;
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5" />Promoter progression</CardTitle>
          <CardDescription>Qualified recruits unlock permanent promoter titles and profile badges at 5, 10 and 25 players, alongside the XP, AP, cash and fame rewards. Fake or inactive accounts do not count.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm"><span>{qualified} qualified recruit{qualified === 1 ? "" : "s"}</span><span>{nextMilestone ? `Next reward: ${nextMilestone}` : "All current milestones complete"}</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${nextProgress}%` }} /></div>
          <div className="flex flex-wrap gap-2">
            {[5, 10, 25].map((milestone) => <Badge key={milestone} variant={qualified >= milestone ? "default" : "outline"}>{promoterLabels[milestone]} · {milestone}</Badge>)}
          </div>
          <p className="text-xs text-muted-foreground">Promoter milestones become claimable at each target. Claiming is explicit so rewards go to the character you have selected.</p>
        </CardContent>
      </Card>

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
