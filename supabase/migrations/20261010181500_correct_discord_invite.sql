-- Correct legacy announcement CTA URLs without changing historical migrations.
-- Only replace the known obsolete Discord invite; preserve administrator-defined links.
UPDATE public.site_settings
SET value = jsonb_set(value::jsonb, '{cta_url}', '"https://discord.gg/ZNF4hRrj2"'::jsonb, true)
WHERE key = 'public_announcement'
  AND value::jsonb ->> 'cta_url' = 'https://discord.gg/lovable-dev';
