// Temporarily simplified Busking page
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { usePlayerStatus } from '@/hooks/usePlayerStatus';
import { ACTIVITY_STATUS_DURATIONS } from '@/utils/gameBalance';
import { formatDurationMinutes } from '@/utils/datetime';

export default function Busking() {
  const { startTimedStatus } = usePlayerStatus();
  const { toast } = useToast();

  const handleStartBusking = () => {
    const sessionMinutes = ACTIVITY_STATUS_DURATIONS.buskingSession;
    startTimedStatus({
      status: 'Busking',
      durationMinutes: sessionMinutes,
      metadata: { source: 'busking_placeholder' },
    });
    toast({
      title: 'Busking session started',
      description: `Busking stays active for about ${formatDurationMinutes(sessionMinutes)}.`,
    });
  };

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Busking</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Busking features are being updated. In the meantime, kick off a quick street set to keep your performance energy up.
          </p>
          <Button onClick={handleStartBusking} className="w-full sm:w-auto">
            Start a busking set
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}