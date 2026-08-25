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
    jsonb_build_object('route', '/admin'),
    'bug_report',
    NEW.id
  FROM public.user_roles ur
  WHERE ur.role = 'admin'::public.app_role;

  RETURN NEW;
END;
$$;

UPDATE public.player_inbox
SET action_data = jsonb_build_object('route', '/admin')
WHERE related_entity_type IN ('bug_report', 'bug_report_backlog')
  AND action_type = 'navigate';
