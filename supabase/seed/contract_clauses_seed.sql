insert into public.contract_clauses (contract_type, clause_key, title, description, default_terms, sort_order)
values
  (
    'general',
    'royalty_split',
    'Royalty Split',
    'Defines the revenue distribution between the label and artist.',
    '{"summary": "Standard 60/40 split favoring the artist", "value": "60% artist share", "expectations": "Bonus points unlock for charting singles"}',
    1
  ),
  (
    'general',
    'release_commitment',
    'Release Commitment',
    'Minimum number of major releases required per contract year.',
    '{"summary": "Two major releases annually", "value": 2, "expectations": "At least one full-length project"}',
    2
  ),
  (
    'general',
    'marketing_support',
    'Marketing Support',
    'Baseline marketing budget and focus areas covered by the label.',
    '{"summary": "$25k per release campaign", "value": "$25,000", "expectations": "Digital-first pushes plus tour promo"}',
    3
  )
on conflict (contract_type, clause_key)
do update set
  title = excluded.title,
  description = excluded.description,
  default_terms = excluded.default_terms,
  sort_order = excluded.sort_order,
  updated_at = timezone('utc', now());
