-- Cover the Festival day-plan edition foreign key for cleanup/history queries.
CREATE INDEX IF NOT EXISTS festival_attendee_plan_items_edition_idx
  ON public.festival_attendee_plan_items(festival_edition_id);
