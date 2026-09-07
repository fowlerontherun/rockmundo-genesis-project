-- The September 2026 production repair temporarily uses artist bookings and
-- simplified site-plan stages as the attendee schedule authority. When the later
-- canonical schedule-revision domain reaches this migration, hand the generic
-- attendee references over to festival_schedule_items / festival_stages before
-- the canonical C5 stage bridge is installed.

ALTER TABLE public.festival_attendee_plan_items
  DROP CONSTRAINT IF EXISTS festival_attendee_plan_items_schedule_booking_fkey,
  DROP CONSTRAINT IF EXISTS festival_attendee_plan_items_schedule_item_id_fkey,
  DROP CONSTRAINT IF EXISTS festival_attendee_plan_items_stage_id_fkey;

ALTER TABLE public.festival_attendee_plan_items
  ADD CONSTRAINT festival_attendee_plan_items_schedule_item_id_fkey
    FOREIGN KEY (schedule_item_id)
    REFERENCES public.festival_schedule_items(id)
    ON DELETE SET NULL,
  ADD CONSTRAINT festival_attendee_plan_items_stage_id_fkey
    FOREIGN KEY (stage_id)
    REFERENCES public.festival_stages(id)
    ON DELETE SET NULL;
