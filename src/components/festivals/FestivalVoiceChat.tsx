import { JamVoiceChat } from "@/components/jam-sessions/JamVoiceChat";

interface FestivalVoiceChatProps {
  festivalId: string;
  stageId: string;
}

/**
 * Wraps JamVoiceChat with festival+stage scoped session IDs.
 * Moving stages will remount this with a new stageId, switching voice channel.
 */
export const FestivalVoiceChat = ({ festivalId, stageId }: FestivalVoiceChatProps) => {
  const sessionId = `festival-voice-${festivalId}-stage-${stageId}`;
  return <JamVoiceChat sessionId={sessionId} />;
};
