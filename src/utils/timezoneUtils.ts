// Timezone utility functions for displaying times in city local time
import { formatInTimeZone, toZonedTime, fromZonedTime } from 'date-fns-tz';

/**
 * Format a date/time in a specific city's timezone
 */
export function formatTimeInCityTimezone(
  date: Date | string,
  timezone: string,
  formatStr: string = 'h:mm a'
): string {
  try {
    return formatInTimeZone(new Date(date), timezone, formatStr);
  } catch (error) {
    console.warn('Timezone formatting failed, using local time:', error);
    return new Date(date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
}

/**
 * Get the current local time in a specific timezone
 */
export function getLocalTimeInCity(timezone: string): Date {
  try {
    return toZonedTime(new Date(), timezone);
  } catch (error) {
    console.warn('Timezone conversion failed:', error);
    return new Date();
  }
}

/**
 * Check if the current time in a city is between certain hours
 */
export function isTimeInCityBetween(
  timezone: string,
  startHour: number,
  endHour: number
): boolean {
  try {
    const localTime = getLocalTimeInCity(timezone);
    const hour = localTime.getHours();
    return hour >= startHour && hour < endHour;
  } catch {
    return false;
  }
}

/**
 * Get a label for displaying city time (e.g., "Sydney time")
 */
export function getCityTimeLabel(cityName: string): string {
  return `${cityName} time`;
}

/**
 * Format a time range with timezone context
 */
export function formatTimeRangeInTimezone(
  startDate: Date | string,
  endDate: Date | string,
  timezone: string,
  cityName?: string
): string {
  try {
    const startTime = formatInTimeZone(new Date(startDate), timezone, 'h:mm a');
    const endTime = formatInTimeZone(new Date(endDate), timezone, 'h:mm a');
    const label = cityName ? ` (${cityName} time)` : '';
    return `${startTime} - ${endTime}${label}`;
  } catch {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return `${start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} - ${end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }
}

/**
 * Convert a local date/time in a specific timezone to a UTC Date.
 * Use this when the user picks "8 PM" and you want to store that as 8 PM
 * in the venue's timezone, not the browser's timezone.
 */
export function localTimeToUTC(
  localDate: Date,
  timezone: string
): Date {
  try {
    return fromZonedTime(localDate, timezone);
  } catch (error) {
    console.warn('Timezone conversion to UTC failed, using local date:', error);
    return localDate;
  }
}

/**
 * Build a Date representing a specific date + time in a given timezone,
 * then return the equivalent UTC Date for storage.
 * 
 * @param date - The calendar date the user selected (only year/month/day used)
 * @param hours - The hour in the venue's local time (0-23)
 * @param minutes - The minutes in the venue's local time (0-59)
 * @param timezone - The IANA timezone of the venue's city
 */
export function buildDateInTimezone(
  date: Date,
  hours: number,
  minutes: number,
  timezone: string
): Date {
  // Create a date with the user's selected calendar date + desired time
  const localDate = new Date(date);
  localDate.setHours(hours, minutes, 0, 0);
  
  // Convert from the venue's local time to UTC
  return localTimeToUTC(localDate, timezone);
}
