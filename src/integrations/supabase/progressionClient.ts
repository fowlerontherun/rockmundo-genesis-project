// Simplified progression client - disabled until progression system is implemented
export interface ProgressionAction {
  type: string;
  [key: string]: any;
}

export interface ProgressionErrorResponse {
  success: false;
  error: string;
}

export interface ProgressionSuccessResponse<T> {
  success: true;
  data: T;
}

export const executeProgressionAction = async (action: ProgressionAction) => {
  return { success: false, error: 'Progression system not implemented' } as ProgressionErrorResponse;
};