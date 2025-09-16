import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useGameData } from "@/hooks/useGameData";

interface BandMember {
  id: string;
  user_id: string;
  band_id: string;
  role: string;
  salary: number;
  joined_at: string;
  name?: string;
  skills?: any;
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

interface BandScheduleEvent {
  id: string;
  title: string;
  description?: string | null;
  eventType?: string | null;
  scheduledAt: string | null;
  timestamp: number | null;
  location?: string | null;
  status?: string | null;
}

interface RawScheduleEvent {
  id: string;
  title?: string | null;
  description?: string | null;
  details?: string | null;
  notes?: string | null;
  event_type?: string | null;
  type?: string | null;
  status?: string | null;
  state?: string | null;
  event_status?: string | null;
  location?: string | null;
  venue?: string | null;
  place?: string | null;
  address?: string | null;
  scheduled_at?: string | Date | number | null;
  scheduledAt?: string | Date | number | null;
  event_at?: string | Date | number | null;
  eventAt?: string | Date | number | null;
  event_date?: string | Date | number | null;
  eventDate?: string | Date | number | null;
  scheduled_date?: string | Date | number | null;
  scheduledDate?: string | Date | number | null;
  start_time?: string | Date | number | null;
  startTime?: string | Date | number | null;
  start_at?: string | Date | number | null;
  startAt?: string | Date | number | null;
  datetime?: string | Date | number | null;
  dateTime?: string | Date | number | null;
  date_time?: string | Date | number | null;
  date?: string | null;
  time?: string | null;
  [key: string]: unknown;
}

const BandManager = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { profile, skills } = useGameData();

  const [band, setBand] = useState<Band | null>(null);
  const [members, setMembers] = useState<BandMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [songCount, setSongCount] = useState(0);
  const [albumCount, setAlbumCount] = useState(0);
  const [upcomingEvents, setUpcomingEvents] = useState<BandScheduleEvent[]>([]);

  const loadBandStats = useCallback(async (bandId: string) => {
    try {
      const [songsResponse, albumsResponse] = await Promise.all([
        supabase
          .from('songs')
          .select('id', { count: 'exact', head: true })
          .eq('band_id', bandId),
        supabase
          .from('albums')
          .select('id', { count: 'exact', head: true })
          .eq('band_id', bandId)
      ]);

      if (songsResponse.error) {
        console.error('Error loading band songs:', songsResponse.error);
        setSongCount(0);
      } else {
        setSongCount(songsResponse.count ?? 0);
      }

      if (albumsResponse.error) {
        console.error('Error loading band albums:', albumsResponse.error);
        setAlbumCount(0);
      } else {
        setAlbumCount(albumsResponse.count ?? 0);
      }
    } catch (error) {
      console.error('Error loading band stats:', error);
    }
  }, []);

  const loadScheduleEvents = useCallback(async (bandId: string) => {
    try {
      const { data, error } = await supabase
        .from('schedule_events')
        .select('*')
        .eq('band_id', bandId)
        .order('scheduled_at', { ascending: true });

      if (error) throw error;

      const normalizeDateValue = (value: unknown): string | null => {
        if (!value) return null;

        if (value instanceof Date) {
          return value.toISOString();
        }

        if (typeof value === 'number') {
          const date = new Date(value);
          return Number.isNaN(date.getTime()) ? null : date.toISOString();
        }

        if (typeof value === 'string') {
          const trimmed = value.trim();
          if (!trimmed) return null;
          const normalized = trimmed.includes(' ') && !trimmed.includes('T')
            ? trimmed.replace(' ', 'T')
            : trimmed;
          const date = new Date(normalized);
          if (!Number.isNaN(date.getTime())) {
            return date.toISOString();
          }
        }

        return null;
      };

      const extractEventDate = (event: RawScheduleEvent): string | null => {
        const candidates = [
          event?.scheduled_at,
          event?.scheduledAt,
          event?.event_at,
          event?.eventAt,
          event?.event_date,
          event?.eventDate,
          event?.scheduled_date,
          event?.scheduledDate,
          event?.start_time,
          event?.startTime,
          event?.start_at,
          event?.startAt,
          event?.datetime,
          event?.dateTime,
          event?.date_time
        ];

        for (const candidate of candidates) {
          const iso = normalizeDateValue(candidate);
          if (iso) return iso;
        }

        if (event?.date) {
          const datePart = typeof event.date === 'string' ? event.date : null;
          const timePart = typeof event.time === 'string' ? event.time : null;
          if (datePart && timePart) {
            const iso = normalizeDateValue(`${datePart}T${timePart}`);
            if (iso) return iso;
          }

          if (datePart) {
            const iso = normalizeDateValue(datePart);
            if (iso) return iso;
          }
        }

        return null;
      };

      const isUpcomingStatus = (status?: string | null) => {
        if (!status) return true;
        const normalized = status.toLowerCase();
        return !['completed', 'cancelled', 'past'].includes(normalized);
      };

      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const eventsArray: RawScheduleEvent[] = Array.isArray(data) ? (data as RawScheduleEvent[]) : [];

      const normalizedEvents = eventsArray
        .map((event) => {
          const scheduledIso = extractEventDate(event);
          const timestamp = scheduledIso ? new Date(scheduledIso).getTime() : null;

          return {
            id: event.id,
            title: event.title ?? 'Scheduled Event',
            description: event.description ?? event.details ?? event.notes ?? null,
            eventType: event.event_type ?? event.type ?? null,
            scheduledAt: scheduledIso,
            timestamp: Number.isNaN(timestamp ?? NaN) ? null : timestamp,
            location: event.location ?? event.venue ?? event.place ?? event.address ?? null,
            status: event.status ?? event.state ?? event.event_status ?? null
          } as BandScheduleEvent;
        })
        .filter((event) => {
          if (!event.timestamp) return false;
          if (!isUpcomingStatus(event.status)) return false;
          return event.timestamp >= startOfToday.getTime();
        })
        .sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))
        .slice(0, 5);

      setUpcomingEvents(normalizedEvents);
    } catch (error) {
      console.error('Error loading schedule events:', error);
      setUpcomingEvents([]);
    }
  }, []);

  useEffect(() => {
    if (!band?.id) return;

    const bandId = band.id;

    const realtimeChannel = supabase
      .channel(`band-manager-${bandId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'songs',
          filter: `band_id=eq.${bandId}`
        },
        () => {
          loadBandStats(bandId);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'albums',
          filter: `band_id=eq.${bandId}`
        },
        () => {
          loadBandStats(bandId);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'schedule_events',
          filter: `band_id=eq.${bandId}`
        },
        () => {
          loadScheduleEvents(bandId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(realtimeChannel);
    };
  }, [band?.id, loadBandStats, loadScheduleEvents]);

  const loadBandMembers = useCallback(async (bandId: string) => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('band_members')
        .select(`
          *,
          profile:profiles(display_name, avatar_url),
          skills:player_skills(*)
        `)
        .eq('band_id', bandId);

      if (error) throw error;

      const membersWithData = data.map((member: any) => ({
        ...member,
        name: member.user_id === user.id ? 'You' : (member.profile?.display_name || 'Unknown'),
        avatar_url: member.profile?.avatar_url || '',
        is_player: member.user_id === user.id,
        skills: member.skills || {}
      }));

      setMembers(membersWithData);
    } catch (error) {
      console.error('Error loading band members:', error);
    }
  }, [user]);

  const loadBandData = useCallback(async () => {
    if (!user) {
      setBand(null);
      setMembers([]);
      setSongCount(0);
      setAlbumCount(0);
      setUpcomingEvents([]);
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
        const bandRecord = memberData.bands as Band;
        setBand(bandRecord);

        await Promise.all([
          loadBandMembers(bandRecord.id),
          loadBandStats(bandRecord.id),
          loadScheduleEvents(bandRecord.id)
        ]);
      } else {
        setBand(null);
        setMembers([]);
        setSongCount(0);
        setAlbumCount(0);
        setUpcomingEvents([]);
      }
    } catch (error) {
      console.error('Error loading band data:', error);
    } finally {
      setLoading(false);
    }
  }, [user, loadBandMembers, loadBandStats, loadScheduleEvents]);

  useEffect(() => {
    loadBandData();
  }, [loadBandData]);

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
    } catch (error: any) {
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

  // If no band, show creation interface
  if (!band) {
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

  return (
    <div className="min-h-screen bg-gradient-stage p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              {band.name}
            </h1>
            <p className="text-muted-foreground">{band.genre} • {members.length}/{band.max_members} members</p>
          </div>
          <div className="flex gap-2">
            <Button className="bg-gradient-primary hover:shadow-electric">
              <UserPlus className="h-4 w-4 mr-2" />
              Recruit Member
            </Button>
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
              <div className="text-2xl font-bold text-warning">{members.length}</div>
              <p className="text-xs text-muted-foreground">
                Band members
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
                {new Date(band.created_at).toLocaleDateString()}
              </div>
              <p className="text-xs text-muted-foreground">
                Band formed
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