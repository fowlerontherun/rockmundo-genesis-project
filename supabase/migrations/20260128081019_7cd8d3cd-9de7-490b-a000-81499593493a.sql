-- Fix wallets with 0 AP - give them the proper starting amount
UPDATE player_xp_wallet SET
  skill_xp_balance = COALESCE(xp_balance, 0),
  skill_xp_lifetime = COALESCE(lifetime_xp, 0),
  attribute_points_balance = 50 + LEAST(100, FLOOR(COALESCE(lifetime_xp, 0) * 0.01)::INTEGER),
  attribute_points_lifetime = 50 + LEAST(100, FLOOR(COALESCE(lifetime_xp, 0) * 0.01)::INTEGER)
WHERE attribute_points_balance = 0 OR attribute_points_balance IS NULL;