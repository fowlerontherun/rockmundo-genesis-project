// Simplified progression client - disabled until progression system is implemented
export type ProgressionAction = {
  type: string;
  [key: string]: unknown;
}


export interface ProgressionErrorResponse {
  success: false;
  error: string;
}

export interface ProgressionSuccessResponse<T> {
  success: true;
  data: T;
}

export const executeProgressionAction = async (
  _action: ProgressionAction
): Promise<ProgressionErrorResponse> => {
  return { success: false, error: 'Progression system not implemented' };
};