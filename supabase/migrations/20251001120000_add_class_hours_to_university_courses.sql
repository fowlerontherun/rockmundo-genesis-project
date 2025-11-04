-- Adds configurable class hours for university courses
alter table public.university_courses
  add column if not exists class_start_hour integer not null default 10;

alter table public.university_courses
  add column if not exists class_end_hour integer not null default 14;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'university_courses_class_hours_check'
      and conrelid = 'public.university_courses'::regclass
  ) then
    alter table public.university_courses
      add constraint university_courses_class_hours_check
      check (
        class_start_hour >= 0
        and class_start_hour < 24
        and class_end_hour > class_start_hour
        and class_end_hour <= 24
      );
  end if;
end
$$;
