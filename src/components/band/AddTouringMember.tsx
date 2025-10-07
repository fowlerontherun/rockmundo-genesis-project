import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { UserPlus } from 'lucide-react';
import { TOURING_MEMBER_TIERS, INSTRUMENT_ROLES, generateTouringMemberName } from '@/utils/touringMembers';

interface AddTouringMemberProps {
  bandId: string;
  onAdded: () => void;
}

export function AddTouringMember({ bandId, onAdded }: AddTouringMemberProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [tier, setTier] = useState(1);
  const [instrument, setInstrument] = useState('Guitar');
  const [loading, setLoading] = useState(false);

  const selectedTier = TOURING_MEMBER_TIERS.find(t => t.tier === tier) || TOURING_MEMBER_TIERS[0];

  const handleAdd = async () => {
    setLoading(true);
    try {
      const memberName = generateTouringMemberName();
      
      const { error } = await supabase
        .from('band_members')
        .insert({
          band_id: bandId,
          user_id: null,
          role: memberName,
          instrument_role: instrument,
          is_touring_member: true,
          touring_member_tier: tier,
          touring_member_cost: selectedTier.weeklyCost,
          salary: selectedTier.weeklyCost,
        });

      if (error) throw error;

      toast({
        title: 'Touring Member Added',
        description: `${memberName} has joined as touring ${instrument}`,
      });

      setOpen(false);
      onAdded();
    } catch (error: any) {
      console.error('Error adding touring member:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to add touring member',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <UserPlus className="h-4 w-4 mr-2" />
          Add Touring Member
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hire Touring Member</DialogTitle>
          <DialogDescription>
            Add an AI touring member to fill a position. They'll require weekly payment.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Instrument</Label>
            <Select value={instrument} onValueChange={setInstrument}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INSTRUMENT_ROLES.map((inst) => (
                  <SelectItem key={inst} value={inst}>
                    {inst}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Skill Tier</Label>
            <Select value={tier.toString()} onValueChange={(v) => setTier(parseInt(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TOURING_MEMBER_TIERS.map((t) => (
                  <SelectItem key={t.tier} value={t.tier.toString()}>
                    {t.name} - ${t.weeklyCost}/week
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">{selectedTier.description}</p>
            <p className="text-sm text-muted-foreground">
              Skill Range: {selectedTier.skillRange[0]}-{selectedTier.skillRange[1]}
            </p>
          </div>

          <div className="rounded-lg bg-muted p-4">
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span>Weekly Cost:</span>
                <span className="font-bold">${selectedTier.weeklyCost}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Annual Cost:</span>
                <span>${selectedTier.weeklyCost * 52}</span>
              </div>
            </div>
          </div>

          <Button onClick={handleAdd} className="w-full" disabled={loading}>
            {loading ? 'Hiring...' : `Hire Touring ${instrument}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
