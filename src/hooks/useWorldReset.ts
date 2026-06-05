import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface MaintenanceState {
  id: number;
  is_active: boolean;
  message: string | null;
  scheduled_reset_at: string | null;
  initiated_by: string | null;
  updated_at: string;
}

export interface ResetPreviewRow {
  table_name: string;
  action: "wipe" | "preserve";
  reason: string;
}

export interface ResetArchive {
  schema_name: string;
  table_count: number;
  created_at: string | null;
}

const sb = supabase as any;

export function useMaintenanceState() {
  return useQuery({
    queryKey: ["game-maintenance"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("game_maintenance")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return data as MaintenanceState | null;
    },
    refetchInterval: 15000,
  });
}

export function useResetPreview(enabled = true) {
  return useQuery({
    queryKey: ["world-reset-preview"],
    queryFn: async () => {
      const { data, error } = await sb.rpc("admin_world_reset_preview");
      if (error) throw error;
      return (data ?? []) as ResetPreviewRow[];
    },
    enabled,
  });
}

export function useResetArchives() {
  return useQuery({
    queryKey: ["world-reset-archives"],
    queryFn: async () => {
      const { data, error } = await sb.rpc("admin_list_reset_archives");
      if (error) throw error;
      return (data ?? []) as ResetArchive[];
    },
  });
}

export function useEnableMaintenance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { message: string; scheduledAt: Date }) => {
      const { data, error } = await sb.rpc("admin_enable_maintenance", {
        p_message: args.message,
        p_scheduled_at: args.scheduledAt.toISOString(),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["game-maintenance"] });
      toast.success("Maintenance mode enabled");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDisableMaintenance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await sb.rpc("admin_disable_maintenance");
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["game-maintenance"] });
      toast.success("Maintenance mode disabled");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useExecuteWorldReset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (confirm: string) => {
      const { data, error } = await sb.rpc("admin_world_reset", { p_confirm: confirm });
      if (error) throw error;
      return data as { success: boolean; archive_schema: string; tables_archived: number; tables_wiped: number };
    },
    onSuccess: (data) => {
      qc.invalidateQueries();
      toast.success(`World reset complete — ${data.tables_wiped} tables wiped, archived to ${data.archive_schema}`);
    },
    onError: (e: Error) => toast.error(`Reset failed: ${e.message}`),
  });
}
