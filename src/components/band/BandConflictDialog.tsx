import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Ban, LogOut } from 'lucide-react';
import { resolveReactivationConflict } from '@/utils/bandHiatus';
import { useToast } from '@/hooks/use-toast';

interface BandConflictDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  reactivatingBandId: string;
  reactivatingBandName: string;
  conflictBandId: string;
  conflictBandName: string;
  onResolved: () => void;
}

export function BandConflictDialog({
  open,
  onOpenChange,
  userId,
  reactivatingBandId,
  reactivatingBandName,
  conflictBandId,
  conflictBandName,
  onResolved
}: BandConflictDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedAction, setSelectedAction] = useState<'hiatus' | 'resign' | null>(null);

  const handleResolve = async () => {
    if (!selectedAction) return;

    try {
      setLoading(true);
      await resolveReactivationConflict(
        userId,
        reactivatingBandId,
        conflictBandId,
        selectedAction
      );

      toast({
        title: 'Conflict Resolved',
        description: selectedAction === 'hiatus' 
          ? `${conflictBandName} has been put on hiatus`
          : `You have resigned from ${reactivatingBandName}`,
      });

      onResolved();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to resolve conflict',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Band Conflict Detected
          </DialogTitle>
          <DialogDescription>
            You can only be in one active band at a time. Choose how to resolve this conflict.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertDescription>
              <strong>{reactivatingBandName}</strong> is trying to reactivate, but you're currently active in <strong>{conflictBandName}</strong>.
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            {/* Option 1: Put other band on hiatus */}
            <button
              onClick={() => setSelectedAction('hiatus')}
              className={`w-full rounded-lg border-2 p-4 text-left transition-colors ${
                selectedAction === 'hiatus'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <div className="flex items-start gap-3">
                <Ban className="mt-1 h-5 w-5 text-yellow-500" />
                <div className="flex-1">
                  <h4 className="font-semibold">Put "{conflictBandName}" on Hiatus</h4>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Your current band will be temporarily suspended. You can reactivate it later.
                  </p>
                  <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-muted-foreground">
                    <li>Touring members will be removed from {conflictBandName}</li>
                    <li>Chemistry will decay slowly (50% rate)</li>
                    <li>You'll stay as a member of {conflictBandName}</li>
                    <li>{reactivatingBandName} will become your active band</li>
                  </ul>
                </div>
              </div>
            </button>

            {/* Option 2: Resign from reactivating band */}
            <button
              onClick={() => setSelectedAction('resign')}
              className={`w-full rounded-lg border-2 p-4 text-left transition-colors ${
                selectedAction === 'resign'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <div className="flex items-start gap-3">
                <LogOut className="mt-1 h-5 w-5 text-red-500" />
                <div className="flex-1">
                  <h4 className="font-semibold">Resign from "{reactivatingBandName}"</h4>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Leave {reactivatingBandName} and stay with your current band.
                  </p>
                  <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-muted-foreground">
                    <li>You'll be permanently removed from {reactivatingBandName}</li>
                    <li>Chemistry in {reactivatingBandName} will decrease</li>
                    <li>{conflictBandName} remains your active band</li>
                    <li>Cannot rejoin {reactivatingBandName} without re-invitation</li>
                  </ul>
                </div>
              </div>
            </button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={handleResolve} 
            disabled={!selectedAction || loading}
          >
            {loading ? 'Resolving...' : 'Confirm Choice'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
