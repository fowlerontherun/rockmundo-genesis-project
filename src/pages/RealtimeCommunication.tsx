import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">RockMundo Live</h1>
          <p className="text-muted-foreground">
            Real-time communication and collaboration
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-2 px-3 py-1 rounded-full ${
              isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            {isConnected ? 'Connected' : 'Connecting...'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              <span>Chat</span>
              <Badge variant="secondary">{onlineCount}</Badge>
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
              <Music className="w-5 h-5" />
              <span>Jam Sessions</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Jam session features will be available soon.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RealtimeCommunication;