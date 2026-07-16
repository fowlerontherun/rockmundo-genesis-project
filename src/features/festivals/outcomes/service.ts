import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { FestivalAudienceGeneration, FestivalPerformanceOutcome, FestivalStageCrowdSnapshot } from "./model";

const rpc = async <T>(name: string, args: Record<string, unknown> = {}): Promise<T> => { const { data, error } = await supabase.rpc(name as never, args as never); if (error) throw error; return data as T; };
export const generateFestivalEditionAudience = (editionId: string, idempotencyKey: string) => rpc<FestivalAudienceGeneration>("generate_festival_edition_audience", { p_edition_id: editionId, p_idempotency_key: idempotencyKey });
export const simulateFestivalCrowdMovement = (editionId: string, at: string, idempotencyKey: string) => rpc<FestivalStageCrowdSnapshot[]>("simulate_festival_crowd_movement", { p_edition_id: editionId, p_at: at, p_idempotency_key: idempotencyKey });
export const calculateFestivalPerformanceOutcome = (sessionId: string, idempotencyKey: string) => rpc<FestivalPerformanceOutcome>("calculate_festival_performance_outcome", { p_session_id: sessionId, p_idempotency_key: idempotencyKey });
export const getFestivalPerformanceNarrative = (sessionId: string) => rpc<Json>("festival_performance_narrative", { p_session_id: sessionId });
export const listPublicFestivalPerformanceOutcomes = (editionId?: string) => rpc<Json[]>("public_festival_performance_outcomes", { p_session_id: null, p_edition_id: editionId ?? null });
export async function listFestivalSongOutcomes(sessionId: string) { const { data, error } = await (supabase as any).from("festival_song_performance_outcomes").select("*").eq("session_id", sessionId).order("setlist_position"); if (error) throw error; return data; }
export async function listFestivalHighlights(sessionId: string) { const { data, error } = await (supabase as any).from("festival_performance_highlights").select("*").eq("session_id", sessionId).order("created_at"); if (error) throw error; return data; }
