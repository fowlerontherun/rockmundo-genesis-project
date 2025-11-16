import type { RealtimeChannel } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/lib/supabase-types";

export type JamSessionParticipantRow = Database["public"]["Tables"]["jam_session_participants"]["Row"];
export type JamSessionParticipantInsert = Database["public"]["Tables"]["jam_session_participants"]["Insert"];
export type JamSessionMessageRow = Database["public"]["Tables"]["jam_session_messages"]["Row"];

export interface JamSessionParticipant extends JamSessionParticipantRow {
  profile: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    level: number | null;
  } | null;
}

export interface JamSessionMessage extends JamSessionMessageRow {
  sender: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

const PARTICIPANT_SELECT = `
  id,
  jam_session_id,
  profile_id,
  is_ready,
  skill_tier,
  co_play_count,
  joined_at,
  updated_at,
  profile:profiles!jam_session_participants_profile_id_fkey (
    id,
    username,
    display_name,
    avatar_url,
    level
  )
`;

const MESSAGE_SELECT = `
  id,
  jam_session_id,
  sender_profile_id,
  message,
  created_at,
  sender:profiles!jam_session_messages_sender_profile_id_fkey (
    id,
    username,
    display_name,
    avatar_url
  )
`;

export const fetchJamSessionParticipants = async (
  sessionId: string,
): Promise<JamSessionParticipant[]> => {
  const { data, error } = await supabase
    .from("jam_session_participants")
    .select(PARTICIPANT_SELECT)
    .eq("jam_session_id", sessionId)
    .order("joined_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data as JamSessionParticipant[]) ?? [];
};

export interface UpsertParticipantInput {
  sessionId: string;
  profileId: string;
  defaults?: Partial<Omit<JamSessionParticipantInsert, "jam_session_id" | "profile_id">>;
}

export const upsertJamSessionParticipant = async ({
  sessionId,
  profileId,
  defaults,
}: UpsertParticipantInput): Promise<JamSessionParticipant> => {
  const payload: JamSessionParticipantInsert = {
    jam_session_id: sessionId,
    profile_id: profileId,
    ...defaults,
  };

  const { data, error } = await supabase
    .from("jam_session_participants")
    .upsert(payload, { onConflict: "jam_session_id,profile_id" })
    .select(PARTICIPANT_SELECT)
    .single();

  if (error) {
    throw error;
  }

  return data as JamSessionParticipant;
};

export interface UpdateReadinessInput {
  sessionId: string;
  profileId: string;
  isReady: boolean;
}

export const updateParticipantReadiness = async ({
  sessionId,
  profileId,
  isReady,
}: UpdateReadinessInput): Promise<JamSessionParticipant> => {
  const { data, error } = await supabase
    .from("jam_session_participants")
    .update({ is_ready: isReady })
    .eq("jam_session_id", sessionId)
    .eq("profile_id", profileId)
    .select(PARTICIPANT_SELECT)
    .single();

  if (error) {
    throw error;
  }

  return data as JamSessionParticipant;
};

export const fetchJamSessionMessages = async (
  sessionId: string,
  limit = 50,
): Promise<JamSessionMessage[]> => {
  const { data, error } = await supabase
    .from("jam_session_messages")
    .select(MESSAGE_SELECT)
    .eq("jam_session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data as JamSessionMessage[]) ?? [];
};

export interface PostJamSessionMessageInput {
  sessionId: string;
  senderProfileId: string;
  message: string;
}

export const postJamSessionMessage = async ({
  sessionId,
  senderProfileId,
  message,
}: PostJamSessionMessageInput): Promise<JamSessionMessage> => {
  const payload: Database["public"]["Tables"]["jam_session_messages"]["Insert"] = {
    jam_session_id: sessionId,
    sender_profile_id: senderProfileId,
    message,
  };

  const { data, error } = await supabase
    .from("jam_session_messages")
    .insert(payload)
    .select(MESSAGE_SELECT)
    .single();

  if (error) {
    throw error;
  }

  return data as JamSessionMessage;
};

export const subscribeToJamSessionMessages = (
  sessionId: string,
  onInsert: () => void,
): RealtimeChannel =>
  supabase
    .channel(`jam-session-messages-${sessionId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "jam_session_messages",
        filter: `jam_session_id=eq.${sessionId}`,
      },
      () => {
        onInsert();
      },
    )
    .subscribe();
