import { useRef } from "react";
import {
  GigBookingDialog as BaseGigBookingDialog,
  type BookingForecast,
  type GigBookingSubmission,
} from "./GigBookingDialog";

export type { BookingForecast, GigBookingSubmission };

type StableGigBookingDialogProps = Parameters<typeof BaseGigBookingDialog>[0];

/**
 * Keeps the suggested booking date stable for the lifetime of an open dialog.
 *
 * GigBooking currently recalculates its suggested date whenever the parent page
 * refreshes. Passing that freshly-created Date object straight into the base
 * dialog causes its initialDate effect to overwrite a date the player has
 * already selected. Freezing the initial value here makes initialDate behave as
 * an actual initial value while preserving every other booking-dialog feature.
 */
export const GigBookingDialog = (props: StableGigBookingDialogProps) => {
  const initialDateRef = useRef<Date | undefined>(
    props.initialDate ? new Date(props.initialDate) : undefined,
  );

  return (
    <BaseGigBookingDialog
      {...props}
      initialDate={initialDateRef.current}
    />
  );
};
