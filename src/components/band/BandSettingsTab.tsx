import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings, LogOut, Users, Ban, AlertTriangle, Megaphone, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useActiveProfile } from '@/hooks/useActiveProfile';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leaveBand, transferLeadership, disbandBand, getEligibleLeaders } from '@/utils/bandMembers';
import { putBandOnHiatus, reactivateBand } from '@/utils/bandHiatus';
import { getBandStatusLabel, getBandStatusColor } from '@/utils/bandStatus';
import { BandGenreEditor } from './BandGenreEditor';

interface BandSettingsTabProps {
  bandId: string;
  isLeader: boolean;
  bandStatus: string;
  isSoloArtist: boolean;
  isRecruiting?: boolean;
  allowApplications?: boolean;
  primaryGenre?: string | null;
  secondaryGenres?: string[] | null;
  genreLastChangedAt?: string | null;
  onBandUpdate: () => void;
}

export function BandSettingsTab({ 
  bandId, 
  isLeader, 
  bandStatus,
  isSoloArtist,
  isRecruiting: initialRecruiting,
  allowApplications: initialAllowApps,
  primaryGenre,
  secondaryGenres,
  genreLastChangedAt,
  onBandUpdate 
}: BandSettingsTabProps) {
  const { profileId } = useActiveProfile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [isRecruiting, setIsRecruiting] = useState(initialRecruiting ?? false);
  const [allowApplications, setAllowApplications] = useState(initialAllowApps ?? true);
  
  // Hiatus dialog state
  const [hiatusDialogOpen, setHiatusDialogOpen] = useState(false);
  const [hiatusReason, setHiatusReason] = useState('');
  const [hiatusDuration, setHiatusDuration] = useState<string>('');
  
  // Transfer leadership state
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [newLeaderId, setNewLeaderId] = useState('');
  const [eligibleLeaders, setEligibleLeaders] = useState<any[]>([]);
  
  // Disband confirmation
  const [disbandDialogOpen, setDisbandDialogOpen] = useState(false);
  const [disbandConfirmation, setDisbandConfirmation] = useState('');

  // Ad posting state
  const [adDialogOpen, setAdDialogOpen] = useState(false);
  const [adInstrument, setAdInstrument] = useState('guitar');
  const [adVocalRole, setAdVocalRole] = useState('');
  const [adDescription, setAdDescription] = useState('');
  const [adBudget, setAdBudget] = useState(500);

  // Fetch existing ads
  const { data: activeAds = [] } = useQuery({
    queryKey: ['band-member-ads', bandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('band_member_ads')
        .select('*')
        .eq('band_id', bandId)
        .eq('status', 'active');
      if (error) throw error;
      return data || [];
    },
  });

  const postAdMutation = useMutation({
    mutationFn: async () => {
      if (!profileId) throw new Error('No active profile');
      
      // Deduct cost from band balance
      const { data: band, error: bandErr } = await supabase
        .from('bands')
        .select('band_balance')
        .eq('id', bandId)
        .single();
      if (bandErr) throw bandErr;
      
      const balance = band?.band_balance ?? 0;
      if (balance < adBudget) throw new Error(`Insufficient band funds. Need $${adBudget}, have $${balance.toLocaleString()}`);

      const visibilityBoost = adBudget >= 2000 ? 3.0 : adBudget >= 1000 ? 2.0 : adBudget >= 500 ? 1.5 : 1.0;

      const { error: adErr } = await supabase
        .from('band_member_ads')
        .insert({
          band_id: bandId,
          posted_by_profile_id: profileId,
          instrument_role: adInstrument,
          vocal_role: adVocalRole || null,
          description: adDescription || null,
          budget_spent: adBudget,
          visibility_boost: visibilityBoost,
        });
      if (adErr) throw adErr;

      const { error: balErr } = await supabase
        .from('bands')
        .update({ band_balance: balance - adBudget })
        .eq('id', bandId);
      if (balErr) throw balErr;
    },
    onSuccess: () => {
      toast({ title: 'Ad Posted', description: `Spent $${adBudget} to advertise for a new member.` });
      queryClient.invalidateQueries({ queryKey: ['band-member-ads', bandId] });
      queryClient.invalidateQueries({ queryKey: ['band', bandId] });
      setAdDialogOpen(false);
      setAdDescription('');
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const cancelAdMutation = useMutation({
    mutationFn: async (adId: string) => {
      const { error } = await supabase
        .from('band_member_ads')
        .update({ status: 'cancelled' })
        .eq('id', adId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Ad Cancelled' });
      queryClient.invalidateQueries({ queryKey: ['band-member-ads', bandId] });
    },
  });

  const handleLeaveBand = async () => {
    if (!profileId) return;
    
    try {
      setLoading(true);
      await leaveBand(profileId, bandId);
      
      toast({
        title: 'Left Band',
        description: 'You have successfully left the band',
      });
      
      onBandUpdate();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to leave band',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePutOnHiatus = async () => {
    if (!profileId) return;
    
    if (!hiatusReason.trim()) {
      toast({
        title: 'Error',
        description: 'Please provide a reason for the hiatus',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      
      const durationDays = hiatusDuration ? parseInt(hiatusDuration) : undefined;
      
      await putBandOnHiatus({
        bandId,
        reason: hiatusReason,
        duration: durationDays,
        leaderId: profileId!
      });
      
      toast({
        title: 'Band on Hiatus',
        description: 'Your band has been put on hiatus',
      });
      
      setHiatusDialogOpen(false);
      setHiatusReason('');
      setHiatusDuration('');
      onBandUpdate();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to put band on hiatus',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReactivate = async () => {
    if (!profileId) return;

    try {
      setLoading(true);
      const result = await reactivateBand(bandId, profileId);
      
      if (result.success) {
        toast({
          title: 'Band Reactivated',
          description: 'Your band is now active again',
        });
        onBandUpdate();
      } else if (result.conflicts) {
        toast({
          title: 'Conflicts Detected',
          description: `${result.conflicts.length} member(s) have conflicts with other active bands`,
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to reactivate band',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const openTransferDialog = async () => {
    const leaders = await getEligibleLeaders(bandId, profileId || '');
    setEligibleLeaders(leaders);
    setTransferDialogOpen(true);
  };

  const handleTransferLeadership = async () => {
    if (!profileId || !newLeaderId) return;

    try {
      setLoading(true);
      await transferLeadership(bandId, profileId, newLeaderId);
      
      toast({
        title: 'Leadership Transferred',
        description: 'Band leadership has been transferred',
      });
      
      setTransferDialogOpen(false);
      setNewLeaderId('');
      onBandUpdate();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to transfer leadership',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDisbandBand = async () => {
    if (!profileId) return;
    
    if (disbandConfirmation !== 'DISBAND') {
      toast({
        title: 'Error',
        description: 'Please type DISBAND to confirm',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      await disbandBand(bandId, profileId!);
      
      toast({
        title: 'Band Disbanded',
        description: 'The band has been permanently disbanded',
      });
      
      setDisbandDialogOpen(false);
      onBandUpdate();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to disband band',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Genre Editor */}
      <BandGenreEditor
        bandId={bandId}
        currentPrimaryGenre={primaryGenre ?? null}
        currentSecondaryGenres={secondaryGenres ?? null}
        genreLastChangedAt={genreLastChangedAt ?? null}
        isLeader={isLeader}
        onUpdate={onBandUpdate}
      />

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            <CardTitle>Band Settings</CardTitle>
          </div>
          <CardDescription>Manage your band's status and membership</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Band Status Display */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="text-sm font-medium">Current Status</p>
              <p className="text-xs text-muted-foreground">Your band's activity status</p>
            </div>
            <Badge className={getBandStatusColor(bandStatus)}>
              {getBandStatusLabel(bandStatus)}
            </Badge>
          </div>

          {/* Recruiting Toggle (Leaders only) */}
          {isLeader && bandStatus === 'active' && !isSoloArtist && (
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="text-sm font-medium">Open for Recruiting</p>
                <p className="text-xs text-muted-foreground">Allow players to find your band and apply to join</p>
              </div>
              <Switch
                checked={isRecruiting}
                onCheckedChange={async (checked) => {
                  setIsRecruiting(checked);
                  const { error } = await supabase
                    .from('bands')
                    .update({ is_recruiting: checked })
                    .eq('id', bandId);
                  if (error) {
                    setIsRecruiting(!checked);
                    toast({ title: 'Error', description: 'Failed to update recruiting status', variant: 'destructive' });
                  } else {
                    toast({ title: checked ? 'Recruiting Enabled' : 'Recruiting Disabled', description: checked ? 'Players can now apply to join your band.' : 'Applications are now closed.' });
                    onBandUpdate();
                  }
                }}
              />
            </div>
          )}

          {/* Accept Applications Toggle (Leaders only) */}
          {isLeader && bandStatus === 'active' && !isSoloArtist && (
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="text-sm font-medium">Accept Member Requests</p>
                <p className="text-xs text-muted-foreground">Allow players to send join requests without an invitation</p>
              </div>
              <Switch
                checked={allowApplications}
                onCheckedChange={async (checked) => {
                  setAllowApplications(checked);
                  const { error } = await supabase
                    .from('bands')
                    .update({ allow_applications: checked })
                    .eq('id', bandId);
                  if (error) {
                    setAllowApplications(!checked);
                    toast({ title: 'Error', description: 'Failed to update application setting', variant: 'destructive' });
                  } else {
                    toast({ title: checked ? 'Applications Open' : 'Applications Closed', description: checked ? 'Players can now request to join.' : 'Join requests are now closed.' });
                    onBandUpdate();
                  }
                }}
              />
            </div>
          )}
          {!isLeader && bandStatus !== 'disbanded' && (
            <Button
              variant="destructive"
              className="w-full"
              onClick={handleLeaveBand}
              disabled={loading}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Leave Band
            </Button>
          )}

          {/* Leader Actions */}
          {isLeader && bandStatus !== 'disbanded' && (
            <div className="space-y-3">
              {/* Hiatus/Reactivate */}
              {bandStatus === 'active' ? (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setHiatusDialogOpen(true)}
                  disabled={loading}
                >
                  <Ban className="mr-2 h-4 w-4" />
                  Put Band on Hiatus
                </Button>
              ) : bandStatus === 'on_hiatus' ? (
                <Button
                  variant="default"
                  className="w-full"
                  onClick={handleReactivate}
                  disabled={loading}
                >
                  Reactivate Band
                </Button>
              ) : null}

              {/* Transfer Leadership */}
              {!isSoloArtist && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={openTransferDialog}
                  disabled={loading}
                >
                  <Users className="mr-2 h-4 w-4" />
                  Transfer Leadership
                </Button>
              )}

              {/* Disband Band */}
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => setDisbandDialogOpen(true)}
                disabled={loading}
              >
                <AlertTriangle className="mr-2 h-4 w-4" />
                Disband Band
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Member Recruitment Ads */}
      {isLeader && bandStatus === 'active' && !isSoloArtist && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Megaphone className="h-5 w-5" />
              <CardTitle>Member Advertisements</CardTitle>
            </div>
            <CardDescription>Pay in-game money to advertise for specific roles. Higher budgets get more visibility.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeAds.length > 0 && (
              <div className="space-y-2">
                {activeAds.map((ad: any) => (
                  <div key={ad.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium capitalize">{ad.instrument_role}{ad.vocal_role ? ` · ${ad.vocal_role}` : ''}</p>
                      <p className="text-xs text-muted-foreground">
                        ${ad.budget_spent} spent · {ad.visibility_boost}x boost · expires {new Date(ad.expires_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => cancelAdMutation.mutate(ad.id)}
                      disabled={cancelAdMutation.isPending}
                    >
                      Cancel
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <Button className="w-full" onClick={() => setAdDialogOpen(true)}>
              <DollarSign className="mr-2 h-4 w-4" />
              Post Recruitment Ad
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Post Ad Dialog */}
      <Dialog open={adDialogOpen} onOpenChange={setAdDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Post a Recruitment Ad</DialogTitle>
            <DialogDescription>
              Spend band funds to advertise for a new member. Higher budgets increase visibility in the Band Finder.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Instrument Role</Label>
              <Select value={adInstrument} onValueChange={setAdInstrument}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="guitar">Guitar</SelectItem>
                  <SelectItem value="bass">Bass</SelectItem>
                  <SelectItem value="drums">Drums</SelectItem>
                  <SelectItem value="keyboards">Keyboards</SelectItem>
                  <SelectItem value="vocals">Vocals</SelectItem>
                  <SelectItem value="dj">DJ</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Vocal Role (optional)</Label>
              <Select value={adVocalRole} onValueChange={setAdVocalRole}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="lead">Lead Vocals</SelectItem>
                  <SelectItem value="backing">Backing Vocals</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                placeholder="Describe what you're looking for..."
                value={adDescription}
                onChange={(e) => setAdDescription(e.target.value)}
              />
            </div>
            <div>
              <Label>Budget</Label>
              <Select value={String(adBudget)} onValueChange={(v) => setAdBudget(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="250">$250 — Standard (1x visibility)</SelectItem>
                  <SelectItem value="500">$500 — Boosted (1.5x visibility)</SelectItem>
                  <SelectItem value="1000">$1,000 — Featured (2x visibility)</SelectItem>
                  <SelectItem value="2000">$2,000 — Premium (3x visibility)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => postAdMutation.mutate()} disabled={postAdMutation.isPending}>
              {postAdMutation.isPending ? 'Posting...' : `Post Ad — $${adBudget}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={hiatusDialogOpen} onOpenChange={setHiatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Put Band on Hiatus</DialogTitle>
            <DialogDescription>
              Your band will be temporarily suspended. All touring members will be removed.
              Members can join other bands during hiatus.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="reason">Reason</Label>
              <Textarea
                id="reason"
                placeholder="Why is the band going on hiatus?"
                value={hiatusReason}
                onChange={(e) => setHiatusReason(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="duration">Duration (optional)</Label>
              <Select value={hiatusDuration} onValueChange={setHiatusDuration}>
                <SelectTrigger>
                  <SelectValue placeholder="Indefinite" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="indefinite">Indefinite</SelectItem>
                  <SelectItem value="7">1 Week</SelectItem>
                  <SelectItem value="30">1 Month</SelectItem>
                  <SelectItem value="90">3 Months</SelectItem>
                  <SelectItem value="180">6 Months</SelectItem>
                  <SelectItem value="365">1 Year</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHiatusDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handlePutOnHiatus} disabled={loading}>
              Confirm Hiatus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Leadership Dialog */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Leadership</DialogTitle>
            <DialogDescription>
              Choose a new leader for your band. You will become a regular member.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="new-leader">New Leader</Label>
              <Select value={newLeaderId} onValueChange={setNewLeaderId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a member" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleLeaders.map((leader) => (
                    <SelectItem key={leader.user_id} value={leader.user_id}>
                      {leader.profiles?.display_name || leader.profiles?.username || 'Unknown'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleTransferLeadership} disabled={loading || !newLeaderId}>
              Transfer Leadership
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disband Confirmation Dialog */}
      <Dialog open={disbandDialogOpen} onOpenChange={setDisbandDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disband Band</DialogTitle>
            <DialogDescription>
              This action cannot be undone. All members will be removed and the band will be permanently disbanded.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="confirm">Type DISBAND to confirm</Label>
              <input
                id="confirm"
                type="text"
                className="w-full rounded-md border px-3 py-2"
                value={disbandConfirmation}
                onChange={(e) => setDisbandConfirmation(e.target.value)}
                placeholder="DISBAND"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisbandDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDisbandBand} 
              disabled={loading || disbandConfirmation !== 'DISBAND'}
            >
              Disband Band Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
