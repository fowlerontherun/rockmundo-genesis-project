// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables, TablesInsert, TablesUpdate } from "@/lib/supabase-types";

export type SongwritingDraftRecord = Tables<"songwriting_drafts">;
export type SongwritingDraftRevisionRecord = Tables<"songwriting_draft_revisions">;

export interface CreateSongwritingDraftInput {
  userId: string;
  title: string;
  projectId?: string | null;
  content: Json;
}

export interface UpdateSongwritingDraftInput {
  draftId: string;
  content: Json;
  title?: string;
  lastEditedBy?: string | null;
}

export interface CreateSongwritingRevisionInput {
  draftId: string;
  content: Json;
  createdBy?: string | null;
  summary?: string | null;
}

export const DEFAULT_LYRIC_CONTENT: Json = {
  html: "<p>Start writing your lyrics here. Share the link with collaborators to write together in real time.</p>",
};

export async function fetchSongwritingDraftById(draftId: string): Promise<SongwritingDraftRecord> {
  const { data, error } = await supabase
    .from("songwriting_drafts")
    .select("*")
    .eq("id", draftId)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function fetchSongwritingDraftsForUser(userId: string): Promise<SongwritingDraftRecord[]> {
  const { data, error } = await supabase
    .from("songwriting_drafts")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function createSongwritingDraft(
  input: CreateSongwritingDraftInput,
): Promise<SongwritingDraftRecord> {
  const payload: TablesInsert<"songwriting_drafts"> = {
    user_id: input.userId,
    project_id: input.projectId ?? null,
    title: input.title,
    content: input.content,
  };

  const { data, error } = await supabase
    .from("songwriting_drafts")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateSongwritingDraft(
  input: UpdateSongwritingDraftInput,
): Promise<SongwritingDraftRecord> {
  const payload: TablesUpdate<"songwriting_drafts"> = {
    content: input.content,
    title: input.title,
    last_edited_by: input.lastEditedBy ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("songwriting_drafts")
    .update(payload)
    .eq("id", input.draftId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function fetchSongwritingDraftRevisions(
  draftId: string,
): Promise<SongwritingDraftRevisionRecord[]> {
  const { data, error } = await supabase
    .from("songwriting_draft_revisions")
    .select("*")
    .eq("draft_id", draftId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function createSongwritingDraftRevision(
  input: CreateSongwritingRevisionInput,
): Promise<SongwritingDraftRevisionRecord> {
  const payload: TablesInsert<"songwriting_draft_revisions"> = {
    draft_id: input.draftId,
    content: input.content,
    summary: input.summary ?? null,
    created_by: input.createdBy ?? null,
  };

  const { data, error } = await supabase
    .from("songwriting_draft_revisions")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}
