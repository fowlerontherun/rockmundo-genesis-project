import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_CROWD_TUNING,
  normalizeCrowdTuning,
  type CrowdTuningOptions,
} from "../engine/CrowdTuning";

export interface GlobalCrowdTuningSettings {
  revision: number;
  settings: CrowdTuningOptions;
  updatedAt: string | null;
  updatedBy: string | null;
  reason: string | null;
}

const QUERY_KEY = ["gig-viewer", "global-crowd-tuning"] as const;

export function useGlobalCrowdTuning(enabled = true) {
  return useQuery({
    queryKey: QUERY_KEY,
    enabled,
    staleTime: 60_000,
    retry: false,
    queryFn: fetchGlobalCrowdTuning,
  });
}

export function useSaveGlobalCrowdTuning() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ settings, reason }: { settings: CrowdTuningOptions; reason: string }) => {
      const { data, error } = await (supabase as any).rpc("admin_set_gig_viewer_crowd_settings", {
        p_settings: normalizeCrowdTuning(settings),
        p_reason: reason,
      });
      if (error) throw error;
      return mapRpcResult(data);
    },
    onSuccess: (settings) => {
      queryClient.setQueryData(QUERY_KEY, settings);
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success(`Crowd defaults saved as revision ${settings.revision}`);
    },
    onError: (error: Error) => {
      toast.error(`Unable to save crowd defaults: ${error.message}`);
    },
  });
}

export function useRestoreGlobalCrowdTuning() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ reason }: { reason: string }) => {
      const { data, error } = await (supabase as any).rpc("admin_restore_gig_viewer_crowd_settings", {
        p_reason: reason,
      });
      if (error) throw error;
      return mapRpcResult(data);
    },
    onSuccess: (settings) => {
      queryClient.setQueryData(QUERY_KEY, settings);
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success(`System crowd defaults restored as revision ${settings.revision}`);
    },
    onError: (error: Error) => {
      toast.error(`Unable to restore crowd defaults: ${error.message}`);
    },
  });
}

async function fetchGlobalCrowdTuning(): Promise<GlobalCrowdTuningSettings> {
  const { data, error } = await (supabase as any)
    .from("gig_viewer_crowd_settings")
    .select("revision,settings,updated_at,updated_by,reason")
    .eq("id", true)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    return {
      revision: 1,
      settings: { ...DEFAULT_CROWD_TUNING },
      updatedAt: null,
      updatedBy: null,
      reason: "Production fallback",
    };
  }

  return {
    revision: Math.max(1, Number(data.revision) || 1),
    settings: normalizeCrowdTuning(data.settings),
    updatedAt: typeof data.updated_at === "string" ? data.updated_at : null,
    updatedBy: typeof data.updated_by === "string" ? data.updated_by : null,
    reason: typeof data.reason === "string" ? data.reason : null,
  };
}

function mapRpcResult(data: any): GlobalCrowdTuningSettings {
  return {
    revision: Math.max(1, Number(data?.revision) || 1),
    settings: normalizeCrowdTuning(data?.settings),
    updatedAt: typeof data?.updatedAt === "string" ? data.updatedAt : null,
    updatedBy: typeof data?.updatedBy === "string" ? data.updatedBy : null,
    reason: typeof data?.reason === "string" ? data.reason : null,
  };
}
