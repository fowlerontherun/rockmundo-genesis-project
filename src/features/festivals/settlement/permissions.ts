import type { FestivalSettlementStatus } from './types';

const mutableStatuses: FestivalSettlementStatus[] = ['locked', 'failed', 'partially_failed'];

export const canRetryFestivalSettlement = (status: FestivalSettlementStatus): boolean => mutableStatuses.includes(status);
export const canInvalidateFestivalSettlement = (status: FestivalSettlementStatus, isAdmin: boolean): boolean => isAdmin && status === 'completed';
export const canStartFestivalSettlement = (readyForSettlement: boolean, hasActiveSettlement: boolean): boolean => readyForSettlement && !hasActiveSettlement;
