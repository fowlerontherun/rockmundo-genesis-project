import { JamVoiceChat } from "@/components/jam-sessions/JamVoiceChat";

/**
 * 1:1 voice chat wrapper for the unified Social hub.
 * Uses the existing JamVoiceChat infra with a deterministic per-friendship channel.
 */
export const DirectVoiceChat = ({ channelId }: { channelId: string }) => {
  return <JamVoiceChat sessionId={`dm-voice-${channelId}`} />;
};
