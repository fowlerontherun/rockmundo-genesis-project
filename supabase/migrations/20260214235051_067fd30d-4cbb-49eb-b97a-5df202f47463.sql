
-- Reseed university courses: all skills for major cities, subset for others
-- Duration: 14-28 days, increased XP

-- First clear existing courses
DELETE FROM university_courses;

-- Seed courses using PL/pgSQL
DO $$
DECLARE
  uni RECORD;
  skill RECORD;
  is_major BOOLEAN;
  skill_tier TEXT;
  course_name TEXT;
  base_price INT;
  duration INT;
  xp_min INT;
  xp_max INT;
  req_level INT;
  skill_hash INT;
  major_cities TEXT[] := ARRAY[
    'London', 'Chicago', 'Atlanta', 'Miami', 'Austin', 'Seattle',
    'Manchester', 'Liverpool', 'Nashville', 'New Orleans', 'San Francisco',
    'Toronto', 'Melbourne', 'Sydney', 'Seoul', 'Lagos', 'Mumbai',
    'São Paulo', 'Mexico City', 'Montreal', 'Berlin', 'Tokyo',
    'Los Angeles', 'New York', 'Paris', 'Detroit', 'Hong Kong',
    'Singapore', 'Shanghai', 'Barcelona'
  ];
BEGIN
  FOR uni IN SELECT id, city FROM universities LOOP
    is_major := uni.city = ANY(major_cities);

    FOR skill IN SELECT slug, display_name FROM skill_definitions ORDER BY slug LOOP

      -- Determine tier from slug prefix
      IF skill.slug LIKE '%mastery%' THEN
        skill_tier := 'mastery';
      ELSIF skill.slug LIKE 'professional_%' OR skill.slug LIKE '%_professional_%' THEN
        skill_tier := 'professional';
      ELSE
        skill_tier := 'basic';
      END IF;

      -- For non-major cities, skip ~60% of skills using a deterministic hash
      IF NOT is_major THEN
        skill_hash := abs(hashtext(uni.id::text || skill.slug)) % 100;
        IF skill_hash > 40 THEN
          CONTINUE;
        END IF;
      END IF;

      -- Set tier-based parameters
      IF skill_tier = 'mastery' THEN
        base_price := 8000 + (abs(hashtext(skill.slug || uni.id::text)) % 7000);
        duration := 21 + (abs(hashtext(uni.id::text || 'dur' || skill.slug)) % 8); -- 21-28
        xp_min := 40 + (abs(hashtext(skill.slug || 'xpmin')) % 20); -- 40-59
        xp_max := xp_min + 15 + (abs(hashtext(skill.slug || 'xpmax')) % 25); -- +15 to +39
        req_level := 5;
      ELSIF skill_tier = 'professional' THEN
        base_price := 3000 + (abs(hashtext(skill.slug || uni.id::text)) % 5000);
        duration := 17 + (abs(hashtext(uni.id::text || 'dur' || skill.slug)) % 12); -- 17-28
        xp_min := 25 + (abs(hashtext(skill.slug || 'xpmin')) % 15); -- 25-39
        xp_max := xp_min + 10 + (abs(hashtext(skill.slug || 'xpmax')) % 20); -- +10 to +29
        req_level := 2;
      ELSE
        base_price := 500 + (abs(hashtext(skill.slug || uni.id::text)) % 3000);
        duration := 14 + (abs(hashtext(uni.id::text || 'dur' || skill.slug)) % 15); -- 14-28
        xp_min := 15 + (abs(hashtext(skill.slug || 'xpmin')) % 10); -- 15-24
        xp_max := xp_min + 8 + (abs(hashtext(skill.slug || 'xpmax')) % 15); -- +8 to +22
        req_level := 0;
      END IF;

      -- Build course name
      course_name := COALESCE(skill.display_name, skill.slug) || ' Course';

      INSERT INTO university_courses (
        university_id, skill_slug, name, description, 
        base_price, base_duration_days, required_skill_level,
        xp_per_day_min, xp_per_day_max, max_enrollments,
        is_active, class_start_hour, class_end_hour
      ) VALUES (
        uni.id, skill.slug, course_name, 
        'Study ' || COALESCE(skill.display_name, skill.slug) || ' at ' || uni.city,
        base_price, duration, req_level,
        xp_min, xp_max, 30,
        true, 10, 14
      );

    END LOOP;
  END LOOP;
END $$;
