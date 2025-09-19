// Simplified progression client - disabled until progression system is implemented
export type ProgressionAction = {
  type: string;
} & Record<string, unknown>;

export interface ProgressionErrorResponse {
  success: false;
  error: string;
}

export interface ProgressionSuccessResponse<T> {
  success: true;
  data: T;
}

export const executeProgressionAction = async <T = never>(
  action: ProgressionAction
): Promise<ProgressionErrorResponse | ProgressionSuccessResponse<T>> => {
  console.warn('Progression action attempted before implementation:', action);
  return { success: false, error: 'Progression system not implemented' };
};