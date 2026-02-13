INSERT INTO system_settings (key, value, description)
VALUES ('nav_style', '"sidebar"', 'Navigation style: sidebar or horizontal')
ON CONFLICT (key) DO NOTHING;