import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel, RealtimePresenceState } from "@supabase/supabase-js";

export interface SongwritingPresence {
  userId: string;
  username: string;
  color: string;
  lastActive: string;
}

export interface SongwritingContentUpdate<TContent = unknown> {
  draftId: string;
  userId: string;
  content: TContent;
  updatedAt: string;
}

interface SongwritingPresencePayload {
  userId: string;
  username: string;
  color: string;
  lastActive: string;
}

interface SongwritingRealtimeHandlers<TContent> {
  onContentUpdate?: (payload: SongwritingContentUpdate<TContent>) => void;
  onPresenceUpdate?: (presence: SongwritingPresence[]) => void;
  onStatusChange?: (status: "SUBSCRIBED" | "CLOSED" | "TIMED_OUT" | "CHANNEL_ERROR") => void;
}

export interface SongwritingRealtimeChannel<TContent = unknown> {
  channel: RealtimeChannel;
  subscribe: () => Promise<void>;
  trackPresence: (presence: SongwritingPresence) => Promise<void>;
  sendContentUpdate: (payload: SongwritingContentUpdate<TContent>) => Promise<void>;
  unsubscribe: () => Promise<void>;
}

export function createSongwritingRealtimeChannel<TContent = unknown>(
  draftId: string,
  handlers: SongwritingRealtimeHandlers<TContent> = {},
): SongwritingRealtimeChannel<TContent> {
  const channel = supabase.channel(`songwriting-draft:${draftId}`, {
    config: {
      presence: {
        key: draftId,
      },
    },
  });

  channel.on("broadcast", { event: "content-update" }, ({ payload }) => {
    if (!payload) return;
    handlers.onContentUpdate?.(payload as SongwritingContentUpdate<TContent>);
  });

  channel.on("presence", { event: "sync" }, () => {
    const presenceState = channel.presenceState<SongwritingPresencePayload>();
    const presenceList = mapPresenceState(presenceState);
    handlers.onPresenceUpdate?.(presenceList);
  });

  return {
    channel,
    subscribe: () =>
      new Promise<void>((resolve) => {
        channel.subscribe((status) => {
          if (status === "SUBSCRIBED") {
            const presenceState = channel.presenceState<SongwritingPresencePayload>();
            handlers.onPresenceUpdate?.(mapPresenceState(presenceState));
            handlers.onStatusChange?.("SUBSCRIBED");
            resolve();
          }

          if (status === "TIMED_OUT") {
            handlers.onStatusChange?.("TIMED_OUT");
          }

          if (status === "CHANNEL_ERROR") {
            handlers.onStatusChange?.("CHANNEL_ERROR");
          }

          if (status === "CLOSED") {
            handlers.onStatusChange?.("CLOSED");
          }
        });
      }),
    trackPresence: async (presence) => {
      await channel.track({
        userId: presence.userId,
        username: presence.username,
        color: presence.color,
        lastActive: new Date().toISOString(),
      });
    },
    sendContentUpdate: async (payload) => {
      await channel.send({
        type: "broadcast",
        event: "content-update",
        payload,
      });
    },
    unsubscribe: async () => {
      await supabase.removeChannel(channel);
    },
  };
}

function mapPresenceState(state: RealtimePresenceState<SongwritingPresencePayload>): SongwritingPresence[] {
  const entries = Object.values(state).flat();
  return entries.map((presence) => ({
    userId: presence.userId,
    username: presence.username,
    color: presence.color,
    lastActive: presence.lastActive,
  }));
}
