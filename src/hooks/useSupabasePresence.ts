import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

interface UseSupabasePresenceOptions {
  channelName: string;
  userId?: string;
  onConnectionStatusChange?: (connected: boolean) => void;
  onParticipantCountChange?: (count: number) => void;
  onChannelReady?: (channel: RealtimeChannel) => void;
}

interface UseSupabasePresenceResult {
  channel: RealtimeChannel | null;
  isConnected: boolean;
  participantCount: number;
  onlineUserIds: string[];
}

export const useSupabasePresence = ({
  channelName,
  userId,
  onConnectionStatusChange,
  onParticipantCountChange,
  onChannelReady,
}: UseSupabasePresenceOptions): UseSupabasePresenceResult => {
  const [isConnected, setIsConnected] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const connectionStatusChangeRef = useRef(onConnectionStatusChange);
  const participantCountChangeRef = useRef(onParticipantCountChange);
  const channelReadyRef = useRef(onChannelReady);

  useEffect(() => {
    connectionStatusChangeRef.current = onConnectionStatusChange;
  }, [onConnectionStatusChange]);

  useEffect(() => {
    participantCountChangeRef.current = onParticipantCountChange;
  }, [onParticipantCountChange]);

  useEffect(() => {
    channelReadyRef.current = onChannelReady;
  }, [onChannelReady]);

  useEffect(() => {
    if (!userId) {
      setIsConnected(false);
      setParticipantCount(0);
      setOnlineUserIds([]);
      connectionStatusChangeRef.current?.(false);
      participantCountChangeRef.current?.(0);
      return;
    }

    let isMounted = true;
    const channel = supabase.channel(channelName, {
      config: {
        presence: { key: userId },
      },
    });

    channelRef.current = channel;
    channelReadyRef.current?.(channel);

    const updatePresence = () => {
      if (!isMounted) return;

      const presenceState = channel.presenceState<{ user_id: string }>();
      const participantIds = new Set<string>();

      Object.values(presenceState).forEach((entries) => {
        entries.forEach((entry) => {
          if (entry?.user_id) {
            participantIds.add(entry.user_id);
          }
        });
      });

      const idsArray = Array.from(participantIds);
      setOnlineUserIds(idsArray);
      setParticipantCount(idsArray.length);
      participantCountChangeRef.current?.(idsArray.length);
    };

    channel
      .on("presence", { event: "sync" }, updatePresence)
      .on("presence", { event: "join" }, updatePresence)
      .on("presence", { event: "leave" }, updatePresence)
      .subscribe((status) => {
        if (!isMounted) return;

        if (status === "SUBSCRIBED") {
          setIsConnected(true);
          connectionStatusChangeRef.current?.(true);
          void channel
            .track({ user_id: userId })
            .then(() => {
              if (isMounted) {
                updatePresence();
              }
            })
            .catch((presenceError) => {
              console.error("Error updating presence:", presenceError);
            });
        } else if (
          status === "TIMED_OUT" ||
          status === "CHANNEL_ERROR" ||
          status === "CLOSED"
        ) {
          setIsConnected(false);
          connectionStatusChangeRef.current?.(false);
        }
      });

    return () => {
      isMounted = false;
      setIsConnected(false);
      setParticipantCount(0);
      setOnlineUserIds([]);
      connectionStatusChangeRef.current?.(false);
      participantCountChangeRef.current?.(0);
      supabase.removeChannel(channel);
      if (channelRef.current === channel) {
        channelRef.current = null;
      }
    };
  }, [channelName, userId]);

  return {
    channel: channelRef.current,
    isConnected,
    participantCount,
    onlineUserIds,
  };
};

export default useSupabasePresence;
