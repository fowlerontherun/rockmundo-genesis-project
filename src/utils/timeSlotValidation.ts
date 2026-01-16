// Time slot validation utilities for past-time booking prevention

import { getSlotTimeRange, FacilitySlot } from './facilitySlots';
import { isSameDay } from 'date-fns';

/**
 * Check if a time slot has already passed for a given date
 */
export function isSlotInPast(slot: FacilitySlot, date: Date): boolean {
  const now = new Date();
  
  // Only check if it's today
  if (!isSameDay(date, now)) {
    return false;
  }
  
  const { start } = getSlotTimeRange(slot, date);
  return start <= now;
}

/**
 * Check if a specific hour has passed for today
 */
export function isHourInPast(hour: number, date: Date): boolean {
  const now = new Date();
  
  // Only check if it's today
  if (!isSameDay(date, now)) {
    return false;
  }
  
  const slotTime = new Date(date);
  slotTime.setHours(hour, 0, 0, 0);
  
  return slotTime <= now;
}

/**
 * Validate that a scheduled start time is in the future
 */
export function validateFutureTime(scheduledStart: Date): { valid: boolean; message?: string } {
  const now = new Date();
  if (scheduledStart <= now) {
    return { 
      valid: false, 
      message: 'Cannot book a time slot that has already passed.' 
    };
  }
  return { valid: true };
}

/**
 * Get the number of minutes until a slot starts (negative if already passed)
 */
export function getMinutesUntilSlot(slot: FacilitySlot, date: Date): number {
  const now = new Date();
  const { start } = getSlotTimeRange(slot, date);
  return Math.floor((start.getTime() - now.getTime()) / (1000 * 60));
}
