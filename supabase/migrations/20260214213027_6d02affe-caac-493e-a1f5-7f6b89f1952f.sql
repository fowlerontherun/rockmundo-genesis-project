
-- Add new columns to crypto_tokens
ALTER TABLE public.crypto_tokens 
  ADD COLUMN IF NOT EXISTS is_rugged boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS volatility_tier text NOT NULL DEFAULT 'mid',
  ADD COLUMN IF NOT EXISTS trend_direction numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Add check constraint for volatility_tier
ALTER TABLE public.crypto_tokens ADD CONSTRAINT crypto_tokens_volatility_tier_check 
  CHECK (volatility_tier IN ('micro', 'mid', 'large', 'blue_chip'));

-- Update existing tokens with appropriate tiers
UPDATE public.crypto_tokens SET volatility_tier = 'blue_chip' WHERE symbol = 'SCL';
UPDATE public.crypto_tokens SET volatility_tier = 'large' WHERE symbol = 'ASH';
UPDATE public.crypto_tokens SET volatility_tier = 'mid' WHERE symbol = 'WSP';
UPDATE public.crypto_tokens SET volatility_tier = 'micro' WHERE symbol IN ('OBL', 'RUG');

-- Seed 95 new tokens (we already have 5)
-- Blue chips (4 more = 5 total)
INSERT INTO public.crypto_tokens (symbol, name, description, current_price, volume_24h, market_cap, volatility_tier, price_history) VALUES
  ('GLD', 'GhostLedger DAO', 'Governance token for the shadow banking council.', 3200.00, 18500000, 850000000, 'blue_chip', '[{"timestamp":"2026-02-01","price":3050},{"timestamp":"2026-02-04","price":3120},{"timestamp":"2026-02-07","price":3180},{"timestamp":"2026-02-10","price":3250},{"timestamp":"2026-02-13","price":3200}]'::jsonb),
  ('VLT', 'Vault Prime', 'Backed by seized contraband reserves.', 2800.50, 12000000, 720000000, 'blue_chip', '[{"timestamp":"2026-02-01","price":2700},{"timestamp":"2026-02-04","price":2750},{"timestamp":"2026-02-07","price":2820},{"timestamp":"2026-02-10","price":2790},{"timestamp":"2026-02-13","price":2800.50}]'::jsonb),
  ('NXS', 'Nexus Core', 'Cross-tunnel settlement layer.', 4100.00, 22000000, 1100000000, 'blue_chip', '[{"timestamp":"2026-02-01","price":3900},{"timestamp":"2026-02-04","price":4000},{"timestamp":"2026-02-07","price":4050},{"timestamp":"2026-02-10","price":4080},{"timestamp":"2026-02-13","price":4100}]'::jsonb),
  ('ARK', 'ArkChain', 'Decentralized shadow archive protocol.', 1950.75, 9800000, 520000000, 'blue_chip', '[{"timestamp":"2026-02-01","price":1880},{"timestamp":"2026-02-04","price":1920},{"timestamp":"2026-02-07","price":1900},{"timestamp":"2026-02-10","price":1940},{"timestamp":"2026-02-13","price":1950.75}]'::jsonb);

-- Large caps (14 more = 15 total)
INSERT INTO public.crypto_tokens (symbol, name, description, current_price, volume_24h, market_cap, volatility_tier, price_history) VALUES
  ('DRK', 'DarkPulse', 'Encrypted heartbeat of the courier network.', 245.30, 4200000, 180000000, 'large', '[{"timestamp":"2026-02-01","price":230},{"timestamp":"2026-02-07","price":240},{"timestamp":"2026-02-13","price":245.30}]'::jsonb),
  ('CRY', 'CryptoVeil', 'Privacy-first messaging credits.', 189.90, 3100000, 145000000, 'large', '[{"timestamp":"2026-02-01","price":195},{"timestamp":"2026-02-07","price":192},{"timestamp":"2026-02-13","price":189.90}]'::jsonb),
  ('PHN', 'Phantom Net', 'Untraceable routing token.', 312.40, 5500000, 220000000, 'large', '[{"timestamp":"2026-02-01","price":298},{"timestamp":"2026-02-07","price":305},{"timestamp":"2026-02-13","price":312.40}]'::jsonb),
  ('SHD', 'ShadowSync', 'Real-time ledger synchronization.', 156.80, 2800000, 120000000, 'large', '[{"timestamp":"2026-02-01","price":160},{"timestamp":"2026-02-07","price":158},{"timestamp":"2026-02-13","price":156.80}]'::jsonb),
  ('BLK', 'BlackNode', 'Infrastructure backbone token.', 420.00, 6200000, 310000000, 'large', '[{"timestamp":"2026-02-01","price":410},{"timestamp":"2026-02-07","price":415},{"timestamp":"2026-02-13","price":420}]'::jsonb),
  ('FRG', 'Forge Token', 'Minting rights for counterfeit-proof IDs.', 88.50, 1900000, 68000000, 'large', '[{"timestamp":"2026-02-01","price":82},{"timestamp":"2026-02-07","price":85},{"timestamp":"2026-02-13","price":88.50}]'::jsonb),
  ('ECH', 'Echo Shares', 'Revenue splits from underground venues.', 134.20, 2400000, 95000000, 'large', '[{"timestamp":"2026-02-01","price":128},{"timestamp":"2026-02-07","price":131},{"timestamp":"2026-02-13","price":134.20}]'::jsonb),
  ('NIT', 'NiteMarket', 'After-hours exchange token.', 201.00, 3500000, 155000000, 'large', '[{"timestamp":"2026-02-01","price":195},{"timestamp":"2026-02-07","price":198},{"timestamp":"2026-02-13","price":201}]'::jsonb),
  ('TMB', 'Tomb Protocol', 'Dead-drop transaction finality.', 178.60, 2900000, 130000000, 'large', '[{"timestamp":"2026-02-01","price":170},{"timestamp":"2026-02-07","price":175},{"timestamp":"2026-02-13","price":178.60}]'::jsonb),
  ('GRT', 'Grit Exchange', 'Street-level barter standard.', 95.40, 2100000, 72000000, 'large', '[{"timestamp":"2026-02-01","price":90},{"timestamp":"2026-02-07","price":93},{"timestamp":"2026-02-13","price":95.40}]'::jsonb),
  ('HZN', 'Horizon Dark', 'Long-term shadow savings instrument.', 267.80, 4800000, 195000000, 'large', '[{"timestamp":"2026-02-01","price":255},{"timestamp":"2026-02-07","price":260},{"timestamp":"2026-02-13","price":267.80}]'::jsonb),
  ('RVN', 'Raven Ledger', 'Messenger-backed transaction protocol.', 143.50, 2600000, 105000000, 'large', '[{"timestamp":"2026-02-01","price":138},{"timestamp":"2026-02-07","price":140},{"timestamp":"2026-02-13","price":143.50}]'::jsonb),
  ('SPK', 'Spark Wire', 'Instant micro-payment rails.', 110.25, 2200000, 82000000, 'large', '[{"timestamp":"2026-02-01","price":105},{"timestamp":"2026-02-07","price":108},{"timestamp":"2026-02-13","price":110.25}]'::jsonb),
  ('CND', 'Conduit Pay', 'Tunnel-toll settlement layer.', 78.90, 1700000, 58000000, 'large', '[{"timestamp":"2026-02-01","price":75},{"timestamp":"2026-02-07","price":77},{"timestamp":"2026-02-13","price":78.90}]'::jsonb);

-- Mid caps (29 more = 30 total with WSP)
INSERT INTO public.crypto_tokens (symbol, name, description, current_price, volume_24h, market_cap, volatility_tier, price_history) VALUES
  ('DGR', 'Dagger Coin', 'Fast-strike arbitrage token.', 12.45, 890000, 8500000, 'mid', '[{"timestamp":"2026-02-01","price":11.20},{"timestamp":"2026-02-07","price":12.00},{"timestamp":"2026-02-13","price":12.45}]'::jsonb),
  ('MSK', 'Mask Protocol', 'Identity obfuscation credits.', 8.90, 620000, 5200000, 'mid', '[{"timestamp":"2026-02-01","price":9.50},{"timestamp":"2026-02-07","price":9.10},{"timestamp":"2026-02-13","price":8.90}]'::jsonb),
  ('VPR', 'Viper Swap', 'Cross-chain DEX governance.', 15.60, 1100000, 12000000, 'mid', '[{"timestamp":"2026-02-01","price":14.20},{"timestamp":"2026-02-07","price":15.00},{"timestamp":"2026-02-13","price":15.60}]'::jsonb),
  ('SLK', 'Silk Route', 'Trade corridor pass token.', 22.30, 1500000, 18000000, 'mid', '[{"timestamp":"2026-02-01","price":20.50},{"timestamp":"2026-02-07","price":21.80},{"timestamp":"2026-02-13","price":22.30}]'::jsonb),
  ('RZR', 'Razor Edge', 'High-frequency arbitrage fuel.', 6.75, 480000, 3800000, 'mid', '[{"timestamp":"2026-02-01","price":7.10},{"timestamp":"2026-02-07","price":6.90},{"timestamp":"2026-02-13","price":6.75}]'::jsonb),
  ('GLM', 'Gloom Cash', 'Catacomb vendor standard.', 18.40, 1200000, 14000000, 'mid', '[{"timestamp":"2026-02-01","price":17.00},{"timestamp":"2026-02-07","price":17.80},{"timestamp":"2026-02-13","price":18.40}]'::jsonb),
  ('BNE', 'Bone Token', 'Loyalty rewards from fight pits.', 4.55, 340000, 2600000, 'mid', '[{"timestamp":"2026-02-01","price":4.80},{"timestamp":"2026-02-07","price":4.60},{"timestamp":"2026-02-13","price":4.55}]'::jsonb),
  ('CRW', 'Crow Feather', 'Messenger tip credits.', 9.20, 670000, 5800000, 'mid', '[{"timestamp":"2026-02-01","price":8.60},{"timestamp":"2026-02-07","price":9.00},{"timestamp":"2026-02-13","price":9.20}]'::jsonb),
  ('INK', 'Inkwell', 'Contract signing stake token.', 31.80, 2100000, 24000000, 'mid', '[{"timestamp":"2026-02-01","price":29.50},{"timestamp":"2026-02-07","price":30.80},{"timestamp":"2026-02-13","price":31.80}]'::jsonb),
  ('WRK', 'Wraith Key', 'Access passes to private channels.', 14.70, 980000, 10000000, 'mid', '[{"timestamp":"2026-02-01","price":15.20},{"timestamp":"2026-02-07","price":14.90},{"timestamp":"2026-02-13","price":14.70}]'::jsonb),
  ('HLW', 'Hollow Mark', 'Debt tracking instrument.', 7.85, 540000, 4400000, 'mid', '[{"timestamp":"2026-02-01","price":8.20},{"timestamp":"2026-02-07","price":7.90},{"timestamp":"2026-02-13","price":7.85}]'::jsonb),
  ('SMK', 'Smoke Signal', 'Broadcast priority rights.', 25.60, 1800000, 20000000, 'mid', '[{"timestamp":"2026-02-01","price":24.00},{"timestamp":"2026-02-07","price":25.10},{"timestamp":"2026-02-13","price":25.60}]'::jsonb),
  ('CLK', 'Cloak Coin', 'Surveillance evasion fuel.', 11.30, 780000, 7200000, 'mid', '[{"timestamp":"2026-02-01","price":10.50},{"timestamp":"2026-02-07","price":11.00},{"timestamp":"2026-02-13","price":11.30}]'::jsonb),
  ('FNG', 'Fang Credit', 'Enforcer service vouchers.', 19.90, 1300000, 15000000, 'mid', '[{"timestamp":"2026-02-01","price":18.50},{"timestamp":"2026-02-07","price":19.20},{"timestamp":"2026-02-13","price":19.90}]'::jsonb),
  ('TXN', 'Toxin Yield', 'Hazardous goods insurance token.', 3.40, 250000, 1800000, 'mid', '[{"timestamp":"2026-02-01","price":3.80},{"timestamp":"2026-02-07","price":3.50},{"timestamp":"2026-02-13","price":3.40}]'::jsonb),
  ('NVL', 'Navel Stone', 'Alchemy ingredient exchange.', 28.70, 1900000, 22000000, 'mid', '[{"timestamp":"2026-02-01","price":27.00},{"timestamp":"2026-02-07","price":28.20},{"timestamp":"2026-02-13","price":28.70}]'::jsonb),
  ('SRG', 'Surge Token', 'Power grid black-market credits.', 5.15, 380000, 2900000, 'mid', '[{"timestamp":"2026-02-01","price":5.50},{"timestamp":"2026-02-07","price":5.30},{"timestamp":"2026-02-13","price":5.15}]'::jsonb),
  ('RPT', 'Riptide', 'Underground canal transport.', 16.80, 1100000, 12500000, 'mid', '[{"timestamp":"2026-02-01","price":15.90},{"timestamp":"2026-02-07","price":16.40},{"timestamp":"2026-02-13","price":16.80}]'::jsonb),
  ('DWN', 'Dawn Break', 'Early-access market intel.', 35.20, 2400000, 28000000, 'mid', '[{"timestamp":"2026-02-01","price":33.00},{"timestamp":"2026-02-07","price":34.50},{"timestamp":"2026-02-13","price":35.20}]'::jsonb),
  ('MRK', 'MurkPool', 'Liquidity aggregator.', 21.40, 1400000, 16000000, 'mid', '[{"timestamp":"2026-02-01","price":20.00},{"timestamp":"2026-02-07","price":20.80},{"timestamp":"2026-02-13","price":21.40}]'::jsonb),
  ('PSN', 'Poison Pill', 'Hostile takeover defense token.', 13.60, 920000, 9200000, 'mid', '[{"timestamp":"2026-02-01","price":14.10},{"timestamp":"2026-02-07","price":13.80},{"timestamp":"2026-02-13","price":13.60}]'::jsonb),
  ('CRS', 'Crossbone', 'Pirate radio frequency token.', 8.45, 600000, 4800000, 'mid', '[{"timestamp":"2026-02-01","price":7.90},{"timestamp":"2026-02-07","price":8.20},{"timestamp":"2026-02-13","price":8.45}]'::jsonb),
  ('VNM', 'Venom Drip', 'Slow-release yield farming.', 10.70, 750000, 6500000, 'mid', '[{"timestamp":"2026-02-01","price":11.20},{"timestamp":"2026-02-07","price":10.90},{"timestamp":"2026-02-13","price":10.70}]'::jsonb),
  ('DZL', 'Dazzle Flare', 'Distraction-based exit liquidity.', 26.90, 1700000, 21000000, 'mid', '[{"timestamp":"2026-02-01","price":25.50},{"timestamp":"2026-02-07","price":26.30},{"timestamp":"2026-02-13","price":26.90}]'::jsonb),
  ('THN', 'Thorn Wire', 'Perimeter defense credits.', 6.20, 430000, 3400000, 'mid', '[{"timestamp":"2026-02-01","price":6.60},{"timestamp":"2026-02-07","price":6.30},{"timestamp":"2026-02-13","price":6.20}]'::jsonb),
  ('GRV', 'Grave Marker', 'Memorial staking token.', 17.50, 1150000, 13000000, 'mid', '[{"timestamp":"2026-02-01","price":16.80},{"timestamp":"2026-02-07","price":17.10},{"timestamp":"2026-02-13","price":17.50}]'::jsonb),
  ('NTX', 'Nightshade TX', 'Toxic asset clearinghouse.', 4.80, 350000, 2700000, 'mid', '[{"timestamp":"2026-02-01","price":5.10},{"timestamp":"2026-02-07","price":4.90},{"timestamp":"2026-02-13","price":4.80}]'::jsonb),
  ('RFL', 'Riffle Chain', 'Card-shuffle randomized routing.', 23.10, 1600000, 17500000, 'mid', '[{"timestamp":"2026-02-01","price":21.80},{"timestamp":"2026-02-07","price":22.50},{"timestamp":"2026-02-13","price":23.10}]'::jsonb),
  ('BRN', 'Burnout', 'Self-destructing transaction token.', 9.60, 680000, 5500000, 'mid', '[{"timestamp":"2026-02-01","price":10.10},{"timestamp":"2026-02-07","price":9.80},{"timestamp":"2026-02-13","price":9.60}]'::jsonb);

-- Micro caps (48 more = 50 total with OBL, RUG)
INSERT INTO public.crypto_tokens (symbol, name, description, current_price, volume_24h, market_cap, volatility_tier, price_history) VALUES
  ('DMP', 'Dump Coin', 'The token nobody asked for.', 0.003, 12000, 15000, 'micro', '[{"timestamp":"2026-02-01","price":0.005},{"timestamp":"2026-02-07","price":0.004},{"timestamp":"2026-02-13","price":0.003}]'::jsonb),
  ('SCM', 'ScamShield', 'Ironically named protection token.', 0.012, 28000, 45000, 'micro', '[{"timestamp":"2026-02-01","price":0.015},{"timestamp":"2026-02-07","price":0.013},{"timestamp":"2026-02-13","price":0.012}]'::jsonb),
  ('YOL', 'YOLO Token', 'For degens who dont read whitepapers.', 0.08, 95000, 180000, 'micro', '[{"timestamp":"2026-02-01","price":0.06},{"timestamp":"2026-02-07","price":0.07},{"timestamp":"2026-02-13","price":0.08}]'::jsonb),
  ('APE', 'Ape Signal', 'Buy first, research never.', 0.15, 120000, 280000, 'micro', '[{"timestamp":"2026-02-01","price":0.12},{"timestamp":"2026-02-07","price":0.14},{"timestamp":"2026-02-13","price":0.15}]'::jsonb),
  ('RAT', 'Rat Run', 'Sewer-level liquidity token.', 0.002, 8000, 9000, 'micro', '[{"timestamp":"2026-02-01","price":0.003},{"timestamp":"2026-02-07","price":0.0025},{"timestamp":"2026-02-13","price":0.002}]'::jsonb),
  ('MUD', 'MudFlat', 'Bottom-feeder exchange token.', 0.045, 55000, 95000, 'micro', '[{"timestamp":"2026-02-01","price":0.05},{"timestamp":"2026-02-07","price":0.048},{"timestamp":"2026-02-13","price":0.045}]'::jsonb),
  ('GAS', 'GasLight', 'Makes you question reality.', 0.22, 180000, 420000, 'micro', '[{"timestamp":"2026-02-01","price":0.18},{"timestamp":"2026-02-07","price":0.20},{"timestamp":"2026-02-13","price":0.22}]'::jsonb),
  ('ZAP', 'Zap Wire', 'Shock-value meme token.', 0.067, 78000, 140000, 'micro', '[{"timestamp":"2026-02-01","price":0.08},{"timestamp":"2026-02-07","price":0.072},{"timestamp":"2026-02-13","price":0.067}]'::jsonb),
  ('BUG', 'Bug Bounty', 'Exploits-as-a-service.', 0.34, 250000, 650000, 'micro', '[{"timestamp":"2026-02-01","price":0.28},{"timestamp":"2026-02-07","price":0.31},{"timestamp":"2026-02-13","price":0.34}]'::jsonb),
  ('HCK', 'HackCoin', 'White-hat reward system.', 0.51, 320000, 880000, 'micro', '[{"timestamp":"2026-02-01","price":0.45},{"timestamp":"2026-02-07","price":0.48},{"timestamp":"2026-02-13","price":0.51}]'::jsonb),
  ('FKE', 'FakeDollar', 'Not real money. Probably.', 0.009, 18000, 32000, 'micro', '[{"timestamp":"2026-02-01","price":0.011},{"timestamp":"2026-02-07","price":0.010},{"timestamp":"2026-02-13","price":0.009}]'::jsonb),
  ('GRB', 'Grab Bag', 'Random airdrop allocations.', 0.13, 105000, 240000, 'micro', '[{"timestamp":"2026-02-01","price":0.11},{"timestamp":"2026-02-07","price":0.12},{"timestamp":"2026-02-13","price":0.13}]'::jsonb),
  ('SWP', 'Swipe Left', 'Dating app utility token.', 0.075, 88000, 160000, 'micro', '[{"timestamp":"2026-02-01","price":0.085},{"timestamp":"2026-02-07","price":0.08},{"timestamp":"2026-02-13","price":0.075}]'::jsonb),
  ('FZZ', 'Fizz Pop', 'Carbonated governance.', 0.19, 150000, 350000, 'micro', '[{"timestamp":"2026-02-01","price":0.16},{"timestamp":"2026-02-07","price":0.17},{"timestamp":"2026-02-13","price":0.19}]'::jsonb),
  ('DRG', 'Drag Race', 'Speed-focused meme token.', 0.42, 280000, 720000, 'micro', '[{"timestamp":"2026-02-01","price":0.35},{"timestamp":"2026-02-07","price":0.38},{"timestamp":"2026-02-13","price":0.42}]'::jsonb),
  ('PKT', 'Pocket Lint', 'Worthless but persistent.', 0.001, 5000, 4000, 'micro', '[{"timestamp":"2026-02-01","price":0.002},{"timestamp":"2026-02-07","price":0.0015},{"timestamp":"2026-02-13","price":0.001}]'::jsonb),
  ('WRM', 'Worm Hole', 'Teleportation vouchers.', 0.28, 210000, 520000, 'micro', '[{"timestamp":"2026-02-01","price":0.24},{"timestamp":"2026-02-07","price":0.26},{"timestamp":"2026-02-13","price":0.28}]'::jsonb),
  ('SLG', 'Slug Trail', 'Slow but steady yield.', 0.006, 14000, 22000, 'micro', '[{"timestamp":"2026-02-01","price":0.008},{"timestamp":"2026-02-07","price":0.007},{"timestamp":"2026-02-13","price":0.006}]'::jsonb),
  ('TNT', 'TinyNut', 'Micro-cap of micro-caps.', 0.035, 42000, 75000, 'micro', '[{"timestamp":"2026-02-01","price":0.04},{"timestamp":"2026-02-07","price":0.037},{"timestamp":"2026-02-13","price":0.035}]'::jsonb),
  ('FLM', 'Flame Out', 'Burns bright, dies fast.', 0.55, 350000, 950000, 'micro', '[{"timestamp":"2026-02-01","price":0.42},{"timestamp":"2026-02-07","price":0.48},{"timestamp":"2026-02-13","price":0.55}]'::jsonb),
  ('CHP', 'Cheap Shot', 'Bargain-basement token.', 0.018, 32000, 55000, 'micro', '[{"timestamp":"2026-02-01","price":0.022},{"timestamp":"2026-02-07","price":0.020},{"timestamp":"2026-02-13","price":0.018}]'::jsonb),
  ('GLT', 'Glitch', 'Feature, not a bug.', 0.095, 98000, 190000, 'micro', '[{"timestamp":"2026-02-01","price":0.08},{"timestamp":"2026-02-07","price":0.09},{"timestamp":"2026-02-13","price":0.095}]'::jsonb),
  ('VXN', 'Vixen Coin', 'Alluring but dangerous.', 0.38, 260000, 680000, 'micro', '[{"timestamp":"2026-02-01","price":0.32},{"timestamp":"2026-02-07","price":0.35},{"timestamp":"2026-02-13","price":0.38}]'::jsonb),
  ('PZL', 'Puzzle Piece', 'Collect all 1000 for a prize.', 0.007, 16000, 28000, 'micro', '[{"timestamp":"2026-02-01","price":0.009},{"timestamp":"2026-02-07","price":0.008},{"timestamp":"2026-02-13","price":0.007}]'::jsonb),
  ('LST', 'Lost Cause', 'Already dead, still trading.', 0.004, 10000, 12000, 'micro', '[{"timestamp":"2026-02-01","price":0.006},{"timestamp":"2026-02-07","price":0.005},{"timestamp":"2026-02-13","price":0.004}]'::jsonb),
  ('NKD', 'Naked Short', 'Extremely risky derivative.', 0.62, 400000, 1100000, 'micro', '[{"timestamp":"2026-02-01","price":0.50},{"timestamp":"2026-02-07","price":0.55},{"timestamp":"2026-02-13","price":0.62}]'::jsonb),
  ('BLD', 'Bleed Out', 'Perpetual loss token.', 0.025, 38000, 65000, 'micro', '[{"timestamp":"2026-02-01","price":0.032},{"timestamp":"2026-02-07","price":0.028},{"timestamp":"2026-02-13","price":0.025}]'::jsonb),
  ('CRK', 'Crack Shot', 'Precision trading meme.', 0.17, 135000, 310000, 'micro', '[{"timestamp":"2026-02-01","price":0.14},{"timestamp":"2026-02-07","price":0.16},{"timestamp":"2026-02-13","price":0.17}]'::jsonb),
  ('RBT', 'Rabbit Hole', 'Goes deeper than you think.', 0.44, 290000, 760000, 'micro', '[{"timestamp":"2026-02-01","price":0.38},{"timestamp":"2026-02-07","price":0.41},{"timestamp":"2026-02-13","price":0.44}]'::jsonb),
  ('SNK', 'Snake Oil', 'Promises everything, delivers nothing.', 0.011, 24000, 40000, 'micro', '[{"timestamp":"2026-02-01","price":0.014},{"timestamp":"2026-02-07","price":0.012},{"timestamp":"2026-02-13","price":0.011}]'::jsonb),
  ('BBS', 'Bubble Burst', 'Always about to pop.', 0.085, 92000, 175000, 'micro', '[{"timestamp":"2026-02-01","price":0.07},{"timestamp":"2026-02-07","price":0.08},{"timestamp":"2026-02-13","price":0.085}]'::jsonb),
  ('RCK', 'Rock Bottom', 'Cant go any lower. Right?', 0.0015, 6000, 6000, 'micro', '[{"timestamp":"2026-02-01","price":0.003},{"timestamp":"2026-02-07","price":0.002},{"timestamp":"2026-02-13","price":0.0015}]'::jsonb),
  ('FLY', 'Fly By Night', 'Here today, gone tomorrow.', 0.31, 230000, 580000, 'micro', '[{"timestamp":"2026-02-01","price":0.26},{"timestamp":"2026-02-07","price":0.29},{"timestamp":"2026-02-13","price":0.31}]'::jsonb),
  ('CLD', 'Cold Storage', 'Frozen asset wrapper.', 0.14, 110000, 260000, 'micro', '[{"timestamp":"2026-02-01","price":0.12},{"timestamp":"2026-02-07","price":0.13},{"timestamp":"2026-02-13","price":0.14}]'::jsonb),
  ('JNK', 'Junk Bond', 'High yield, higher risk.', 0.48, 310000, 830000, 'micro', '[{"timestamp":"2026-02-01","price":0.40},{"timestamp":"2026-02-07","price":0.44},{"timestamp":"2026-02-13","price":0.48}]'::jsonb),
  ('DRL', 'Drill Down', 'Mining-focused speculation.', 0.058, 68000, 125000, 'micro', '[{"timestamp":"2026-02-01","price":0.065},{"timestamp":"2026-02-07","price":0.062},{"timestamp":"2026-02-13","price":0.058}]'::jsonb),
  ('RST', 'Rust Bucket', 'Decaying infrastructure token.', 0.008, 17000, 30000, 'micro', '[{"timestamp":"2026-02-01","price":0.010},{"timestamp":"2026-02-07","price":0.009},{"timestamp":"2026-02-13","price":0.008}]'::jsonb),
  ('PMP', 'Pump Action', 'Buy the rumor.', 0.72, 450000, 1300000, 'micro', '[{"timestamp":"2026-02-01","price":0.58},{"timestamp":"2026-02-07","price":0.65},{"timestamp":"2026-02-13","price":0.72}]'::jsonb),
  ('TWL', 'Towel Throw', 'For when you give up.', 0.021, 34000, 60000, 'micro', '[{"timestamp":"2026-02-01","price":0.026},{"timestamp":"2026-02-07","price":0.023},{"timestamp":"2026-02-13","price":0.021}]'::jsonb),
  ('GRN', 'Grin Token', 'Smiling through the pain.', 0.16, 125000, 290000, 'micro', '[{"timestamp":"2026-02-01","price":0.13},{"timestamp":"2026-02-07","price":0.15},{"timestamp":"2026-02-13","price":0.16}]'::jsonb),
  ('BZZ', 'Buzz Kill', 'Deflation-focused meme.', 0.037, 45000, 80000, 'micro', '[{"timestamp":"2026-02-01","price":0.042},{"timestamp":"2026-02-07","price":0.039},{"timestamp":"2026-02-13","price":0.037}]'::jsonb),
  ('SHK', 'Shark Fin', 'Predatory lending token.', 0.89, 520000, 1500000, 'micro', '[{"timestamp":"2026-02-01","price":0.72},{"timestamp":"2026-02-07","price":0.80},{"timestamp":"2026-02-13","price":0.89}]'::jsonb),
  ('DMN', 'Demon Seed', 'Cursed yield farming.', 0.24, 185000, 440000, 'micro', '[{"timestamp":"2026-02-01","price":0.20},{"timestamp":"2026-02-07","price":0.22},{"timestamp":"2026-02-13","price":0.24}]'::jsonb),
  ('FRZ', 'Freeze Tag', 'Locked liquidity meme.', 0.052, 62000, 110000, 'micro', '[{"timestamp":"2026-02-01","price":0.06},{"timestamp":"2026-02-07","price":0.055},{"timestamp":"2026-02-13","price":0.052}]'::jsonb),
  ('WLD', 'Wild Card', 'Random outcome token.', 0.33, 240000, 620000, 'micro', '[{"timestamp":"2026-02-01","price":0.28},{"timestamp":"2026-02-07","price":0.30},{"timestamp":"2026-02-13","price":0.33}]'::jsonb),
  ('PLG', 'Plague Rat', 'Spreads through wallets.', 0.005, 11000, 18000, 'micro', '[{"timestamp":"2026-02-01","price":0.007},{"timestamp":"2026-02-07","price":0.006},{"timestamp":"2026-02-13","price":0.005}]'::jsonb),
  ('HXD', 'Hexed', 'Probably cursed.', 0.41, 275000, 700000, 'micro', '[{"timestamp":"2026-02-01","price":0.34},{"timestamp":"2026-02-07","price":0.37},{"timestamp":"2026-02-13","price":0.41}]'::jsonb),
  ('TRP', 'Trap Door', 'Hidden exit scam potential.', 0.14, 108000, 250000, 'micro', '[{"timestamp":"2026-02-01","price":0.12},{"timestamp":"2026-02-07","price":0.13},{"timestamp":"2026-02-13","price":0.14}]'::jsonb);
