import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth-context';
import { BandCreationForm } from '@/components/band/BandCreationForm';
import { BandOverview } from '@/components/band/BandOverview';
import { BandMemberCard } from '@/components/band/BandMemberCard';
import { AddTouringMember } from '@/components/band/AddTouringMember';
import { ChemistryDisplay } from '@/components/band/ChemistryDisplay';
import { Users, Music } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function BandManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [userBand, setUserBand] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadUserBand();
    }
  }, [user]);

  const loadUserBand = async () => {
    if (!user) return;

    try {
      const { data: bandMember } = await supabase
        .from('band_members')
        .select('band_id, bands(*)')
        .eq('user_id', user.id)
        .single();

      if (bandMember?.bands) {
        setUserBand(bandMember.bands);
        await loadBandMembers(bandMember.band_id);
      }
    } catch (error) {
      console.error('Error loading band:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBandMembers = async (bandId: string) => {
    const { data } = await supabase
      .from('band_members')
      .select(`
        *,
        profiles:user_id (
          display_name,
          username
        )
      `)
      .eq('band_id', bandId)
      .order('joined_at', { ascending: true });

    setMembers(data || []);
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

      if (userBand) {
        await loadBandMembers(userBand.id);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove member',
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

  if (!userBand) {
    return (
      <div className="container mx-auto p-6 max-w-2xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Band Manager</h1>
          <p className="text-muted-foreground">Create a band or become a solo artist to begin</p>
        </div>
        <BandCreationForm />
      </div>
    );
  }

  const isLeader = userBand.leader_id === user?.id;

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Music className="h-8 w-8" />
          {userBand.is_solo_artist ? (userBand.artist_name || userBand.name) : userBand.name}
        </h1>
        <p className="text-muted-foreground">{userBand.genre} • {userBand.is_solo_artist ? 'Solo Artist' : 'Band'}</p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">My Band</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="chemistry">Chemistry</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <BandOverview bandId={userBand.id} />
        </TabsContent>

        <TabsContent value="members" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Band Members</CardTitle>
                  <CardDescription>
                    {members.length} of {userBand.max_members} members
                  </CardDescription>
                </div>
                {isLeader && (
                  <AddTouringMember 
                    bandId={userBand.id} 
                    onAdded={() => loadBandMembers(userBand.id)} 
                  />
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {members.map((member) => (
                <BandMemberCard
                  key={member.id}
                  member={member}
                  isLeader={member.user_id === userBand.leader_id}
                  canManage={isLeader}
                  onRemove={
                    isLeader && member.user_id !== userBand.leader_id
                      ? () => handleRemoveMember(member.id)
                      : undefined
                  }
                />
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chemistry" className="space-y-4">
          <ChemistryDisplay bandId={userBand.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
