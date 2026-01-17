// @ts-nocheck
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/lib/supabase-types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Users, Shield, Zap, Activity, Bus, UserCheck, User, UserX } from "lucide-react";
import { BandMemberDetailDialog } from "./BandMemberDetailDialog";
import { useGameData } from "@/hooks/useGameData";
import { useToast } from "@/hooks/use-toast";

interface BandRosterTabProps {
  bandId: string;
}

type BandMemberRow = Database["public"]["Tables"]["band_members"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

type MemberWithProfile = BandMemberRow & {
  profiles: { 
    user_id: string; 
    display_name: string | null; 
    username: string; 
    avatar_url: string | null; 
    rpm_avatar_url?: string | null;
    level: number | null; 
  } | null;
};

type BandMembershipStatusHistory = {
  id: string;
  band_id: string;
  member_id: string;
  status: string;
  notes: string | null;
  changed_at: string;
  changed_by: string | null;
};

const statusLabels: Record<string, string> = {
  active: "Active",
  hiatus: "On Hiatus",
  suspended: "Suspended",
  probation: "On Probation",
};

const statusColors: Record<string, string> = {
  active: "bg-emerald-500/20 text-emerald-700",
  hiatus: "bg-amber-500/20 text-amber-700",
  suspended: "bg-red-500/20 text-red-700",
  probation: "bg-sky-500/20 text-sky-700",
};

function getStatusLabel(status?: string | null) {
  if (!status) return "Active";
  return statusLabels[status] ?? status
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function getStatusColor(status?: string | null) {
  if (!status) return statusColors.active;
  return statusColors[status] ?? "bg-slate-500/20 text-slate-700";
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString();
}

// Avatar status component
function AvatarStatusIndicator({ profile }: { profile: MemberWithProfile['profiles'] }) {
  if (!profile) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted">
              <UserX className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>No player account</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const has3DAvatar = Boolean(profile.rpm_avatar_url);
  const hasBasicAvatar = Boolean(profile.avatar_url);

  if (has3DAvatar) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20">
              <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Full 3D avatar ready</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (hasBasicAvatar) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20">
              <User className="h-3.5 w-3.5 text-amber-600" />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Basic avatar only</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-red-500/20">
            <UserX className="h-3.5 w-3.5 text-red-600" />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>No avatar uploaded</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function BandRosterTab({ bandId }: BandRosterTabProps) {
  const { profile } = useGameData();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [statusHistory, setStatusHistory] = useState<Record<string, BandMembershipStatusHistory[]>>({});
  const [selectedMember, setSelectedMember] = useState<MemberWithProfile | null>(null);
  const [bandLeaderId, setBandLeaderId] = useState<string | null>(null);

  const isLeader = profile?.user_id === bandLeaderId;

  useEffect(() => {
    let isMounted = true;

    const fetchRoster = async () => {
      setLoading(true);
      try {
        // Fetch band info for leader check
        const { data: bandData } = await supabase
          .from("bands")
          .select("leader_id")
          .eq("id", bandId)
          .single();

        if (bandData) {
          setBandLeaderId(bandData.leader_id);
        }

        // Fetch band members
        const { data: memberData, error: memberError } = await supabase
          .from("band_members")
          .select("*")
          .eq("band_id", bandId)
          .order("is_touring_member", { ascending: true })
          .order("joined_at", { ascending: true });

        if (memberError) throw memberError;

        // Fetch profiles separately with rpm_avatar_url
        const userIds = memberData?.map(m => m.user_id).filter(Boolean) ?? [];
        const { data: profileData } = await supabase
          .from("profiles")
          .select("user_id, display_name, username, avatar_url, rpm_avatar_url, level")
          .in("user_id", userIds);

        // Merge members with profiles
        const membersWithProfiles: MemberWithProfile[] = (memberData ?? []).map(member => ({
          ...member,
          profiles: profileData?.find(p => p.user_id === member.user_id) ?? null
        }));

        // Fetch status history
        const { data: historyData, error: historyError } = await supabase
          .from("band_membership_status_history")
          .select("*")
          .eq("band_id", bandId)
          .order("changed_at", { ascending: false });

        if (historyError) console.error("Failed to load status history", historyError);

        if (!isMounted) return;

        setMembers(membersWithProfiles);

        const historyMap = (historyData as BandMembershipStatusHistory[] | null)?.reduce(
          (acc, entry) => {
            if (!acc[entry.member_id]) {
              acc[entry.member_id] = [];
            }
            acc[entry.member_id].push(entry);
            return acc;
          },
          {} as Record<string, BandMembershipStatusHistory[]>,
        ) ?? {};

        setStatusHistory(historyMap);
      } catch (error) {
        console.error("Failed to load band roster", error);
        if (isMounted) {
          setMembers([]);
          setStatusHistory({});
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void fetchRoster();

    return () => {
      isMounted = false;
    };
  }, [bandId]);

  const handleTravelToggle = async (memberId: string, currentValue: boolean) => {
    if (!isLeader) {
      toast({
        title: "Permission denied",
        description: "Only the band leader can change travel settings",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("band_members")
        .update({ travels_with_band: !currentValue })
        .eq("id", memberId);

      if (error) throw error;

      setMembers(prev => 
        prev.map(m => 
          m.id === memberId ? { ...m, travels_with_band: !currentValue } : m
        )
      );

      toast({
        title: "Travel setting updated",
        description: !currentValue 
          ? "Member will now travel with the band" 
          : "Member will arrange their own travel",
      });
    } catch (error) {
      console.error("Failed to update travel setting", error);
      toast({
        title: "Update failed",
        description: "Could not update travel setting",
        variant: "destructive",
      });
    }
  };

  const leadershipEligible = useMemo(
    () => members.filter((member) => member.can_be_leader).length,
    [members],
  );

  const touringMembers = useMemo(
    () => members.filter((member) => member.is_touring_member).length,
    [members],
  );

  const activeMembers = useMemo(
    () => members.filter((member) => (member.member_status ?? "active") === "active").length,
    [members],
  );

  const travelingMembers = useMemo(
    () => members.filter((member) => member.travels_with_band).length,
    [members],
  );

  const chemistryAverage = useMemo(() => {
    const values = members
      .map((member) => member.chemistry_contribution ?? 0)
      .filter((value) => value > 0);

    if (values.length === 0) return 0;
    const total = values.reduce((sum, value) => sum + value, 0);
    return Math.round((total / values.length) * 10) / 10;
  }, [members]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Band roster</CardTitle>
            <CardDescription>Loading current roster details…</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
                <Skeleton className="h-5 w-24" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Users className="h-4 w-4 text-muted-foreground" /> Active members
            </CardTitle>
            <CardDescription>
              {activeMembers} of {members.length} members available
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={(members.length ? (activeMembers / members.length) * 100 : 0)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Shield className="h-4 w-4 text-muted-foreground" /> Leadership ready
            </CardTitle>
            <CardDescription>{leadershipEligible} members can assume leadership</CardDescription>
          </CardHeader>
          <CardContent>
            <Progress
              value={(members.length ? (leadershipEligible / members.length) * 100 : 0)}
              className="bg-muted"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Zap className="h-4 w-4 text-muted-foreground" /> Session unit
            </CardTitle>
            <CardDescription>{touringMembers} session musicians</CardDescription>
          </CardHeader>
          <CardContent>
            <Progress
              value={(members.length ? (touringMembers / members.length) * 100 : 0)}
              className="bg-muted"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Bus className="h-4 w-4 text-muted-foreground" /> Travel party
            </CardTitle>
            <CardDescription>{travelingMembers} members traveling</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Est. +${travelingMembers * 25}/leg (non-bus)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Activity className="h-4 w-4 text-muted-foreground" /> Chemistry average
            </CardTitle>
            <CardDescription>Average contribution per member</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{chemistryAverage.toFixed(1)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Band roster</CardTitle>
          <CardDescription>Overview of every active member and their contributions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">No members found for this band.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[240px]">Member</TableHead>
                    <TableHead className="w-[60px] text-center">Avatar</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Travels</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Contributions</TableHead>
                    <TableHead>Compensation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => {
                    const lastStatus = statusHistory[member.id]?.[0];
                    const statusLabel = getStatusLabel(member.member_status);
                    return (
                      <TableRow key={member.id}>
                        <TableCell>
                          <button
                            type="button"
                            onClick={() => setSelectedMember(member)}
                            className="flex items-center gap-3 -m-2 p-2 rounded-lg hover:bg-accent/50 transition-colors w-full text-left"
                          >
                            <Avatar>
                              {member.profiles?.avatar_url ? (
                                <AvatarImage src={member.profiles.avatar_url} alt={member.profiles.display_name ?? member.profiles.username} />
                              ) : (
                                <AvatarFallback>
                                  {(member.profiles?.display_name ?? member.profiles?.username ?? "?")
                                    .slice(0, 2)
                                    .toUpperCase()}
                                </AvatarFallback>
                              )}
                            </Avatar>
                            <div>
                              <p className="font-medium underline-offset-2 hover:underline">
                                {member.profiles?.display_name ?? member.profiles?.username ?? "Unassigned"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {member.instrument_role || member.vocal_role || member.role}
                              </p>
                            </div>
                          </button>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center">
                            <AvatarStatusIndicator profile={member.profiles} />
                          </div>
                        </TableCell>
                        <TableCell className="align-middle">
                          <div className="flex flex-col gap-1">
                            <span className="text-sm font-medium">{member.role}</span>
                            {member.can_be_leader && <Badge variant="outline">Leadership pool</Badge>}
                            {member.is_touring_member && <Badge variant="secondary">Session</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="align-middle">
                          <Badge className={getStatusColor(member.member_status)}>{statusLabel}</Badge>
                        </TableCell>
                        <TableCell className="align-middle text-center">
                          <div className="flex flex-col items-center gap-1">
                            <Switch
                              checked={member.travels_with_band ?? false}
                              onCheckedChange={() => handleTravelToggle(member.id, member.travels_with_band ?? false)}
                              disabled={!isLeader}
                            />
                            <span className="text-xs text-muted-foreground">
                              {member.travels_with_band ? "Yes" : "No"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="align-middle text-sm text-muted-foreground">
                          {formatDate(member.joined_at) || "—"}
                        </TableCell>
                        <TableCell className="align-middle text-sm">
                          <div className="flex flex-col gap-1">
                            <span>Skill: {member.skill_contribution ?? 0}</span>
                            <span>Chemistry: {member.chemistry_contribution ?? 0}</span>
                          </div>
                        </TableCell>
                        <TableCell className="align-middle text-sm">
                          {member.salary ? `$${member.salary.toLocaleString()}/wk` : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <BandMemberDetailDialog
        open={!!selectedMember}
        onOpenChange={(open) => !open && setSelectedMember(null)}
        member={selectedMember}
        currentProfileId={profile?.id ?? null}
      />
    </div>
  );
}

export default BandRosterTab;