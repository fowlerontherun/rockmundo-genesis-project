-- Extend expired contract offers so players can interact with them
UPDATE artist_label_contracts 
SET expires_at = NOW() + INTERVAL '7 days' 
WHERE status IN ('offered', 'negotiating') 
AND expires_at < NOW();