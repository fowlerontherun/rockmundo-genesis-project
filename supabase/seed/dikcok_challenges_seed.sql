-- Seed data for DikCok challenges with branded sponsorships
INSERT INTO public.dikcok_video_types (name, category, description, difficulty, unlock_requirement, duration_hint, signature_effects)
VALUES
  ('Stage POV', 'Performance', 'High-energy POV clips from the drum riser or DJ booth.', 'Easy', 'Complete first club show', '15-30s', ARRAY['Lens flare', 'Crowd roar']),
  ('Story Capsule', 'Narrative', 'Mini-doc style intro with captions to onboard new fans.', 'Medium', 'Hit 1k followers on DikCok', '30-45s', ARRAY['Lower thirds', 'Luma fade']),
  ('Sponsor Remix', 'Collaboration', 'Blend fan submissions with a branded hook or chant.', 'Advanced', 'Win a weekly challenge', '20-35s', ARRAY['Split screen', 'Beat-synced cuts'])
ON CONFLICT DO NOTHING;

INSERT INTO public.dikcok_challenges (name, theme, starts_at, ends_at, requirements, rewards, sponsor, cross_game_hook, is_active)
VALUES
  ('Glowwave Launch', 'Neon Future', NOW(), NOW() + INTERVAL '7 days', ARRAY['Use Stage POV effect', 'Tag #glowwave'], ARRAY['Front-page pin', '+10% sponsor payout weight for next deal'], 'Glowwave Energy', 'Boosts arena hype meter', true),
  ('Pulse Threads Capsule', 'Streetwear Drop', NOW() + INTERVAL '1 day', NOW() + INTERVAL '9 days', ARRAY['Feature merch in frame', 'Include Story Capsule effect'], ARRAY['Co-created merch slot', 'Fairness weight boost for underdogs'], 'Pulse Threads', 'Increases merch conversion baseline', true),
  ('Nova Audio Lab Residency', 'Studio Craft', NOW() + INTERVAL '3 days', NOW() + INTERVAL '12 days', ARRAY['Remix a fan stem', 'Use Sponsor Remix effect'], ARRAY['Studio time credit', 'Progression bonus toward label interest'], 'Nova Audio Lab', 'Applies to recording quality roll', true)
ON CONFLICT DO NOTHING;
