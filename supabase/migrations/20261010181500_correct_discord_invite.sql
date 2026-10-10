-- Replace only the obsolete Discord invite in the public announcement banner.
-- Preserve custom administrator-configured announcement links.
UPDATE public.system_settings
SET value = jsonb_set(value, '{cta_url}', '"https://discord.gg/ZNF4hRrj2"'::jsonb)
WHERE key = 'announcement_banner'
  AND value ->> 'cta_url' = 'https://discord.gg/lovable-dev';
