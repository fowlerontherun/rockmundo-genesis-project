import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth-context';
import { BandCreationForm } from '@/components/band/BandCreationForm';
import { BandOverview } from '@/components/band/BandOverview';
import { BandMemberCard } from '@/components/band/BandMemberCard';
import { AddTouringMember } from '@/components/band/AddTouringMember';
import { ChemistryDisplay } from '@/components/band/ChemistryDisplay';
import { BandChat } from '@/components/band/BandChat';
import { BandEarnings } from '@/components/band/BandEarnings';
import { InviteFriendToBand } from '@/components/band/InviteFriendToBand';
import { BandSettingsTab } from '@/components/band/BandSettingsTab';
import { BandStatusBanner } from '@/components/band/BandStatusBanner';
import { BandSongGifts } from '@/components/band/BandSongGifts';
import { BandSongsTab } from '@/components/band/BandSongsTab';
import { GigHistoryTab } from '@/components/band/GigHistoryTab';
import { Users, Music } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getUserBands } from '@/utils/bandStatus';
import { reactivateBand } from '@/utils/bandHiatus';
import { getBandStatusLabel, getBandStatusColor } from '@/utils/bandStatus';
import { useAutoGigExecution } from '@/hooks/useAutoGigExecution';

export default function BandManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [userBands, setUserBands] = useState<any[]>([]);
  const [selectedBandId, setSelectedBandId] = useState<string | null>(null);
  const [selectedBand, setSelectedBand] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Enable auto-gig execution for the selected band
  useAutoGigExecution(selectedBandId);

  useEffect(() => {
    if (user) {
      loadUserBands();
    }
  }, [user]);

  useEffect(() => {
    if (selectedBandId) {
      loadBandDetails(selectedBandId);
    }
  }, [selectedBandId]);

  const loadUserBands = async () => {
    if (!user) return;

    try {
      const bands = await getUserBands(user.id);
      
      // Filter out disbanded bands
      const activeBands = bands.filter((b: any) => b.bands.status !== 'disbanded');
      setUserBands(activeBands);

      // Auto-select first active band, or first hiatus band
      const activeFirst = activeBands.find((b: any) => b.bands.status === 'active');
      const defaultBand = activeFirst || activeBands[0];
      
      if (defaultBand) {
        setSelectedBandId(defaultBand.band_id);
      }
    } catch (error) {
      console.error('Error loading bands:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBandDetails = async (bandId: string) => {
    try {
      // Load band data
      const { data: band } = await supabase
        .from('bands')
        .select('*')
        .eq('id', bandId)
        .single();

      if (band) {
        setSelectedBand(band);
        await loadBandMembers(bandId);
      }
    } catch (error) {
      console.error('Error loading band details:', error);
    }
  };

  const loadBandMembers = async (bandId: string) => {
    // First get all band members (including touring members with null user_id)
    const { data: bandMembersData } = await supabase
      .from('band_members')
      .select('*')
      .eq('band_id', bandId)
      .order('joined_at', { ascending: true });

    if (!bandMembersData) {
      setMembers([]);
      return;
    }

    // Get user_ids that are not null
    const userIds = bandMembersData
      .map(m => m.user_id)
      .filter((id): id is string => id !== null);

    // Fetch profiles for human members only
    let profilesData: any[] = [];
    if (userIds.length > 0) {
      const { data } = await supabase
        .from('profiles')
        .select('user_id, display_name, username')
        .in('user_id', userIds);
      profilesData = data || [];
    }

    // Attach profile data to members
    const membersWithProfiles = bandMembersData.map(member => {
      if (member.user_id) {
        const profile = profilesData.find(p => p.user_id === member.user_id);
        return { ...member, profiles: profile || null };
      }
      return { ...member, profiles: null };
    });

    setMembers(membersWithProfiles);
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from('band_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      toast({
        title: 'Member Removed',
        description: 'The band member has been removed',
      });

      if (selectedBandId) {
        await loadBandMembers(selectedBandId);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove member',
        variant: 'destructive',
      });
    }
  };

  const handleReactivate = async () => {
    if (!user || !selectedBandId) return;

    try {
      const result = await reactivateBand(selectedBandId, user.id);
      
      if (result.success) {
        toast({
          title: 'Band Reactivated',
          description: 'Your band is now active again',
        });
        await loadUserBands();
      } else if (result.conflicts && result.conflicts.length > 0) {
        toast({
          title: 'Conflicts Detected',
          description: `${result.conflicts.length} member(s) need to resolve conflicts with other bands`,
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to reactivate band',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  if (!selectedBand || userBands.length === 0) {
    return (
      <div className="container mx-auto p-6 max-w-2xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Band Manager</h1>
          <p className="text-muted-foreground">Create a band or become a solo artist to begin</p>
        </div>
        <BandCreationForm onBandCreated={loadUserBands} />
      </div>
    );
  }

  const currentMembership = selectedBand
    ? userBands.find((band) => band.band_id === selectedBand.id)
    : undefined;

  const isLeader = Boolean(
    (user && selectedBand.leader_id === user.id) ||
      currentMembership?.role === 'leader' ||
      (user && currentMembership?.bands?.leader_id === user.id)
  );

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Music className="h-8 w-8" />
              {selectedBand.is_solo_artist ? (selectedBand.artist_name || selectedBand.name) : selectedBand.name}
            </h1>
            <p className="text-muted-foreground">
              {selectedBand.genre} • {selectedBand.is_solo_artist ? 'Solo Artist' : 'Band'}
            </p>
          </div>
          
          {/* Band Selector (if user has multiple bands) */}
          {userBands.length > 1 && (
            <Select value={selectedBandId || ''} onValueChange={setSelectedBandId}>
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {userBands.map((band) => (
                  <SelectItem key={band.band_id} value={band.band_id}>
                    <div className="flex items-center gap-2">
                      <span>{band.bands.name}</span>
                      <Badge className={getBandStatusColor(band.bands.status)}>
                        {getBandStatusLabel(band.bands.status)}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Status Banner for Hiatus */}
        <BandStatusBanner
          status={selectedBand.status}
          hiatusStartedAt={selectedBand.hiatus_started_at}
          hiatusEndsAt={selectedBand.hiatus_ends_at}
          hiatusReason={selectedBand.hiatus_reason}
          isLeader={isLeader}
          onReactivate={handleReactivate}
        />
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="songs">Songs</TabsTrigger>
            <TabsTrigger value="history">Gig History</TabsTrigger>
            <TabsTrigger value="chat">Chat</TabsTrigger>
            <TabsTrigger value="earnings">Earnings</TabsTrigger>
            <TabsTrigger value="chemistry">Chemistry</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <BandSongGifts bandId={selectedBand.id} />
          <BandOverview bandId={selectedBand.id} />
        </TabsContent>

        <TabsContent value="members" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Band Members</CardTitle>
                  <CardDescription>
                    {members.length} of {selectedBand.max_members} members
                  </CardDescription>
                </div>
                {isLeader && selectedBand.status === 'active' && (
                  <div className="flex gap-2">
                    <InviteFriendToBand
                      bandId={selectedBand.id}
                      bandName={selectedBand.name}
                      currentUserId={user!.id}
                    />
                    <AddTouringMember 
                      bandId={selectedBand.id} 
                      onAdded={() => loadBandMembers(selectedBand.id)} 
                    />
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {members.map((member) => (
                <BandMemberCard
                  key={member.id}
                  member={member}
                  isLeader={member.user_id === selectedBand.leader_id}
                  canManage={isLeader && selectedBand.status === 'active'}
                  onRemove={
                    isLeader && member.user_id !== selectedBand.leader_id && selectedBand.status === 'active'
                      ? () => handleRemoveMember(member.id)
                      : undefined
                  }
                />
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="songs" className="space-y-4">
          <BandSongsTab bandId={selectedBand.id} />
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <GigHistoryTab bandId={selectedBand.id} />
        </TabsContent>

        <TabsContent value="chat" className="space-y-4">
          <BandChat bandId={selectedBand.id} />
        </TabsContent>

        <TabsContent value="earnings" className="space-y-4">
          <BandEarnings bandId={selectedBand.id} isLeader={isLeader} />
        </TabsContent>

        <TabsContent value="chemistry" className="space-y-4">
          <ChemistryDisplay bandId={selectedBand.id} />
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <BandSettingsTab
            bandId={selectedBand.id}
            isLeader={isLeader}
            bandStatus={selectedBand.status}
            isSoloArtist={selectedBand.is_solo_artist}
            onBandUpdate={loadUserBands}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
