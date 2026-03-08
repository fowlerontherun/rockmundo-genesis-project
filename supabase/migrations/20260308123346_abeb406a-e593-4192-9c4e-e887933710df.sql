-- Add text tattoo columns to player_tattoos
ALTER TABLE player_tattoos ADD COLUMN IF NOT EXISTS custom_text TEXT;
ALTER TABLE player_tattoos ADD COLUMN IF NOT EXISTS font_style TEXT;

-- Insert text tattoo designs (one per font style)
INSERT INTO tattoo_designs (name, category, body_slot, base_price, ink_color_primary, ink_color_secondary, description, genre_affinity) VALUES
('Gothic Script', 'text', 'left_forearm', 150, '#1a1a2e', NULL, 'Dark gothic lettering with pointed serifs', '{"Rock": 0.03, "Metal": 0.04, "Punk": 0.03, "Pop": -0.02, "Classical": -0.04}'),
('Elegant Cursive', 'text', 'right_forearm', 180, '#2d1b4e', NULL, 'Flowing elegant script with graceful curves', '{"Pop": 0.02, "Jazz": 0.03, "R&B": 0.03, "Rock": -0.01, "Metal": -0.03}'),
('Typewriter Text', 'text', 'left_wrist', 120, '#333333', NULL, 'Raw monospace lettering like a vintage typewriter', '{"Punk": 0.04, "Indie": 0.03, "Rock": 0.02, "Pop": -0.02, "Classical": -0.03}'),
('Block Letters', 'text', 'chest', 150, '#0a0a0a', NULL, 'Bold uppercase block lettering', '{"Hip Hop": 0.05, "Punk": 0.03, "Rock": 0.02, "Classical": -0.04, "Jazz": -0.02}'),
('Minimal Line Text', 'text', 'right_wrist', 135, '#444444', NULL, 'Thin clean minimal letterforms', '{"Indie": 0.03, "Electronic": 0.02, "Pop": 0.02, "Metal": -0.03, "Punk": -0.02}'),
('Street Tag', 'text', 'left_upper_arm', 195, '#ff3366', '#00ccff', 'Graffiti-style street lettering with color accents', '{"Hip Hop": 0.06, "Punk": 0.04, "Rock": 0.02, "Classical": -0.05, "Jazz": -0.03}'),
('Blackletter Script', 'text', 'neck', 210, '#1a0a00', NULL, 'Old English blackletter calligraphy', '{"Metal": 0.05, "Rock": 0.04, "Punk": 0.02, "Pop": -0.03, "Electronic": -0.03}'),
('Brush Stroke', 'text', 'right_upper_arm', 225, '#2a0a0a', NULL, 'Japanese brush calligraphy style', '{"Japanese": 0.05, "Jazz": 0.03, "Indie": 0.02, "Hip Hop": -0.02, "Country": -0.03}')
ON CONFLICT DO NOTHING;