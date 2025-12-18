// Facility slot definitions for studios and rehearsal rooms

export interface FacilitySlot {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  duration: number; // hours
  description: string;
}

// Recording Studio Slots (4 per day, 4-hour blocks)
export const STUDIO_SLOTS: FacilitySlot[] = [
  {
    id: 'morning',
    name: 'Morning Session',
    startTime: '09:00',
    endTime: '13:00',
    duration: 4,
    description: 'Early session for fresh creative work'
  },
  {
    id: 'afternoon',
    name: 'Afternoon Session',
    startTime: '14:00',
    endTime: '18:00',
    duration: 4,
    description: 'Standard daytime recording session'
  },
  {
    id: 'evening',
    name: 'Evening Session',
    startTime: '19:00',
    endTime: '23:00',
    duration: 4,
    description: 'Popular evening slot with good atmosphere'
  },
  {
    id: 'night',
    name: 'Late Night Session',
    startTime: '00:00',
    endTime: '04:00',
    duration: 4,
    description: 'Night owl session for dedicated artists'
  }
];

// Rehearsal Room Slots (6 per day, 2-hour blocks)
export const REHEARSAL_SLOTS: FacilitySlot[] = [
  {
    id: 'early_morning',
    name: 'Early Morning',
    startTime: '08:00',
    endTime: '10:00',
    duration: 2,
    description: 'Early bird warm-up session'
  },
  {
    id: 'late_morning',
    name: 'Late Morning',
    startTime: '10:00',
    endTime: '12:00',
    duration: 2,
    description: 'Mid-morning practice slot'
  },
  {
    id: 'afternoon',
    name: 'Afternoon',
    startTime: '14:00',
    endTime: '16:00',
    duration: 2,
    description: 'Afternoon rehearsal slot'
  },
  {
    id: 'late_afternoon',
    name: 'Late Afternoon',
    startTime: '16:00',
    endTime: '18:00',
    duration: 2,
    description: 'After-work practice time'
  },
  {
    id: 'evening',
    name: 'Evening',
    startTime: '19:00',
    endTime: '21:00',
    duration: 2,
    description: 'Popular evening rehearsal slot'
  },
  {
    id: 'night',
    name: 'Night',
    startTime: '21:00',
    endTime: '23:00',
    duration: 2,
    description: 'Late night practice session'
  }
];

export function getStudioSlotById(slotId: string): FacilitySlot | undefined {
  return STUDIO_SLOTS.find(s => s.id === slotId);
}

export function getRehearsalSlotById(slotId: string): FacilitySlot | undefined {
  return REHEARSAL_SLOTS.find(s => s.id === slotId);
}

export function getSlotTimeRange(slot: FacilitySlot, date: Date): { start: Date; end: Date } {
  const [startHour, startMin] = slot.startTime.split(':').map(Number);
  const [endHour, endMin] = slot.endTime.split(':').map(Number);
  
  const start = new Date(date);
  start.setHours(startHour, startMin, 0, 0);
  
  const end = new Date(date);
  end.setHours(endHour, endMin, 0, 0);
  
  // Handle overnight slots
  if (endHour < startHour) {
    end.setDate(end.getDate() + 1);
  }
  
  return { start, end };
}

export function getSlotStatusColor(status: 'available' | 'booked' | 'your-booking'): string {
  switch (status) {
    case 'available':
      return 'bg-green-500/20 border-green-500/50 text-green-700 dark:text-green-400';
    case 'booked':
      return 'bg-red-500/20 border-red-500/50 text-red-700 dark:text-red-400';
    case 'your-booking':
      return 'bg-blue-500/20 border-blue-500/50 text-blue-700 dark:text-blue-400';
  }
}
