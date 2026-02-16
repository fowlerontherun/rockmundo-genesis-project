
-- Set all players to 1M cash
UPDATE profiles SET cash = 1000000;

-- Set fame to 80% of their band's fame for players with active bands
UPDATE profiles p
SET fame = FLOOR(b.fame * 0.8)
FROM band_members bm
JOIN bands b ON b.id = bm.band_id AND b.status = 'active'
WHERE bm.user_id = p.user_id AND bm.member_status = 'active';
