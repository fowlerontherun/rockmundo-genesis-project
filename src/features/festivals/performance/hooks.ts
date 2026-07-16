import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { checkInFestivalPerformer, getFestivalPerformanceSession, getFestivalSessionArrivalStatus, getFestivalSessionReadiness, listPublicFestivalPerformanceSessions } from "./service";
import { realtimeInvalidationKeys } from "./model";

export const useFestivalPerformanceSession = (sessionId?: string) => useQuery({ queryKey: ["festival-performance-session", sessionId], queryFn: () => getFestivalPerformanceSession(sessionId!), enabled: Boolean(sessionId) });
export const useFestivalSessionReadiness = (sessionId?: string) => useQuery({ queryKey: ["festival-session-readiness", sessionId], queryFn: () => getFestivalSessionReadiness(sessionId!), enabled: Boolean(sessionId) });
export const useFestivalSessionArrival = (sessionId?: string) => useQuery({ queryKey: ["festival-session-arrival", sessionId], queryFn: () => getFestivalSessionArrivalStatus(sessionId!), enabled: Boolean(sessionId) });
export const usePublicFestivalPerformanceSessions = (editionId?: string) => useQuery({ queryKey: ["public-festival-performance-sessions", editionId ?? "all"], queryFn: () => listPublicFestivalPerformanceSessions(editionId) });
export function useFestivalPerformerCheckIn(sessionId: string) { const qc = useQueryClient(); return useMutation({ mutationFn: () => checkInFestivalPerformer(sessionId, crypto.randomUUID()), onSuccess: () => realtimeInvalidationKeys(sessionId).forEach((queryKey) => qc.invalidateQueries({ queryKey: [...queryKey] })) }); }
export function useFestivalSessionRealtime(sessionId?: string) { const qc = useQueryClient(); useEffect(() => { if (!sessionId) return; const channel = supabase.channel(`festival-performance-session:${sessionId}`).on("postgres_changes", { event: "*", schema: "public", table: "festival_performance_sessions", filter: `id=eq.${sessionId}` }, () => realtimeInvalidationKeys(sessionId).forEach((queryKey) => qc.invalidateQueries({ queryKey: [...queryKey] }))).on("postgres_changes", { event: "*", schema: "public", table: "festival_performance_session_events", filter: `session_id=eq.${sessionId}` }, () => qc.invalidateQueries({ queryKey: ["festival-session-events", sessionId] })).subscribe(); return () => { void supabase.removeChannel(channel); }; }, [qc, sessionId]); }
