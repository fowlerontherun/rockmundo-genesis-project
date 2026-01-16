/**
 * Transport Schedules - Defines departure times for each transport type
 * 
 * - Flights: 5 times daily (6am, 10am, 2pm, 6pm, 10pm)
 * - Trains, Buses, Ferries: Hourly service
 */

export interface TransportSchedule {
  departures: number[]; // Hours of the day (0-23)
  label: string;
  interval: number; // Hours between departures
}

export const TRANSPORT_SCHEDULES: Record<string, TransportSchedule> = {
  bus: {
    departures: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22],
    label: "Hourly departures from 6am to 10pm",
    interval: 1,
  },
  train: {
    departures: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23],
    label: "Hourly departures from 6am to 11pm",
    interval: 1,
  },
  ship: {
    departures: [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
    label: "Hourly ferries from 7am to 8pm",
    interval: 1,
  },
  ferry: {
    departures: [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
    label: "Hourly ferries from 7am to 8pm",
    interval: 1,
  },
  plane: {
    departures: [6, 10, 14, 18, 22],
    label: "Flights at 6am, 10am, 2pm, 6pm, 10pm",
    interval: 4,
  },
  flight: {
    departures: [6, 10, 14, 18, 22],
    label: "Flights at 6am, 10am, 2pm, 6pm, 10pm",
    interval: 4,
  },
};

export interface DepartureSlot {
  hour: number;
  time: string; // "HH:00" format
  label: string; // "6:00 AM" format
  available: boolean;
  isPast: boolean;
}

/**
 * Get the schedule for a transport type, defaulting to train if unknown
 */
export function getTransportSchedule(transportType: string): TransportSchedule {
  const normalized = transportType.toLowerCase();
  return TRANSPORT_SCHEDULES[normalized] || TRANSPORT_SCHEDULES.train;
}

/**
 * Format an hour (0-23) to a readable time string
 */
export function formatHourToTime(hour: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:00 ${period}`;
}

/**
 * Get available departure slots for a given date and transport type
 */
export function getAvailableDepartures(
  transportType: string,
  date: Date
): DepartureSlot[] {
  const schedule = getTransportSchedule(transportType);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const currentHour = now.getHours();
  const currentMinutes = now.getMinutes();

  return schedule.departures.map(hour => {
    // For today, check if this departure has already passed
    // Add 30 min buffer - can't book a departure less than 30 mins away
    const isPast = isToday && (hour < currentHour || (hour === currentHour && currentMinutes > 30));

    return {
      hour,
      time: `${hour.toString().padStart(2, '0')}:00`,
      label: formatHourToTime(hour),
      available: !isPast,
      isPast,
    };
  });
}

/**
 * Get the next available departure for a transport type
 */
export function getNextAvailableDeparture(
  transportType: string,
  fromDate: Date = new Date()
): { date: Date; hour: number } {
  const schedule = getTransportSchedule(transportType);
  const currentHour = fromDate.getHours();
  const currentMinutes = fromDate.getMinutes();

  // Find next available departure today
  const todayDeparture = schedule.departures.find(
    hour => hour > currentHour || (hour === currentHour && currentMinutes <= 30)
  );

  if (todayDeparture !== undefined) {
    return { date: fromDate, hour: todayDeparture };
  }

  // No departures left today, get first departure tomorrow
  const tomorrow = new Date(fromDate);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  return { date: tomorrow, hour: schedule.departures[0] };
}

/**
 * Calculate arrival time based on departure and duration
 */
export function calculateArrivalTime(
  departureDate: Date,
  departureHour: number,
  durationHours: number
): Date {
  const departure = new Date(departureDate);
  departure.setHours(departureHour, 0, 0, 0);
  
  const arrivalMs = departure.getTime() + durationHours * 60 * 60 * 1000;
  return new Date(arrivalMs);
}

/**
 * Format a date for display
 */
export function formatDepartureDateTime(date: Date, hour: number): string {
  const departure = new Date(date);
  departure.setHours(hour, 0, 0, 0);
  
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(departure);
}

/**
 * Check if a departure time is valid (in the future)
 */
export function isValidDeparture(
  date: Date,
  hour: number,
  transportType: string
): boolean {
  const schedule = getTransportSchedule(transportType);
  
  // Check if hour is in schedule
  if (!schedule.departures.includes(hour)) {
    return false;
  }

  // Check if departure is in the future
  const now = new Date();
  const departure = new Date(date);
  departure.setHours(hour, 0, 0, 0);

  // Must be at least 30 minutes in the future
  const minDeparture = new Date(now.getTime() + 30 * 60 * 1000);
  
  return departure >= minDeparture;
}
