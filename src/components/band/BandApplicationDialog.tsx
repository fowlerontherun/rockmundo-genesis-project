import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { UserPlus } from 'lucide-react';

const INSTRUMENT_ROLES = ['Guitar', 'Bass', 'Drums', 'Vocals', 'Keyboard', 'Rhythm Guitar', 'Lead Guitar', 'Saxophone', 'Trumpet', 'Violin'];
const VOCAL_ROLES = ['Lead Vocals', 'Backing Vocals', 'None'];

interface BandApplicationDialogProps {
  bandId: string;
  bandName: string;
  profileId: string;
}

export function BandApplicationDialog({ bandId, bandName, profileId }: BandApplicationDialogProps) {
  const [open, setOpen] = useState(false);
  const [instrumentRole, setInstrumentRole] = useState('Guitar');
  const [vocalRole, setVocalRole] = useState('');
  const [message, setMessage] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const applyMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('band_applications')
        .insert({
          band_id: bandId,
          applicant_profile_id: profileId,
          instrument_role: instrumentRole,
          vocal_role: vocalRole || null,
          message: message || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Application Sent', description: `Your application to ${bandName} has been submitted.` });
      queryClient.invalidateQueries({ queryKey: ['band-application', bandId, profileId] });
      setOpen(false);
      setMessage('');
    },
    onError: (error: any) => {
      const msg = error.message?.includes('duplicate') 
        ? 'You have already applied to this band.' 
        : error.message;
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="h-4 w-4 mr-2" />
          Apply to Join
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apply to Join {bandName}</DialogTitle>
          <DialogDescription>
            Send an application to the band leader. They will review and accept or reject it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Instrument Role</Label>
            <Select value={instrumentRole} onValueChange={setInstrumentRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {INSTRUMENT_ROLES.map(r => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Vocal Role (optional)</Label>
            <Select value={vocalRole} onValueChange={setVocalRole}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                {VOCAL_ROLES.map(r => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Message (optional)</Label>
            <Textarea
              placeholder="Tell the band why you'd be a great fit..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={500}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => applyMutation.mutate()} disabled={applyMutation.isPending}>
            {applyMutation.isPending ? 'Sending...' : 'Send Application'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
