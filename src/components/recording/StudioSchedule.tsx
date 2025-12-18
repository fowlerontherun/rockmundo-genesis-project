import React, { useState } from 'react';
import { FacilitySchedule } from '@/components/schedule/FacilitySchedule';
import { STUDIO_SLOTS, FacilitySlot } from '@/utils/facilitySlots';
import { useStudioWeekAvailability } from '@/hooks/useStudioAvailability';
import { startOfWeek } from 'date-fns';

interface StudioScheduleProps {
  studioId: string;
  studioName: string;
  currentBandId?: string | null;
  onSlotClick?: (date: Date, slot: FacilitySlot) => void;
}

export const StudioSchedule = ({ studioId, studioName, currentBandId, onSlotClick }: StudioScheduleProps) => {
  const [startDate, setStartDate] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));

  const { data: weekAvailability, isLoading } = useStudioWeekAvailability(
    studioId,
    startDate,
    !!studioId
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
      title="Studio Schedule"
      facilityName={studioName}
      slots={STUDIO_SLOTS}
      weekAvailability={transformedAvailability}
      isLoading={isLoading}
      onSlotClick={onSlotClick}
      startDate={startDate}
      onDateChange={setStartDate}
    />
  );
};
