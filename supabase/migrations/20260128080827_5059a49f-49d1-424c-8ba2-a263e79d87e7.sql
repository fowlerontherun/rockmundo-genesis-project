-- Reset attribute points to a more reasonable starting value
-- Give players a small starting bonus of 50 AP plus 1% of lifetime XP (capped at 100 bonus)
UPDATE player_xp_wallet SET
  attribute_points_balance = 50 + LEAST(100, FLOOR(COALESCE(lifetime_xp, 0) * 0.01)::INTEGER),
  attribute_points_lifetime = 50 + LEAST(100, FLOOR(COALESCE(lifetime_xp, 0) * 0.01)::INTEGER)
WHERE attribute_points_balance > 150;