-- Read-only regression for Politics university seed dependencies.
-- Missing or mislocated universities must fail before courses/mentors run.
DO $politics_uni_test$
DECLARE
  missing integer;
  ambiguous integer;
  empty_course integer;
BEGIN
  WITH expected(name,city,country) AS (VALUES
    ('Cambridge University','London','United Kingdom'),
    ('Manchester University','Manchester','United Kingdom'),
    ('Chicago Conservatory of Arts','Chicago','USA'),
    ('London Conservatory of Arts','London','United Kingdom')
  )
  SELECT count(*) INTO missing FROM expected e
  WHERE NOT EXISTS (
    SELECT 1 FROM public.universities u
    WHERE lower(u.name)=lower(e.name) AND lower(u.city)=lower(e.city)
  );
  IF missing<>0 THEN RAISE EXCEPTION 'Politics course catalogue missing % canonical universities',missing; END IF;

  WITH expected(name) AS (VALUES
    ('Cambridge University'),('Manchester University'),
    ('Chicago Conservatory of Arts'),('London Conservatory of Arts')
  )
  SELECT count(*) INTO ambiguous FROM expected e
  WHERE (SELECT count(*) FROM public.universities u WHERE lower(u.name)=lower(e.name))<>1;
  IF ambiguous<>0 THEN RAISE EXCEPTION 'Politics university names are missing or ambiguous: %',ambiguous; END IF;

  SELECT count(*) INTO empty_course FROM (
    VALUES ('Rhetoric & Oratory I'),('Grassroots Campaigning'),
    ('American Political Speech'),('Foreign Office Foundations')
  ) names(course_name)
  WHERE NOT EXISTS (SELECT 1 FROM public.university_courses c WHERE c.name=names.course_name);
  IF empty_course<>0 THEN RAISE EXCEPTION 'Missing % Politics courses linked to universities',empty_course; END IF;
END $politics_uni_test$;
