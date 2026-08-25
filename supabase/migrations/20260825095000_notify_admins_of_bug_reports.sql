CREATE OR REPLACE FUNCTION public.notify_admins_of_bug_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  INSERT INTO public.player_inbox (
    user_id,
    category,
    priority,
    title,
    message,
    metadata,
    action_type,
    action_data,
    related_entity_type,
    related_entity_id
  )
  SELECT DISTINCT
    ur.user_id,
    'system'::public.inbox_category,
    CASE NEW.severity
      WHEN 'critical' THEN 'urgent'::public.inbox_priority
      WHEN 'high' THEN 'high'::public.inbox_priority
      ELSE 'normal'::public.inbox_priority
    END,
    'New bug report: ' || left(NEW.title, 100),
    'A ' || upper(NEW.severity) || ' ' || NEW.category || ' bug was reported from ' || coalesce(NEW.page_url, 'an unknown page') || '.',
    jsonb_build_object(
      'bug_report_id', NEW.id,
      'severity', NEW.severity,
      'category', NEW.category,
      'page_url', NEW.page_url
    ),
    'navigate',
    jsonb_build_object('path', '/admin'),
    'bug_report',
    NEW.id
  FROM public.user_roles ur
  WHERE ur.role = 'admin'::public.app_role;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_admins_on_bug_report_insert ON public.bug_reports;
CREATE TRIGGER notify_admins_on_bug_report_insert
AFTER INSERT ON public.bug_reports
FOR EACH ROW
EXECUTE FUNCTION public.notify_admins_of_bug_report();

INSERT INTO public.player_inbox (
  user_id,
  category,
  priority,
  title,
  message,
  metadata,
  action_type,
  action_data,
  related_entity_type
)
SELECT DISTINCT
  ur.user_id,
  'system'::public.inbox_category,
  CASE WHEN counts.high_priority > 0 THEN 'high'::public.inbox_priority ELSE 'normal'::public.inbox_priority END,
  'Bug report backlog ready for review',
  counts.open_count || ' open player bug report' || CASE WHEN counts.open_count = 1 THEN '' ELSE 's' END || ' are waiting in Admin.',
  jsonb_build_object('open_bug_reports', counts.open_count, 'high_priority', counts.high_priority),
  'navigate',
  jsonb_build_object('path', '/admin'),
  'bug_report_backlog'
FROM public.user_roles ur
CROSS JOIN LATERAL (
  SELECT
    count(*) FILTER (WHERE status = 'open')::int AS open_count,
    count(*) FILTER (WHERE status = 'open' AND severity IN ('high', 'critical'))::int AS high_priority
  FROM public.bug_reports
) counts
WHERE ur.role = 'admin'::public.app_role
  AND counts.open_count > 0;
