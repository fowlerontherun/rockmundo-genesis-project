import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import ChatWindow from '@/components/realtime/ChatWindow';
import { MessageSquare, Music } from 'lucide-react';


interface AudioMeterHandle {
  analyser: AnalyserNode;
  source: MediaStreamAudioSourceNode;
  rafId: number;
}

const RealtimeCommunication: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const [bandId, setBandId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'band'>('general');
  const channelKey = useMemo(() => {
    if (activeTab === 'band') {
      return bandId ? `band:${bandId}` : null;
    }

    return 'general';
  }, [activeTab, bandId]);
  const audioMetersRef = useRef<Record<string, AudioMeterHandle>>({});

  const destroyAudioMeter = useCallback((participantId: string) => {
    const meter = audioMetersRef.current[participantId];
    if (!meter) {
      return;
    }

    cancelAnimationFrame(meter.rafId);
    meter.source.disconnect();
    meter.analyser.disconnect();
    delete audioMetersRef.current[participantId];

    return;
  }, []);

  useEffect(() => {
    const audioMeters = audioMetersRef.current;

    return () => {
      Object.keys(audioMeters).forEach((participantId) => {
        destroyAudioMeter(participantId);
      });
    };
  }, [destroyAudioMeter]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">RockMundo Live</h1>
          <p className="text-muted-foreground">
            Real-time communication and collaboration
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              <span>Chat</span>
              <Badge variant="secondary">
                {`${activeTab === 'band' ? 'Band' : 'Global'}: ${onlineCount}`}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChatWindow
              channel="general"
              hideHeader
              onOnlineCountChange={setOnlineCount}
              onConnectionStatusChange={setIsConnected}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Music className="h-5 w-5" />
              <span>Jam Sessions</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Ready to collaborate? Explore active jam sessions and create your own rehearsal spaces with the community.
            </p>
            <Button asChild>
              <Link to="/jams">Open Jam Sessions</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RealtimeCommunication;
