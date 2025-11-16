import { supabase } from "@/integrations/supabase/client";

export type ProgressionAction =
  | "award_action_xp"
  | "award_special_xp"
  | "admin_award_special_xp"
  | "claim_daily_xp"
  | "spend_attribute_xp"
  | "spend_skill_xp";

export interface ProgressionErrorResponse {
  success: false;
  error: string;
}

export interface ProgressionSuccessResponse<T> {
  success: true;
  data: T;
}

export const executeProgressionAction = async <T = any>(
  action: ProgressionAction,
  params: Record<string, unknown> = {},
): Promise<ProgressionSuccessResponse<T> | ProgressionErrorResponse> => {
  try {
    const { data, error } = await supabase.functions.invoke('progression', {
      body: { action, ...params }
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data || !data.success) {
      return { success: false, error: data?.message || 'Unknown error' };
    }

    return { success: true, data: data as T };
  } catch (err) {
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Unknown error' 
    };
  }
};