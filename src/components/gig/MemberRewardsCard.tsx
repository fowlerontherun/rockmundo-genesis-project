import { useEffect, useState } from'react';
import { supabase } from'@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from'@/components/ui/card';
import { Badge } from'@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from'@/components/ui/avatar';
import { Star, Users, Plane } from'lucide-react';

interface Props {
 gigId: string;
 bandId: string;
 fameGained: number;
 newFansTotal: number;
}

interface MemberRow {
 profile_id: string | null;
 user_id: string | null;
 is_touring_member: boolean;
 display_name: string | null;
 username: string | null;
 avatar_url: string | null;
 role: string | null;
 instrument_role: string | null;
}

export function MemberRewardsCard({ gigId, bandId, fameGained, newFansTotal }: Props) {
 const [members, setMembers] = useState<MemberRow[]>([]);
 const [ledger, setLedger] = useState<Record<string, { fame: number; fans: number }>>({});
 const [loading, setLoading] = useState(true);

 useEffect(() => {
 let cancelled = false;
 (async () => {
 setLoading(true);
 const [{ data: mems }, { data: led }] = await Promise.all([
 supabase
 .from('band_members')
 .select('profile_id, user_id, is_touring_member, role, instrument_role, profiles!band_members_profile_id_fkey(display_name, username, avatar_url)')
 .eq('band_id', bandId),
 supabase
 .from('experience_ledger')
 .select('user_id, metadata')
 .eq('activity_type','gig_performance'),
 ]);
 if (cancelled) return;
 const rows: MemberRow[] = (mems ?? []).map((m: any) => ({
 profile_id: m.profile_id,
 user_id: m.user_id,
 is_touring_member: !!m.is_touring_member,
 display_name: m.profiles?.display_name ?? null,
 username: m.profiles?.username ?? null,
 avatar_url: m.profiles?.avatar_url ?? null,
 role: m.role,
 instrument_role: m.instrument_role,
 }));
 const map: Record<string, { fame: number; fans: number }> = {};
 for (const row of led ?? []) {
 const meta: any = (row as any).metadata ?? {};
 if (meta?.gig_id === gigId && (row as any).user_id) {
 map[(row as any).user_id] = {
 fame: Number(meta.personal_fame_gained) || 0,
 fans: Number(meta.personal_fans_gained) || 0,
 };
 }
 }
 setMembers(rows);
 setLedger(map);
 setLoading(false);
 })();
 return () => { cancelled = true; };
 }, [gigId, bandId]);

 if (loading) {
 return (
 <Card>
 <CardHeader><CardTitle className="text-base">Member rewards</CardTitle></CardHeader>
 <CardContent><p className="text-sm text-muted-foreground">Loading…</p></CardContent>
 </Card>
 );
 }

 if (members.length === 0) {
 return null;
 }

 const coreMembers = members.filter((m) => !m.is_touring_member);
 const touringMembers = members.filter((m) => m.is_touring_member);
 // Fallback formulas matching complete-gig: 60% fame to each core, 30% of new fans split across core, 10% fame for touring.
 const fallbackCoreFame = Math.max(0, Math.round(fameGained * 0.6));
 const fallbackCoreFans = coreMembers.length > 0 ? Math.max(0, Math.round((newFansTotal * 0.3) / coreMembers.length)) : 0;
 const fallbackTouringFame = Math.max(0, Math.round(fameGained * 0.1));

 const renderMember = (m: MemberRow) => {
 const fallback = m.is_touring_member
 ? { fame: fallbackTouringFame, fans: 0 }
 : { fame: fallbackCoreFame, fans: fallbackCoreFans };
 const reward = (m.user_id && ledger[m.user_id]) || fallback;
 const initials = (m.display_name || m.username ||'?').slice(0, 2).toUpperCase();
 return (
 <div key={(m.profile_id ?? m.user_id) || initials} className="flex items-center gap-3 p-2 rounded-md border bg-card/50">
 <Avatar className="h-9 w-9">
 {m.avatar_url && <AvatarImage src={m.avatar_url} alt={m.display_name ??''} />}
 <AvatarFallback className="text-xs">{initials}</AvatarFallback>
 </Avatar>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-1.5 text-sm font-medium truncate">
 {m.display_name || m.username ||'Unknown'}
 {m.is_touring_member && (
 <Badge variant="outline"className="text-[9px] px-1 py-0 gap-0.5">
 <Plane className="h-2.5 w-2.5"/>Touring
 </Badge>
 )}
 </div>
 <div className="text-[11px] text-muted-foreground truncate">
 {m.instrument_role || m.role ||'—'}
 </div>
 </div>
 <div className="text-right">
 <div className="flex items-center gap-1 justify-end text-yellow-500 text-sm font-semibold">
 <Star className="h-3.5 w-3.5"/>+{reward.fame.toLocaleString()}
 </div>
 <div className="flex items-center gap-1 justify-end text-blue-500 text-xs">
 <Users className="h-3 w-3"/>+{reward.fans.toLocaleString()}
 </div>
 </div>
 </div>
 );
 };

 return (
 <Card>
 <CardHeader className="pb-3">
 <CardTitle className="text-base">Member rewards</CardTitle>
 <CardDescription>
 Personal fame and fans each band member earned directly from this gig.
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-2">
 {coreMembers.map(renderMember)}
 {touringMembers.length > 0 && (
 <>
 <div className="text-[10px] tracking-wide text-muted-foreground pt-2">Touring members</div>
 {touringMembers.map(renderMember)}
 </>
 )}
 <p className="text-[10px] text-muted-foreground pt-1">
 Core members get 60% of the band's fame gain plus a share of 30% of new fans. Touring members get a 10% fame slice and no personal fans.
 </p>
 </CardContent>
 </Card>
 );
}
