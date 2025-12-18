import React, { useState } from 'react';
import { FacilitySchedule } from '@/components/schedule/FacilitySchedule';
import { REHEARSAL_SLOTS, FacilitySlot } from '@/utils/facilitySlots';
import { useRehearsalRoomWeekAvailability } from '@/hooks/useRehearsalRoomAvailability';
import { startOfWeek } from 'date-fns';

interface RehearsalRoomScheduleProps {
  roomId: string;
  roomName: string;
  currentBandId?: string | null;
  onSlotClick?: (date: Date, slot: FacilitySlot) => void;
}

export const RehearsalRoomSchedule = ({ roomId, roomName, currentBandId, onSlotClick }: RehearsalRoomScheduleProps) => {
  const [startDate, setStartDate] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));

  const { data: weekAvailability, isLoading } = useRehearsalRoomWeekAvailability(
    roomId,
    startDate,
    !!roomId
  );

  // Transform the data to include isYourBooking flag
  const transformedAvailability = weekAvailability ? Object.fromEntries(
    Object.entries(weekAvailability).map(([dateKey, slots]) => [
      dateKey,
      Object.fromEntries(
        Object.entries(slots).map(([slotId, data]) => [
          slotId,
          { ...data, isYourBooking: false } // We'd need to enhance the hook to track this
        ])
      )
    ])
  ) : undefined;

  return (
    <FacilitySchedule
      title="Rehearsal Room Schedule"
      facilityName={roomName}
      slots={REHEARSAL_SLOTS}
      weekAvailability={transformedAvailability}
      isLoading={isLoading}
      onSlotClick={onSlotClick}
      startDate={startDate}
      onDateChange={setStartDate}
    />
  );
};
