// Temporarily simplified BandChemistry
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { usePlayerStatus } from '@/hooks/usePlayerStatus';
import { ACTIVITY_STATUS_DURATIONS } from '@/utils/gameBalance';
import { formatDurationMinutes } from '@/utils/datetime';

export default function BandChemistry() {
  const { startTimedStatus } = usePlayerStatus();
  const { toast } = useToast();

  const handleStartJam = () => {
    const jamMinutes = ACTIVITY_STATUS_DURATIONS.jammingSession;
    startTimedStatus({
      status: 'Jamming',
      durationMinutes: jamMinutes,
      metadata: { source: 'band_chemistry' },
    });
    toast({
      title: 'Jam session started',
      description: `Jamming will run for about ${formatDurationMinutes(jamMinutes)}.`,
    });
  };

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Band Chemistry</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Band chemistry features are being updated. Start a quick jam to keep the collective groove sharp.
          </p>
          <Button onClick={handleStartJam} className="w-full sm:w-auto">
            Start a jam session
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}