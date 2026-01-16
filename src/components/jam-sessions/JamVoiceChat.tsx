import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff, Phone, PhoneOff, Volume2, VolumeX, Loader2, AlertCircle } from "lucide-react";
import { useJamVoiceChat, VoiceParticipant } from "@/hooks/useJamVoiceChat";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";

interface JamVoiceChatProps {
  sessionId: string;
}

export const JamVoiceChat = ({ sessionId }: JamVoiceChatProps) => {
  const { t } = useTranslation();
  const {
    isConnected,
    isConnecting,
    isMuted,
    participants,
    myPeerId,
    error,
    connect,
    disconnect,
    toggleMute,
  } = useJamVoiceChat(sessionId);

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Mic className="h-4 w-4" />
            Voice Chat
          </CardTitle>
          
          {!isConnected && !isConnecting && (
            <Button
              size="sm"
              onClick={connect}
              className="gap-2"
            >
              <Phone className="h-4 w-4" />
              Join Voice
            </Button>
          )}
          
          {isConnecting && (
            <Button size="sm" disabled className="gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Connecting...
            </Button>
          )}
          
          {isConnected && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={isMuted ? "destructive" : "outline"}
                onClick={toggleMute}
                className="gap-2"
              >
                {isMuted ? (
                  <>
                    <MicOff className="h-4 w-4" />
                    Unmute
                  </>
                ) : (
                  <>
                    <Mic className="h-4 w-4" />
                    Mute
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={disconnect}
                className="gap-2"
              >
                <PhoneOff className="h-4 w-4" />
                Leave
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {error && (
          <div className="flex items-center gap-2 text-destructive text-sm p-2 bg-destructive/10 rounded-md">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        
        {!isConnected && !isConnecting && !error && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Click "Join Voice" to start talking with other jammers
          </p>
        )}
        
        {isConnected && (
          <div className="space-y-2">
            {/* You */}
            <div className="flex items-center gap-3 p-2 rounded-lg bg-primary/5 border border-primary/20">
              <div className="relative">
                <div className={cn(
                  "w-2 h-2 rounded-full absolute -right-0.5 -top-0.5",
                  isMuted ? "bg-destructive" : "bg-green-500"
                )} />
                <Avatar className="h-8 w-8">
                  <AvatarFallback>You</AvatarFallback>
                </Avatar>
              </div>
              <div className="flex-1">
                <span className="text-sm font-medium">You</span>
              </div>
              {isMuted ? (
                <VolumeX className="h-4 w-4 text-destructive" />
              ) : (
                <Volume2 className="h-4 w-4 text-green-500" />
              )}
            </div>
            
            {/* Other participants */}
            {participants.map((participant) => (
              <ParticipantRow key={participant.peerId} participant={participant} />
            ))}
            
            {participants.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">
                Waiting for others to join voice chat...
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

interface ParticipantRowProps {
  participant: VoiceParticipant;
}

const ParticipantRow = ({ participant }: ParticipantRowProps) => {
  const { displayName, avatarUrl, isMuted, isSpeaking, audioLevel } = participant;
  
  return (
    <div className={cn(
      "flex items-center gap-3 p-2 rounded-lg transition-colors",
      isSpeaking && !isMuted ? "bg-green-500/10 border border-green-500/30" : "bg-muted/30"
    )}>
      <div className="relative">
        <div className={cn(
          "w-2 h-2 rounded-full absolute -right-0.5 -top-0.5",
          isMuted ? "bg-destructive" : isSpeaking ? "bg-green-500 animate-pulse" : "bg-green-500"
        )} />
        <Avatar className="h-8 w-8">
          <AvatarImage src={avatarUrl} />
          <AvatarFallback>{displayName?.charAt(0) || "?"}</AvatarFallback>
        </Avatar>
      </div>
      
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium truncate block">{displayName}</span>
        {isSpeaking && !isMuted && (
          <div className="flex items-center gap-1 mt-0.5">
            <AudioLevelIndicator level={audioLevel} />
          </div>
        )}
      </div>
      
      {isMuted ? (
        <Badge variant="destructive" className="text-xs gap-1">
          <VolumeX className="h-3 w-3" />
          Muted
        </Badge>
      ) : isSpeaking ? (
        <Volume2 className="h-4 w-4 text-green-500 animate-pulse" />
      ) : (
        <Volume2 className="h-4 w-4 text-muted-foreground" />
      )}
    </div>
  );
};

interface AudioLevelIndicatorProps {
  level: number;
}

const AudioLevelIndicator = ({ level }: AudioLevelIndicatorProps) => {
  const bars = 5;
  const activeCount = Math.ceil(level * bars * 2); // Scale for visibility
  
  return (
    <div className="flex items-end gap-0.5 h-3">
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "w-1 rounded-full transition-all",
            i < activeCount ? "bg-green-500" : "bg-muted"
          )}
          style={{ height: `${((i + 1) / bars) * 100}%` }}
        />
      ))}
    </div>
  );
};
