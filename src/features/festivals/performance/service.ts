import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { FestivalPublicSession, FestivalSession, FestivalSessionReadiness } from "./model";

const rpc = async <T>(name: string, args: Record<string, unknown> = {}): Promise<T> => { const { data, error } = await supabase.rpc(name as never, args as never); if (error) throw error; return data as T; };
export const ensureFestivalPerformanceSession = (contractId: string, idempotencyKey: string) => rpc<FestivalSession>("ensure_festival_performance_session", { p_contract_id: contractId, p_idempotency_key: idempotencyKey });
export const checkInFestivalPerformer = (sessionId: string, idempotencyKey: string) => rpc<Json>("check_in_festival_performer", { p_session_id: sessionId, p_idempotency_key: idempotencyKey });
export const getFestivalSessionArrivalStatus = (sessionId: string) => rpc<Json>("festival_session_arrival_status", { p_session_id: sessionId });
export const getFestivalSessionReadiness = (sessionId: string) => rpc<FestivalSessionReadiness>("festival_session_readiness", { p_session_id: sessionId });
export const lockFestivalSessionReadiness = (sessionId: string, idempotencyKey: string) => rpc<Json>("lock_festival_session_readiness", { p_session_id: sessionId, p_idempotency_key: idempotencyKey });
export const beginFestivalSoundcheck = (sessionId: string, idempotencyKey: string) => rpc<FestivalSession>("begin_festival_soundcheck", { p_session_id: sessionId, p_idempotency_key: idempotencyKey });
export const completeFestivalSoundcheck = (sessionId: string, idempotencyKey: string) => rpc<FestivalSession>("complete_festival_soundcheck", { p_session_id: sessionId, p_idempotency_key: idempotencyKey });
export const callFestivalBandToStage = (sessionId: string, idempotencyKey: string) => rpc<FestivalSession>("call_festival_band_to_stage", { p_session_id: sessionId, p_idempotency_key: idempotencyKey });
export const startFestivalPerformance = (sessionId: string, idempotencyKey: string) => rpc<FestivalSession>("start_festival_performance", { p_session_id: sessionId, p_idempotency_key: idempotencyKey });
export const advanceFestivalPerformance = (sessionId: string, expectedPosition: number, action: string, metadata: Json, idempotencyKey: string) => rpc<Json>("advance_festival_performance", { p_session_id: sessionId, p_expected_position: expectedPosition, p_action: action, p_metadata: metadata, p_idempotency_key: idempotencyKey });
export const completeFestivalPerformance = (sessionId: string, idempotencyKey: string) => rpc<FestivalSession>("complete_festival_performance", { p_session_id: sessionId, p_idempotency_key: idempotencyKey });
export const cancelFestivalPerformanceSession = (sessionId: string, reason: string, status: string, idempotencyKey: string) => rpc<FestivalSession>("cancel_festival_performance_session", { p_session_id: sessionId, p_reason: reason, p_cancel_status: status, p_idempotency_key: idempotencyKey });
export const listPublicFestivalPerformanceSessions = (editionId?: string) => rpc<FestivalPublicSession[]>("public_festival_performance_sessions", { p_edition_id: editionId ?? null });
export async function getFestivalPerformanceSession(sessionId: string) { const { data, error } = await (supabase as any).from("festival_performance_sessions").select("*").eq("id", sessionId).maybeSingle(); if (error) throw error; return data as FestivalSession | null; }
