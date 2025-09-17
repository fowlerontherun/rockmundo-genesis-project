import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {

  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Users, 
  Music, 
  Guitar, 
  Mic, 
  Drum,
  TrendingUp,
  UserPlus,
  Settings,
  Star,
  MapPin
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameData } from "@/hooks/useGameData";

interface BandMember {
  id: string;
  user_id: string;
  band_id: string;
  role: string;
  salary: number | null;
  joined_at: string | null;
  name?: string;
  skills?: PlayerSkillsRow | null;
  avatar_url?: string;
  is_player?: boolean;
}

interface Band {
  id: string;
  name: string;
  genre: string;
  description: string;
  leader_id: string;
  popularity: number;
  weekly_fans: number;
  max_members: number;
  created_at: string;
  updated_at: string;
}

const BAND_ROLES = [
  "Lead Vocals",
  "Lead Guitar",
  "Rhythm Guitar",
  "Bassist",
  "Drummer",
  "Keyboardist",
  "Producer",
  "Manager"
];

type PlayerSkillsRow = Database['public']['Tables']['player_skills']['Row'];

type BandMemberRow = Database['public']['Tables']['band_members']['Row'];

type BandInvitation = Database['public']['Tables']['band_invitations']['Row'] & {
  band?: Band;
};

type SongRow = Database['public']['Tables']['songs']['Row'];
type GigRow = Database['public']['Tables']['gigs']['Row'] & {
  venue?: { name?: string | null; location?: string | null } | null;
};
type ScheduleEventRow = Database['public']['Tables']['schedule_events']['Row'];
type ProfileRow = Database['public']['Tables']['profiles']['Row'];

interface BandScheduleEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  eventType: string | null;
  scheduledAt: string | null;
  timestamp: number | null;
  status: string | null;
}

const BandManager = () => {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const { profile, skills } = useGameData();

  const [band, setBand] = useState<Band | null>(null);
  const [members, setMembers] = useState<BandMember[]>([]);
  const [chartPosition, setChartPosition] = useState<number | null>(null);
  const [gigsPlayed, setGigsPlayed] = useState<number | null>(null);
  const [songCount, setSongCount] = useState<number>(0);
  const [albumCount, setAlbumCount] = useState<number>(0);
  const [scheduleEvents, setScheduleEvents] = useState<BandScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [isRecruitDialogOpen, setIsRecruitDialogOpen] = useState(false);
  const [inviteRole, setInviteRole] = useState<string>(BAND_ROLES[0]);
  const [inviteSalary, setInviteSalary] = useState<number>(0);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<BandInvitation[]>([]);
  const [acceptingInviteId, setAcceptingInviteId] = useState<string | null>(null);

  const loadBandMembers = useCallback(async (bandId: string) => {
    if (!user?.id) return;

    try {
      const { data: memberData, error: memberError } = await supabase
        .from('band_members')
        .select('id, band_id, user_id, role, salary, joined_at')
        .eq('band_id', bandId)
        .order('joined_at', { ascending: true });

      if (memberError) throw memberError;

      const memberRows = (memberData ?? []) as BandMemberRow[];
      const memberIds = memberRows
        .map((member) => member.user_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0);

      let profilesMap = new Map<string, Pick<ProfileRow, 'display_name' | 'avatar_url'>>();
      let skillsMap = new Map<string, PlayerSkillsRow | null>();

      if (memberIds.length > 0) {
        const [profilesResponse, skillsResponse] = await Promise.all([
          supabase
            .from('profiles')
            .select('user_id, display_name, avatar_url')
            .in('user_id', memberIds),
          supabase
            .from('player_skills')
            .select('*')
            .in('user_id', memberIds)
        ]);

        if (profilesResponse.error) throw profilesResponse.error;
        if (skillsResponse.error) throw skillsResponse.error;

        profilesMap = new Map(
          ((profilesResponse.data as ProfileRow[]) ?? []).map((profile) => [profile.user_id, profile])
        );

        skillsMap = new Map(
          ((skillsResponse.data as PlayerSkillsRow[]) ?? []).map((skill) => [skill.user_id, skill])
        );
      }

      const currentUserId = user.id;

      const membersWithData: BandMember[] = memberRows.map((member) => {
        const profile = profilesMap.get(member.user_id) ?? null;
        const memberSkills = skillsMap.get(member.user_id) ?? null;

        return {
          id: member.id,
          band_id: member.band_id,
          user_id: member.user_id,
          role: member.role,
          salary: member.salary ?? null,
          joined_at: member.joined_at ?? null,
          name: member.user_id === currentUserId ? 'You' : profile?.display_name ?? 'Unknown',
          avatar_url: profile?.avatar_url ?? '',
          is_player: member.user_id === currentUserId,
          skills: memberSkills ?? null,
        };
      });

      setMembers(membersWithData);
    } catch (error: unknown) {
      console.error('Error loading band members:', error);
    }
  }, [user?.id]);
  const loadBandStats = useCallback(async (bandId: string) => {
    if (!user?.id || !bandId) {
      setChartPosition(null);
      setGigsPlayed(null);
      setSongCount(0);
      setAlbumCount(0);
      return;
    }

    try {
      const [{ data: memberRows, error: memberError }, { data: gigRows, error: gigsError }] = await Promise.all([
        supabase
          .from('band_members')
          .select('user_id')
          .eq('band_id', bandId),
        supabase
          .from('gigs')
          .select('id, status, scheduled_date, venue:venues(name, location)')
          .eq('band_id', bandId)
      ]);

      if (memberError) throw memberError;
      if (gigsError) throw gigsError;

      const memberIds = (memberRows ?? [])
        .map((row) => row.user_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0);

      const gigsPlayedCount = (gigRows as GigRow[] | null | undefined)?.filter((gig) => gig.status === 'completed').length ?? 0;
      setGigsPlayed(gigsPlayedCount);

      let songsData: SongRow[] = [];
      let songsError: unknown = null;

      const primarySongsResponse = await supabase
        .from('songs')
        .select('*')
        .eq('band_id', bandId);

      if (primarySongsResponse.error) {
        songsError = primarySongsResponse.error;
      } else {
        songsData = (primarySongsResponse.data as SongRow[]) ?? [];
      }

      if ((songsError || songsData.length === 0) && memberIds.length > 0) {
        const artistResponse = await supabase
          .from('songs')
          .select('*')
          .in('artist_id', memberIds);

        if (artistResponse.error) {
          const message = artistResponse.error.message?.toLowerCase() ?? '';
          if (message.includes('artist_id')) {
            const userIdResponse = await supabase
              .from('songs')
              .select('*')
              .in('user_id', memberIds);

            if (!userIdResponse.error) {
              songsData = (userIdResponse.data as SongRow[]) ?? [];
            } else {
              songsError = userIdResponse.error;
            }
          } else {
            songsError = artistResponse.error;
          }
        } else {
          songsData = (artistResponse.data as SongRow[]) ?? [];
          songsError = null;
        }
      }

      if (songsError) {
        console.error('Error loading songs for band:', songsError);
      }

      const totalSongs = songsData.length;
      setSongCount(totalSongs);

      const albumNames = new Set<string>();
      const chartPositions: number[] = [];

      songsData.forEach((song) => {
        const record = song as SongRow & {
          album?: string | null;
          album_name?: string | null;
          albumTitle?: string | null;
        };

        const albumName = record.album ?? record.album_name ?? record.albumTitle ?? null;
        if (typeof albumName === 'string' && albumName.trim().length > 0) {
          albumNames.add(albumName.trim());
        }

        const rawPosition = (song as Record<string, unknown>).chart_position ?? (song as Record<string, unknown>).chartPosition;
        if (typeof rawPosition === 'number' && Number.isFinite(rawPosition)) {
          chartPositions.push(rawPosition);
        } else if (typeof rawPosition === 'string') {
          const parsed = Number(rawPosition);
          if (!Number.isNaN(parsed)) {
            chartPositions.push(parsed);
          }
        }
      });

      setAlbumCount(albumNames.size);
      setChartPosition(chartPositions.length > 0 ? Math.min(...chartPositions) : null);
    } catch (error: unknown) {
      console.error('Error loading band stats:', error);
    }
  }, [user?.id]);

  const loadScheduleEvents = useCallback(async (bandId: string) => {
    if (!user?.id || !bandId) {
      setScheduleEvents([]);
      return;
    }

    try {
      const now = new Date();
      const todayString = now.toISOString().split('T')[0];

      const [gigsResponse, scheduleResponse] = await Promise.all([
        supabase
          .from('gigs')
          .select('id, scheduled_date, status, venue:venues(name, location)')
          .eq('band_id', bandId)
          .gte('scheduled_date', now.toISOString())
          .order('scheduled_date', { ascending: true }),
        supabase
          .from('schedule_events')
          .select('id, title, type, date, time, status, location, description')
          .eq('user_id', user.id)
          .gte('date', todayString)
          .order('date', { ascending: true })
          .order('time', { ascending: true })
      ]);

      const gigEvents: BandScheduleEvent[] = ((gigsResponse.data as GigRow[]) ?? []).map((gig) => {
        const scheduledAt = gig.scheduled_date ?? null;
        const timestamp = scheduledAt ? new Date(scheduledAt).getTime() : null;

        const venueName = gig.venue?.name ?? 'Live Performance';
        const venueLocation = gig.venue?.location ?? null;
        let description: string | null = null;
        if (gig.status === 'completed') {
          description = 'Completed performance';
        } else if (gig.status === 'cancelled') {
          description = 'Cancelled performance';
        }

        return {
          id: gig.id,
          title: `Gig at ${venueName}`,
          description,
          location: venueLocation,
          eventType: 'gig',
          scheduledAt,
          timestamp,
          status: gig.status ?? null,
        };
      });

      const scheduleItems: BandScheduleEvent[] = ((scheduleResponse.data as ScheduleEventRow[]) ?? [])
        .map((event) => {
          const timeValue = typeof event.time === 'string' ? event.time : event.time?.toString?.() ?? null;
          const normalizedTime = timeValue && timeValue.length === 5 ? `${timeValue}:00` : timeValue;
          const scheduledAt = event.date
            ? `${event.date}T${normalizedTime ?? '00:00:00'}`
            : null;
          const timestamp = scheduledAt ? new Date(scheduledAt).getTime() : null;

          return {
            id: event.id,
            title: event.title,
            description: event.description ?? null,
            location: event.location ?? null,
            eventType: event.type ?? null,
            scheduledAt,
            timestamp,
            status: event.status ?? null,
          };
        })
        .filter((event) => event.timestamp === null || event.timestamp >= now.getTime());

      const combinedEvents = [...gigEvents, ...scheduleItems];
      combinedEvents.sort((a, b) => {
        if (a.timestamp === null && b.timestamp === null) return 0;
        if (a.timestamp === null) return 1;
        if (b.timestamp === null) return -1;
        return a.timestamp - b.timestamp;
      });

      setScheduleEvents(combinedEvents);
    } catch (error: unknown) {
      console.error('Error loading band schedule:', error);
      setScheduleEvents([]);
    }
  }, [user?.id]);

  const loadPendingInvitations = useCallback(async () => {
    if (!user?.id) {
      setPendingInvites([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('band_invitations')
        .select(`
          id,
          band_id,
          inviter_id,
          invitee_id,
          role,
          salary,
          status,
          created_at,
          responded_at,
          band:bands (
            id,
            name,
            genre,
            description,
            leader_id,
            popularity,
            weekly_fans,
            max_members,
            created_at,
            updated_at
          )
        `)
        .eq('invitee_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (error) throw error;

      setPendingInvites((data as BandInvitation[]) || []);
    } catch (error: unknown) {
      console.error('Error loading band invitations:', error);
    }
  }, [user?.id]);

  const loadBandData = useCallback(async () => {
    if (!user?.id) {
      setBand(null);
      setMembers([]);
      setPendingInvites([]);
      setScheduleEvents([]);
      setSongCount(0);
      setAlbumCount(0);
      setChartPosition(null);
      setGigsPlayed(null);
      setLoading(false);
      return;
    }
    try {
      const { data: memberData, error: memberError } = await supabase
        .from('band_members')
        .select(`
          *,
          bands!band_members_band_id_fkey(*)
        `)
        .eq('user_id', user.id)
        .single();

      if (memberError && memberError.code !== 'PGRST116') {
        throw memberError;
      }

      if (memberData?.bands) {
        setBand(memberData.bands as Band);
        setPendingInvites([]);
        await Promise.all([
          loadBandMembers(memberData.bands.id),
          loadBandStats(memberData.bands.id),
          loadScheduleEvents(memberData.bands.id)
        ]);
      } else {
        setBand(null);
        setMembers([]);
        await loadPendingInvitations();
        setScheduleEvents([]);
        setSongCount(0);
        setAlbumCount(0);
        setChartPosition(null);
        setGigsPlayed(null);
      }
    } catch (error: unknown) {
      console.error('Error loading band data:', error);
    } finally {
      setLoading(false);
    }
  }, [
    loadBandMembers,
    loadBandStats,
    loadPendingInvitations,
    loadScheduleEvents,
    user?.id
  ]);

  useEffect(() => {
    if (authLoading) return;

    if (user) {
      loadBandData();
    } else {
      setBand(null);
      setMembers([]);
      setPendingInvites([]);
      setLoading(false);
    }
  }, [authLoading, user, loadBandData]);

  const createBand = async () => {
    if (!user || !profile) return;

    setCreating(true);
    try {
      const { data: bandData, error: bandError } = await supabase
        .from('bands')
        .insert({
          name: `${profile.display_name || 'Player'}'s Band`,
          genre: 'Rock',
          description: 'A new band ready to rock the world!',
          leader_id: user.id
        })
        .select()
        .single();

      if (bandError) throw bandError;

      // Add the user as the first member
      const { error: memberError } = await supabase
        .from('band_members')
        .insert({
          band_id: bandData.id,
          user_id: user.id,
          role: 'Lead Vocals',
          salary: 0
        });

      if (memberError) throw memberError;

      setBand(bandData);
      await Promise.all([
        loadBandMembers(bandData.id),
        loadBandStats(bandData.id),
        loadScheduleEvents(bandData.id)
      ]);

      toast({
        title: "Band Created!",
        description: "Your musical journey as a band begins now!",
      });
    } catch (error: unknown) {
      console.error('Error creating band:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create band",
      });
    } finally {
      setCreating(false);
    }
  };

  const sendInvite = async () => {
    if (!user || !band) {
      toast({
        variant: "destructive",
        title: "No Band Available",
        description: "You need to have an active band before recruiting members.",
      });
      return;
    }

    if (!inviteRole) {
      toast({
        variant: "destructive",
        title: "Role Required",
        description: "Please select a role for the invitation.",
      });
      return;
    }

    if (band.max_members && members.length >= band.max_members) {
      toast({
        variant: "destructive",
        title: "Band Full",
        description: "Your band has reached its maximum number of members.",
      });
      return;
    }

    const salaryValue = Number.isFinite(inviteSalary)
      ? Math.max(0, Math.round(inviteSalary))
      : 0;

    setSendingInvite(true);

    try {
      const { error } = await supabase
        .from('band_invitations')
        .insert({
          band_id: band.id,
          inviter_id: user.id,
          role: inviteRole,
          salary: salaryValue,
        });

      if (error) throw error;

      toast({
        title: "Invitation Sent",
        description: "Your recruitment invitation is now live.",
      });

      setIsRecruitDialogOpen(false);
      setInviteRole(BAND_ROLES[0]);
      setInviteSalary(0);
    } catch (error: unknown) {
      console.error('Error sending band invitation:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to send invitation. Please try again.",
      });
    } finally {
      setSendingInvite(false);
    }
  };

  const acceptInvite = async (invitation: BandInvitation) => {
    if (!user) return;

    setAcceptingInviteId(invitation.id);

    try {
      const { data: updatedInvitation, error } = await supabase
        .from('band_invitations')
        .update({
          status: 'accepted',
          invitee_id: user.id,
          responded_at: new Date().toISOString(),
        })
        .eq('id', invitation.id)
        .eq('status', 'pending')
        .select(`
          id,
          band_id,
          role,
          salary
        `)
        .single();

      if (error) throw error;
      if (!updatedInvitation) throw new Error('Invitation not found');

      const { error: memberError } = await supabase
        .from('band_members')
        .insert({
          band_id: updatedInvitation.band_id,
          user_id: user.id,
          role: updatedInvitation.role,
          salary: updatedInvitation.salary ?? 0,
        });

      if (memberError && memberError.code !== '23505') {
        throw memberError;
      }

      setPendingInvites(prev => prev.filter(invite => invite.id !== invitation.id));

      const { data: bandData, error: bandError } = await supabase
        .from('bands')
        .select('*')
        .eq('id', updatedInvitation.band_id)
        .single();

      if (bandError) throw bandError;

      if (bandData) {
        setBand(bandData as Band);
        await Promise.all([
          loadBandMembers(bandData.id),
          loadBandStats(bandData.id),
          loadScheduleEvents(bandData.id)
        ]);
      }

      toast({
        title: "Invitation Accepted",
        description: "Welcome to your new band!",
      });
    } catch (error: unknown) {
      console.error('Error accepting band invitation:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to accept invitation.',
      });
    } finally {
      setAcceptingInviteId(null);
    }
  };

  const getRoleIcon = (role: string) => {
    if (role.includes("Vocal")) return <Mic className="h-4 w-4" />;
    if (role.includes("Guitar")) return <Guitar className="h-4 w-4" />;
    if (role.includes("Drum")) return <Drum className="h-4 w-4" />;
    return <Music className="h-4 w-4" />;
  };

  const getSkillColor = (value: number) => {
    if (value >= 80) return "text-success";
    if (value >= 60) return "text-warning";
    return "text-muted-foreground";
  };

  const getEventTypeIcon = (type?: string | null) => {
    const normalized = type?.toLowerCase() ?? '';

    if (normalized.includes('record')) return <Mic className="h-4 w-4 text-primary" />;
    if (normalized.includes('rehearsal') || normalized.includes('practice')) return <Drum className="h-4 w-4 text-primary" />;
    if (normalized.includes('meeting')) return <Users className="h-4 w-4 text-primary" />;
    if (normalized.includes('tour')) return <Star className="h-4 w-4 text-primary" />;
    if (normalized.includes('gig') || normalized.includes('show') || normalized.includes('concert')) {
      return <Music className="h-4 w-4 text-primary" />;
    }

    return <Music className="h-4 w-4 text-primary" />;
  };

  const formatEventType = (type?: string | null) => {
    if (!type) return null;
    return type
      .replace(/[_-]/g, ' ')
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getEventTimingLabel = (timestamp: number | null) => {
    if (!timestamp) return 'Date TBA';

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const eventDate = new Date(timestamp);
    if (Number.isNaN(eventDate.getTime())) return 'Date TBA';

    const startOfEventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate()).getTime();
    const diffDays = Math.round((startOfEventDay - startOfToday) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays < 0) {
      const daysAgo = Math.abs(diffDays);
      return `${daysAgo} day${daysAgo === 1 ? '' : 's'} ago`;
    }
    return `In ${diffDays} days`;
  };

  const formatEventDateTime = (scheduledAt: string | null) => {
    if (!scheduledAt) return 'Date TBA';
    const eventDate = new Date(scheduledAt);
    if (Number.isNaN(eventDate.getTime())) return 'Date TBA';

    const datePart = eventDate.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: eventDate.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });

    const timePart = eventDate.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });

    return `${datePart} • ${timePart}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-stage flex items-center justify-center p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg font-oswald">Loading band data...</p>
        </div>
      </div>
    );
  }

  // If no band, show pending invitations or creation interface
  if (!band) {
    if (pendingInvites.length > 0) {
      return (
        <div className="min-h-screen bg-gradient-stage flex items-center justify-center p-6">
          <Card className="bg-card/80 backdrop-blur-sm border-primary/20 w-full max-w-3xl">
            <CardHeader className="text-center space-y-2">
              <CardTitle className="text-2xl bg-gradient-primary bg-clip-text text-transparent">
                Band Invitations
              </CardTitle>
              <CardDescription>
                {pendingInvites.length > 1
                  ? "You've received new invitations to join a band. Review and accept the role that fits you best."
                  : "You've been invited to join a band. Review the offer and accept to begin performing together."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {pendingInvites.map((invite) => (
                <div
                  key={invite.id}
                  className="p-4 rounded-lg bg-secondary/30 border border-primary/10 space-y-3"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">
                        {invite.band?.name || "New Band Opportunity"}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {invite.band?.genre ? `${invite.band.genre} • ` : ""}Role: {invite.role}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-sm border-primary/40 text-primary">
                      ${invite.salary ?? 0}/week
                    </Badge>
                  </div>
                  {invite.band?.description && (
                    <p className="text-sm text-muted-foreground">
                      {invite.band.description}
                    </p>
                  )}
                  <div className="flex items-center justify-end">
                    <Button
                      className="bg-gradient-primary"
                      onClick={() => acceptInvite(invite)}
                      disabled={acceptingInviteId === invite.id}
                    >
                      {acceptingInviteId === invite.id ? "Accepting..." : "Accept Invitation"}
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-stage flex items-center justify-center p-6">
        <Card className="bg-card/80 backdrop-blur-sm border-primary/20 max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl bg-gradient-primary bg-clip-text text-transparent">
              Start Your Band
            </CardTitle>
            <CardDescription>
              Create a band and recruit talented musicians to join your musical journey
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center space-y-2">
              <Users className="h-16 w-16 text-primary mx-auto" />
              <p className="text-muted-foreground">
                You're currently a solo artist. Create a band to collaborate with other musicians!
              </p>
            </div>
            <Button
              onClick={createBand}
              disabled={creating}
              className="w-full bg-gradient-primary"
            >
              {creating ? "Creating..." : "Create Band"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isBandAtCapacity = band.max_members ? members.length >= band.max_members : false;
  const memberCapacityLabel = band.max_members ? `${members.length}/${band.max_members}` : `${members.length}`;
  const upcomingEvents = scheduleEvents.slice(0, 5);

  return (
    <div className="min-h-screen bg-gradient-stage p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              {band.name}
            </h1>
            <p className="text-muted-foreground">{band.genre} • {memberCapacityLabel} members</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={isRecruitDialogOpen} onOpenChange={setIsRecruitDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-primary hover:shadow-electric">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Recruit Member
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Recruit a New Member</DialogTitle>
                  <DialogDescription>
                    Customize the role and salary offer for your next band mate.
                  </DialogDescription>
                </DialogHeader>
                {isBandAtCapacity && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                    Your band has reached its member limit. Remove a member before sending new invitations.
                  </div>
                )}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="invite-role">Role</Label>
                    <Select value={inviteRole} onValueChange={(value) => setInviteRole(value)}>
                      <SelectTrigger id="invite-role">
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                      <SelectContent>
                        {BAND_ROLES.map((role) => (
                          <SelectItem key={role} value={role}>
                            {role}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invite-salary">Weekly Salary Offer</Label>
                    <Input
                      id="invite-salary"
                      type="number"
                      min={0}
                      step={50}
                      value={inviteSalary}
                      onChange={(event) => {
                        const nextValue = Number(event.target.value);
                        setInviteSalary(Number.isNaN(nextValue) ? 0 : nextValue);
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      Offer a weekly stipend to attract skilled musicians.
                    </p>
                  </div>
                </div>
                <DialogFooter className="gap-2 sm:justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setIsRecruitDialogOpen(false)}
                    disabled={sendingInvite}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="bg-gradient-primary"
                    onClick={sendInvite}
                    disabled={sendingInvite || !inviteRole || isBandAtCapacity}
                  >
                    {sendingInvite ? "Sending..." : "Send Invitation"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button variant="outline" className="border-primary/20 hover:bg-primary/10">
              <Settings className="h-4 w-4 mr-2" />
              Band Settings
            </Button>
          </div>
        </div>

        {/* Band Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Popularity</CardTitle>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{band.popularity}%</div>
              <Progress value={band.popularity} className="mt-2" />
              <p className="text-xs text-muted-foreground mt-1">
                Band popularity
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Fans</CardTitle>
              <Users className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">
                {band.weekly_fans.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                Weekly fan growth
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Chart Position</CardTitle>
              <Star className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">
                {chartPosition !== null ? `#${chartPosition}` : 'N/A'}
              </div>
              <p className="text-xs text-muted-foreground">
                Best chart ranking
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gigs Played</CardTitle>
              <Music className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                {gigsPlayed !== null ? gigsPlayed : 'N/A'}
              </div>
              <p className="text-xs text-muted-foreground">
                Completed gigs
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Band Members */}
        <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Band Members
            </CardTitle>
            <CardDescription>
              Your musical collaborators
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {members.map((member) => (
                <div key={member.id} className="p-4 rounded-lg bg-secondary/30 border border-primary/10">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={member.avatar_url} />
                        <AvatarFallback className="bg-gradient-primary text-primary-foreground">
                          {member.name?.split(' ').map(n => n[0]).join('') || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-semibold flex items-center gap-2">
                          {member.name}
                          {member.is_player && (
                            <Badge variant="outline" className="text-xs border-primary text-primary">
                              You
                            </Badge>
                          )}
                        </h3>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          {getRoleIcon(member.role)}
                          {member.role}
                        </p>
                      </div>
                    </div>
                    {member.salary > 0 && (
                      <Badge variant="outline" className="text-xs border-success text-success">
                        ${member.salary}/week
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">Skills</h4>
                    {member.is_player && skills ? (
                      Object.entries(skills).filter(([key]) => key !== 'id' && key !== 'user_id' && key !== 'created_at' && key !== 'updated_at').map(([skill, value]) => (
                        <div key={skill} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="capitalize">{skill}</span>
                            <span className={getSkillColor(value as number)}>{value}/100</span>
                          </div>
                          <Progress value={value as number} className="h-1.5" />
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        Skills unavailable for other members
                      </div>
                    )}
                  </div>

                  {!member.is_player && (
                    <div className="mt-4 pt-3 border-t border-primary/10">
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="text-xs">
                          View Profile
                        </Button>
                        <Button size="sm" variant="outline" className="text-xs text-destructive border-destructive/20">
                          Replace
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Band Achievements */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader>
              <CardTitle>Achievements</CardTitle>
              <CardDescription>Your band's milestones</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10">
                <div className="flex items-center gap-3">
                  <Music className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Songs Written</p>
                    <p className="text-sm text-muted-foreground">Creative output</p>
                  </div>
                </div>
                <span className="text-lg font-bold text-primary">
                  {songCount.toLocaleString()}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-accent/10">
                <div className="flex items-center gap-3">
                  <Star className="h-5 w-5 text-accent" />
                  <div>
                    <p className="font-medium">Albums Released</p>
                    <p className="text-sm text-muted-foreground">Studio recordings</p>
                  </div>
                </div>
                <span className="text-lg font-bold text-accent">
                  {albumCount.toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader>
              <CardTitle>Weekly Schedule</CardTitle>
              <CardDescription>
                {upcomingEvents.length > 0
                  ? `${upcomingEvents.length} upcoming event${upcomingEvents.length === 1 ? '' : 's'}`
                  : 'Upcoming band activities'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcomingEvents.length === 0 ? (
                <div className="p-4 rounded-lg border border-dashed border-primary/30 bg-secondary/20 text-sm text-muted-foreground">
                  No upcoming events scheduled. Add gigs, rehearsals, or meetings to keep your band active.
                </div>
              ) : (
                upcomingEvents.map((event) => {
                  const typeLabel = formatEventType(event.eventType);
                  const timingLabel = getEventTimingLabel(event.timestamp);
                  const dateTimeLabel = formatEventDateTime(event.scheduledAt);

                  return (
                    <div key={event.id} className="p-3 rounded-lg bg-secondary/30 border border-primary/10">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className="mt-1 text-primary">
                            {getEventTypeIcon(event.eventType)}
                          </div>
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium">{event.title}</p>
                              {typeLabel && (
                                <Badge variant="outline" className="text-xs capitalize">
                                  {typeLabel}
                                </Badge>
                              )}
                            </div>
                            {event.description && (
                              <p className="text-sm text-muted-foreground">{event.description}</p>
                            )}
                            {event.location && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {event.location}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right space-y-1">
                          <Badge variant="outline" className="text-xs">
                            {timingLabel}
                          </Badge>
                          <p className="text-xs text-muted-foreground">{dateTimeLabel}</p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default BandManager;