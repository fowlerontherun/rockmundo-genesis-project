import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminRoute } from "@/components/AdminRoute";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Copy, Gift, Image as ImageIcon, Link2, RefreshCw, Users } from "lucide-react";
import { ShareMomentSheet } from "@/features/shareable-moments/ShareMomentSheet";
import type { ShareMoment } from "@/features/shareable-moments/types";
import { captureAvatarV1ForShare } from "@/features/shareable-moments/avatarCapture";
import { resolveAppearance } from "@/features/player-model/appearance";

const sourceLabel = (source: string) => ({ band_recruitment:"Band recruitment", gig_share:"Gig share", song_chart_share:"Song chart", release_chart_share:"Release chart", achievement_share:"Achievement", referral_hub:"Invite Friends", manual_code:"Referral code", signup_metadata:"Direct invite", unknown:"Direct invite" } as Record<string,string>)[source] ?? source.replace(/_/g," ");

type GrowthAnalytics = { trends:{joins_7d:number;joins_prev_7d:number;qualified_7d:number;qualified_prev_7d:number;band_joins_7d:number;band_joins_prev_7d:number}; speed:{median_qualification_hours:number|null;median_band_join_hours:number|null}; funnel: { joined:number; qualified:number; vip:number; activating:number }; dropoff:{ missing_email:number; waiting_24h:number; missing_activity:number }; band:{ joined:number; qualified:number; band_members:number; vip:number; qualification_rate:number; band_join_rate:number }; sources:Array<{source:string;joined:number;qualified:number;vip:number;activating:number;missing_email:number;waiting_24h:number;missing_activity:number;band_joined:number;qualification_rate:number;vip_rate:number}>; campaigns:Array<{campaign:string;source:string;joined:number;qualified:number;vip:number;qualification_rate:number;vip_rate:number}> };

type SavedCampaign = { id:string; slug:string; name:string; referral_code:string; source:string; partner_name?:string|null; notes?:string|null; starts_at?:string|null; ends_at?:string|null; is_active:boolean; created_at:string; updated_at:string };

type Audit = {
  summary: {
    total_referrals: number;
    qualified: number;
    signup_rewarded: number;
    vip_paid: number;
    vip_rewarded: number;
    last_24h: number;
    last_7d: number;
    qualification_rate: number;
    vip_conversion_rate: number;
    band_recruits: number;
  };
  sources: Array<{ source: string; referrals: number; qualified: number; vip_paid: number; qualification_rate: number; vip_conversion_rate: number }>;
  recent: Array<{
    id: string; referral_code: string; bound_at: string; signup_qualified_at?: string | null;
    signup_rewarded_at?: string | null; vip_paid_at?: string | null; vip_rewarded_at?: string | null;
    source: string; referrer_name?: string | null; referred_name?: string | null;
  }>;
  recent_rewards: Array<{
    id: string; reward_key: string; beneficiary_name?: string | null; xp_amount: number; ap_amount: number;
    cash_amount: number; player_fame_amount: number; band_fame_amount: number; granted_at: string;
  }>;
};

export default function ReferralAudit() {
  const { toast } = useToast();
  const [campaignCode, setCampaignCode] = useState("");
  const [campaignSlug, setCampaignSlug] = useState("");
  const [campaignSource, setCampaignSource] = useState("referral_hub");
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [campaignName, setCampaignName] = useState("");
  const [campaignPartner, setCampaignPartner] = useState("");
  const [campaignNotes, setCampaignNotes] = useState("");
  const [campaignStart, setCampaignStart] = useState("");
  const [campaignEnd, setCampaignEnd] = useState("");
  const [campaignActive, setCampaignActive] = useState(true);
  const [savingCampaign, setSavingCampaign] = useState(false);
  const [campaignShareMoment, setCampaignShareMoment] = useState<ShareMoment | null>(null);
  const normalizedCode = campaignCode.trim().toUpperCase();
  const normalizedCampaign = campaignSlug.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  const campaignLink = useMemo(() => {
    if (!/^RM[A-Z0-9]{6,18}$/.test(normalizedCode) || !/^[a-z0-9][a-z0-9_-]{1,39}$/.test(normalizedCampaign)) return "";
    const url = new URL("/auth", window.location.origin);
    url.searchParams.set("ref", normalizedCode);
    url.searchParams.set("source", campaignSource);
    url.searchParams.set("campaign", normalizedCampaign);
    return url.toString();
  }, [normalizedCode, normalizedCampaign, campaignSource]);
  const copyCampaignLink = async () => {
    if (!campaignLink) return;
    try { await navigator.clipboard.writeText(campaignLink); toast({ title: "Campaign link copied", description: `${normalizedCampaign} is ready to share.` }); }
    catch { toast({ title: "Couldn’t copy campaign link", description: "Your browser blocked clipboard access.", variant: "destructive" }); }
  };
  const campaignsQuery = useQuery({ queryKey: ["admin-referral-campaigns"], queryFn: async () => { const { data, error } = await (supabase as any).rpc("admin_list_referral_campaigns"); if (error) throw error; return (data ?? []) as SavedCampaign[]; } });
  const saveCampaign = async () => { if (!campaignLink || !campaignName.trim()) return; setSavingCampaign(true); const { error } = await (supabase as any).rpc("admin_save_referral_campaign", { p_id: campaignId, p_slug: normalizedCampaign, p_name: campaignName.trim(), p_referral_code: normalizedCode, p_source: campaignSource, p_partner_name: campaignPartner, p_notes: campaignNotes, p_starts_at: campaignStart || null, p_ends_at: campaignEnd || null, p_is_active: campaignActive }); setSavingCampaign(false); if (error) { toast({ title: "Campaign not saved", description: error.message, variant: "destructive" }); return; } toast({ title: campaignId ? "Campaign updated" : "Campaign saved" }); await campaignsQuery.refetch(); };
  const shareCampaign = async (item: SavedCampaign) => { const performance = campaignPerformance.get(`${item.slug}:${item.source}`); let artworkUrl: string | null = null; let promoterName = item.partner_name ?? null; try { const { data, error } = await (supabase as any).rpc("admin_get_referral_promoter_visual", { p_referral_code: item.referral_code }); if (error) throw error; if (data?.appearance && data?.profile_id) { const canvas = await captureAvatarV1ForShare({ appearance: resolveAppearance(data.appearance, data.profile_id) }); artworkUrl = canvas.toDataURL("image/png"); promoterName = data.display_name ?? promoterName; } } catch { /* Branded card remains available if promoter visual cannot render. */ } setCampaignShareMoment({ version: 1, type: "referral", id: item.id, eyebrow: promoterName ? `INVITED BY ${promoterName}` : "JOIN ROCKMUNDO", headline: item.name, artworkUrl, subheadline: "Start your music career on RockMundo — create your character, form a band and play the world.", metrics: performance ? [{ label: "Players joined", value: String(performance.joined) }, { label: "Qualified", value: String(performance.qualified) }, { label: "VIP", value: String(performance.vip) }] : [{ label: "Campaign", value: item.slug }, { label: "Source", value: sourceLabel(item.source) }], destinationUrl: "/auth", referralCode: item.referral_code, referralSource: item.source, referralCampaign: item.slug, visualTheme: "neon", visualLayout: "right", createdAt: new Date().toISOString() }); };
  const loadCampaign = (item: SavedCampaign) => { setCampaignId(item.id); setCampaignName(item.name); setCampaignCode(item.referral_code); setCampaignSlug(item.slug); setCampaignSource(item.source); setCampaignPartner(item.partner_name ?? ""); setCampaignNotes(item.notes ?? ""); setCampaignStart(item.starts_at?.slice(0,10) ?? ""); setCampaignEnd(item.ends_at?.slice(0,10) ?? ""); setCampaignActive(item.is_active); };
  const query = useQuery({
    queryKey: ["admin-referral-audit"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("admin_get_referral_audit", { p_limit: 100 });
      if (error) throw error;
      return data as Audit;
    },
  });
  const growthQuery = useQuery({ queryKey: ["admin-referral-growth-analytics"], queryFn: async () => { const { data, error } = await (supabase as any).rpc("admin_get_referral_growth_analytics"); if (error) throw error; return data as GrowthAnalytics; } });
  const audit = query.data;
  const growth = growthQuery.data;
  const campaignPerformance = useMemo(() => new Map((growth?.campaigns ?? []).map(row => [`${row.campaign}:${row.source}`, row])), [growth?.campaigns]);

  return (
    <AdminRoute>
      <div className="container mx-auto space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold"><Gift className="h-7 w-7" />Referral Audit</h1>
            <p className="text-muted-foreground">Read-only referral attribution, qualification, conversion and reward diagnostics.</p>
          </div>
          <Button variant="outline" onClick={() => { query.refetch(); growthQuery.refetch(); campaignsQuery.refetch(); }} disabled={query.isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} />Refresh
          </Button>
        </div>

        {query.error ? <Card className="border-destructive"><CardContent className="pt-6 text-destructive">{(query.error as Error).message}</CardContent></Card> : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Referrals", audit?.summary.total_referrals ?? 0],
            ["Qualified", audit?.summary.qualified ?? 0],
            ["Qualification", `${audit?.summary.qualification_rate ?? 0}%`],
            ["VIP buyers", audit?.summary.vip_paid ?? 0],
            ["VIP conversion", `${audit?.summary.vip_conversion_rate ?? 0}%`],
            ["Band recruits", audit?.summary.band_recruits ?? 0],
            ["Last 24h", audit?.summary.last_24h ?? 0],
            ["Last 7d", audit?.summary.last_7d ?? 0],
            ["Signup rewards", audit?.summary.signup_rewarded ?? 0],
            ["VIP rewards", audit?.summary.vip_rewarded ?? 0],
          ].map(([label, value]) => <Card key={String(label)}><CardContent className="pt-5"><p className="text-xs text-muted-foreground">{label}</p><p className="text-2xl font-semibold">{value}</p></CardContent></Card>)}
        </div>

        <div className="grid gap-4 lg:grid-cols-4">
          <Card><CardHeader><CardTitle>7-day momentum</CardTitle><CardDescription>Current seven days compared with the previous seven.</CardDescription></CardHeader><CardContent className="space-y-2 text-sm"><div className="flex justify-between"><span>New referrals</span><strong>{growth?.trends.joins_7d ?? 0} <span className="text-xs text-muted-foreground">vs {growth?.trends.joins_prev_7d ?? 0}</span></strong></div><div className="flex justify-between"><span>Qualified</span><strong>{growth?.trends.qualified_7d ?? 0} <span className="text-xs text-muted-foreground">vs {growth?.trends.qualified_prev_7d ?? 0}</span></strong></div><div className="flex justify-between"><span>Band joins</span><strong>{growth?.trends.band_joins_7d ?? 0} <span className="text-xs text-muted-foreground">vs {growth?.trends.band_joins_prev_7d ?? 0}</span></strong></div><div className="flex justify-between"><span>Median qualification</span><strong>{growth?.speed.median_qualification_hours == null ? "—" : `${growth.speed.median_qualification_hours}h`}</strong></div><div className="flex justify-between"><span>Median band join</span><strong>{growth?.speed.median_band_join_hours == null ? "—" : `${growth.speed.median_band_join_hours}h`}</strong></div></CardContent></Card>
          <Card><CardHeader><CardTitle>Activation funnel</CardTitle><CardDescription>Referral joins progressing into active players and VIP customers.</CardDescription></CardHeader><CardContent className="space-y-2 text-sm"><div className="flex justify-between"><span>Joined</span><strong>{growth?.funnel.joined ?? 0}</strong></div><div className="flex justify-between"><span>Qualified</span><strong>{growth?.funnel.qualified ?? 0}</strong></div><div className="flex justify-between"><span>Still activating</span><strong>{growth?.funnel.activating ?? 0}</strong></div><div className="flex justify-between"><span>VIP</span><strong>{growth?.funnel.vip ?? 0}</strong></div></CardContent></Card>
          <Card><CardHeader><CardTitle>Activation drop-off</CardTitle><CardDescription>Which qualification gates are holding pending recruits back. A recruit can appear in more than one row.</CardDescription></CardHeader><CardContent className="space-y-2 text-sm"><div className="flex justify-between"><span>Email not confirmed</span><strong>{growth?.dropoff.missing_email ?? 0}</strong></div><div className="flex justify-between"><span>Waiting for 24h</span><strong>{growth?.dropoff.waiting_24h ?? 0}</strong></div><div className="flex justify-between"><span>Needs active play</span><strong>{growth?.dropoff.missing_activity ?? 0}</strong></div></CardContent></Card>
          <Card><CardHeader><CardTitle>Band recruitment</CardTitle><CardDescription>Performance of referrals created specifically to recruit a player into a band.</CardDescription></CardHeader><CardContent className="space-y-2 text-sm"><div className="flex justify-between"><span>Joined</span><strong>{growth?.band.joined ?? 0}</strong></div><div className="flex justify-between"><span>Qualified</span><strong>{growth?.band.qualified ?? 0}</strong></div><div className="flex justify-between"><span>Joined intended band</span><strong>{growth?.band.band_members ?? 0}</strong></div><div className="flex justify-between"><span>Band join rate</span><strong>{growth?.band.band_join_rate ?? 0}%</strong></div><div className="flex justify-between"><span>Qualification rate</span><strong>{growth?.band.qualification_rate ?? 0}%</strong></div><div className="flex justify-between"><span>VIP</span><strong>{growth?.band.vip ?? 0}</strong></div></CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Source funnel diagnostics</CardTitle><CardDescription>Find share surfaces that generate signups but lose players before activation.</CardDescription></CardHeader>
          <CardContent className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead><tr className="border-b text-left"><th className="p-2">Source</th><th className="p-2">Joined</th><th className="p-2">Activating</th><th className="p-2">Qualified</th><th className="p-2">Qual. rate</th><th className="p-2">Email gap</th><th className="p-2">24h gap</th><th className="p-2">Play gap</th><th className="p-2">VIP</th></tr></thead><tbody>{growth?.sources.map(row=><tr key={row.source} className="border-b"><td className="p-2"><Badge variant="outline">{sourceLabel(row.source)}</Badge></td><td className="p-2">{row.joined}</td><td className="p-2">{row.activating}</td><td className="p-2">{row.qualified}</td><td className="p-2">{row.qualification_rate}%</td><td className="p-2">{row.missing_email}</td><td className="p-2">{row.waiting_24h}</td><td className="p-2">{row.missing_activity}</td><td className="p-2">{row.vip}</td></tr>)}</tbody></table></CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Link2 className="h-5 w-5" />Campaign manager</CardTitle><CardDescription>Save creator, community and promotional campaigns, then reuse their attributed referral links.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2"><Label>Campaign name</Label><Input value={campaignName} onChange={(e)=>setCampaignName(e.target.value)} placeholder="October creator push" maxLength={80} /></div>
              <div className="space-y-2"><Label>Creator / community</Label><Input value={campaignPartner} onChange={(e)=>setCampaignPartner(e.target.value)} placeholder="Optional partner name" maxLength={100} /></div>
              <div className="space-y-2"><Label>Referral code</Label><Input value={campaignCode} onChange={(e)=>setCampaignCode(e.target.value.toUpperCase())} placeholder="RMXXXXXXXX" maxLength={20} /></div>
              <div className="space-y-2"><Label>Campaign slug</Label><Input value={campaignSlug} onChange={(e)=>setCampaignSlug(e.target.value)} placeholder="creator_october" maxLength={40} /></div>
              <div className="space-y-2"><Label>Source</Label><Select value={campaignSource} onValueChange={setCampaignSource}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="referral_hub">Invite Friends</SelectItem><SelectItem value="band_recruitment">Band recruitment</SelectItem><SelectItem value="gig_share">Gig share</SelectItem><SelectItem value="song_chart_share">Song chart</SelectItem><SelectItem value="release_chart_share">Release chart</SelectItem><SelectItem value="achievement_share">Achievement</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>Status</Label><Button className="w-full" type="button" variant={campaignActive ? "outline" : "secondary"} onClick={()=>setCampaignActive(v=>!v)}>{campaignActive ? "Active" : "Paused"}</Button></div>
              <div className="space-y-2"><Label>Starts</Label><Input type="date" value={campaignStart} onChange={(e)=>setCampaignStart(e.target.value)} /></div>
              <div className="space-y-2"><Label>Ends</Label><Input type="date" value={campaignEnd} onChange={(e)=>setCampaignEnd(e.target.value)} /></div>
              <div className="space-y-2"><Label>Notes</Label><Input value={campaignNotes} onChange={(e)=>setCampaignNotes(e.target.value)} placeholder="Audience, placement or experiment notes" /></div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row"><Input readOnly value={campaignLink} placeholder="Complete the referral code and campaign slug" className="font-mono text-xs" /><Button onClick={copyCampaignLink} disabled={!campaignLink}><Copy className="mr-2 h-4 w-4" />Copy link</Button></div>
            <div className="flex flex-wrap gap-2"><Button onClick={saveCampaign} disabled={!campaignLink || !campaignName.trim() || savingCampaign}>{campaignId ? "Update campaign" : "Save campaign"}</Button>{campaignId ? <Button variant="outline" onClick={()=>{setCampaignId(null);setCampaignName("");setCampaignPartner("");setCampaignNotes("");setCampaignStart("");setCampaignEnd("");setCampaignActive(true);}}>New campaign</Button> : null}</div>
            {campaignsQuery.error ? <p className="text-sm text-destructive">Unable to load saved campaigns: {(campaignsQuery.error as Error).message}</p> : null}
            {campaignsQuery.data?.length ? <div className="space-y-2 border-t pt-4"><Label>Saved campaigns</Label>{campaignsQuery.data.map(item=>{ const performance=campaignPerformance.get(`${item.slug}:${item.source}`); return <div key={item.id} className="flex flex-col gap-3 rounded border p-3 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong>{item.name}</strong><Badge variant={item.is_active ? "default" : "secondary"}>{item.is_active ? "Active" : "Paused"}</Badge></div><p className="text-xs text-muted-foreground">{item.slug} · {sourceLabel(item.source)}{item.partner_name ? ` · ${item.partner_name}` : ""}</p>{performance ? <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs"><span><strong>{performance.joined}</strong> joined</span><span><strong>{performance.qualified}</strong> qualified ({performance.qualification_rate}%)</span><span><strong>{performance.vip}</strong> VIP ({performance.vip_rate}%)</span></div> : <p className="mt-2 text-xs text-muted-foreground">No attributed joins yet.</p>}</div><div className="flex shrink-0 flex-wrap gap-2"><Button size="sm" variant="secondary" onClick={()=>shareCampaign(item)}><ImageIcon className="mr-1 h-4 w-4" />Create social graphic</Button><Button size="sm" variant="outline" onClick={()=>loadCampaign(item)}>Open</Button></div></div>})}</div> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Campaign performance</CardTitle><CardDescription>Compare creator, community and promotional pushes within the same referral source. Add <code>campaign=your_slug</code> to referral links to populate this table.</CardDescription></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead><tr className="border-b text-left"><th className="p-2">Campaign</th><th className="p-2">Source</th><th className="p-2">Joined</th><th className="p-2">Qualified</th><th className="p-2">Qualification</th><th className="p-2">VIP</th><th className="p-2">VIP conversion</th></tr></thead>
              <tbody>{growth?.campaigns?.map((row) => <tr key={`${row.campaign}:${row.source}`} className="border-b"><td className="p-2 font-medium">{row.campaign}</td><td className="p-2"><Badge variant="outline">{sourceLabel(row.source)}</Badge></td><td className="p-2">{row.joined}</td><td className="p-2">{row.qualified}</td><td className="p-2">{row.qualification_rate}%</td><td className="p-2">{row.vip}</td><td className="p-2">{row.vip_rate}%</td></tr>)}</tbody>
            </table>
            {!growthQuery.isLoading && !growth?.campaigns?.length ? <p className="py-6 text-center text-muted-foreground">No campaign-tagged referrals yet.</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Acquisition sources</CardTitle><CardDescription>Which referral entry points turn invitations into qualified players and VIP customers.</CardDescription></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead><tr className="border-b text-left"><th className="p-2">Source</th><th className="p-2">Referrals</th><th className="p-2">Qualified</th><th className="p-2">Qualification</th><th className="p-2">VIP</th><th className="p-2">VIP conversion</th></tr></thead>
              <tbody>{audit?.sources?.map((row) => <tr key={row.source} className="border-b">
                <td className="p-2"><Badge variant="outline">{sourceLabel(row.source)}</Badge></td><td className="p-2">{row.referrals}</td><td className="p-2">{row.qualified}</td><td className="p-2">{row.qualification_rate}%</td><td className="p-2">{row.vip_paid}</td><td className="p-2">{row.vip_conversion_rate}%</td>
              </tr>)}</tbody>
            </table>
            {!query.isLoading && !audit?.sources?.length ? <p className="py-6 text-center text-muted-foreground">No referral source data yet.</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Recent referrals</CardTitle><CardDescription>Newest attribution records and their progression through qualification and VIP conversion.</CardDescription></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead><tr className="border-b text-left"><th className="p-2">Joined</th><th className="p-2">Referrer</th><th className="p-2">Recruit</th><th className="p-2">Source</th><th className="p-2">Code</th><th className="p-2">Qualified</th><th className="p-2">Signup reward</th><th className="p-2">VIP</th></tr></thead>
              <tbody>{audit?.recent?.map((row) => <tr key={row.id} className="border-b">
                <td className="p-2 whitespace-nowrap">{new Date(row.bound_at).toLocaleString()}</td>
                <td className="p-2">{row.referrer_name ?? "—"}</td><td className="p-2">{row.referred_name ?? "—"}</td>
                <td className="p-2"><Badge variant="outline">{row.source}</Badge></td><td className="p-2 font-mono text-xs">{row.referral_code}</td>
                <td className="p-2">{row.signup_qualified_at ? "Yes" : "Pending"}</td><td className="p-2">{row.signup_rewarded_at ? "Paid" : "—"}</td><td className="p-2">{row.vip_paid_at ? (row.vip_rewarded_at ? "Paid + rewarded" : "Paid") : "—"}</td>
              </tr>)}</tbody>
            </table>
            {!query.isLoading && !audit?.recent?.length ? <p className="py-6 text-center text-muted-foreground">No referrals yet.</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recent referral rewards</CardTitle><CardDescription>Character-bound grants for signup, VIP and promoter milestones.</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {audit?.recent_rewards?.map((reward) => <div key={reward.id} className="flex flex-col gap-1 rounded border p-3 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="font-medium">{reward.beneficiary_name ?? "Unknown character"} · {reward.reward_key}</p><p className="text-xs text-muted-foreground">{new Date(reward.granted_at).toLocaleString()}</p></div>
              <div className="text-sm text-muted-foreground">{reward.xp_amount} XP · {reward.ap_amount} AP · ${Number(reward.cash_amount).toLocaleString()} · +{reward.player_fame_amount} fame</div>
            </div>)}
          </CardContent>
        </Card>
        <ShareMomentSheet moment={campaignShareMoment} open={!!campaignShareMoment} onOpenChange={(open)=>{ if (!open) setCampaignShareMoment(null); }} />
      </div>
    </AdminRoute>
  );
}
