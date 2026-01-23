import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Settings, LogOut, Users, Ban, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth-context';
import { leaveBand, transferLeadership, disbandBand, getEligibleLeaders } from '@/utils/bandMembers';
import { putBandOnHiatus, reactivateBand } from '@/utils/bandHiatus';
import { getBandStatusLabel, getBandStatusColor } from '@/utils/bandStatus';
import { BandGenreEditor } from './BandGenreEditor';

interface BandSettingsTabProps {
  bandId: string;
  isLeader: boolean;
  bandStatus: string;
  isSoloArtist: boolean;
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
  primaryGenre,
  secondaryGenres,
  genreLastChangedAt,
  onBandUpdate 
}: BandSettingsTabProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
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

  const handleLeaveBand = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      await leaveBand(user.id, bandId);
      
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
    if (!user) return;
    
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
        leaderId: user.id
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
    if (!user) return;

    try {
      setLoading(true);
      const result = await reactivateBand(bandId, user.id);
      
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
    const leaders = await getEligibleLeaders(bandId, user?.id || '');
    setEligibleLeaders(leaders);
    setTransferDialogOpen(true);
  };

  const handleTransferLeadership = async () => {
    if (!user || !newLeaderId) return;

    try {
      setLoading(true);
      await transferLeadership(bandId, user.id, newLeaderId);
      
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
    if (!user) return;
    
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
      await disbandBand(bandId, user.id);
      
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

          {/* Leave Band (Non-leaders only) */}
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

      {/* Hiatus Dialog */}
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
                  <SelectItem value="">Indefinite</SelectItem>
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
