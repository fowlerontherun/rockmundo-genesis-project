-- Populate missing identities on the EXISTING canonical sponsorship_brands catalogue.
-- Generated logos are deterministic fictional monogram SVGs; admins can replace them
-- with individually art-directed assets later. Never overwrite existing custom logos.
CREATE OR REPLACE FUNCTION public.festival_brand_monogram_logo(
  brand_name text,
  brand_category text
) RETURNS text
LANGUAGE sql IMMUTABLE STRICT
SET search_path = ''
AS $$
  WITH identity AS (
    SELECT
      upper(left(regexp_replace(trim(brand_name), '[^[:alnum:] ]', '', 'g'), 1) ||
        left(coalesce(nullif(split_part(trim(brand_name), ' ', 2), ''), trim(brand_name)), 1)) AS initials,
      substr(md5(lower(trim(brand_name))), 1, 6) AS accent,
      substr(md5(lower(trim(brand_category))), 1, 6) AS secondary
  )
  SELECT 'data:image/svg+xml;base64,' || encode(convert_to(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 320" role="img">' ||
    '<defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#' || accent ||
    '"/><stop offset="1" stop-color="#' || secondary || '"/></linearGradient></defs>' ||
    '<rect width="512" height="320" rx="36" fill="url(#g)"/>' ||
    '<rect x="16" y="16" width="480" height="288" rx="26" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="4"/>' ||
    '<text x="256" y="170" text-anchor="middle" dominant-baseline="middle" font-family="Arial,sans-serif" font-size="136" font-weight="800" fill="#fff">' ||
    initials || '</text><path d="M136 244H376" stroke="#fff" stroke-width="5" stroke-linecap="round"/></svg>',
    'UTF8'), 'base64')
  FROM identity;
$$;

UPDATE public.sponsorship_brands
SET logo_url = public.festival_brand_monogram_logo(name, category)
WHERE logo_url IS NULL OR btrim(logo_url) = '';

COMMENT ON FUNCTION public.festival_brand_monogram_logo(text,text)
IS 'Deterministic fictional placeholder logo for existing canonical sponsorship brands; not a replacement for bespoke art-directed logos.';
