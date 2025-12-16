-- Expand player_avatar_config with detailed body and face customization fields

-- Body customization fields
ALTER TABLE player_avatar_config
ADD COLUMN IF NOT EXISTS weight REAL DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS muscle_definition REAL DEFAULT 0.5,
ADD COLUMN IF NOT EXISTS shoulder_width REAL DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS hip_width REAL DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS torso_length REAL DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS arm_length REAL DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS leg_length REAL DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS age_appearance VARCHAR DEFAULT 'adult';

-- Face structure fields
ALTER TABLE player_avatar_config
ADD COLUMN IF NOT EXISTS face_width REAL DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS face_length REAL DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS jaw_shape VARCHAR DEFAULT 'round',
ADD COLUMN IF NOT EXISTS cheekbone REAL DEFAULT 0.5,
ADD COLUMN IF NOT EXISTS chin_prominence REAL DEFAULT 0.5;

-- Eye customization fields
ALTER TABLE player_avatar_config
ADD COLUMN IF NOT EXISTS eye_color VARCHAR DEFAULT '#2d1a0a',
ADD COLUMN IF NOT EXISTS eye_size REAL DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS eye_spacing REAL DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS eye_tilt REAL DEFAULT 0.0;

-- Eyebrow fields
ALTER TABLE player_avatar_config
ADD COLUMN IF NOT EXISTS eyebrow_style VARCHAR DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS eyebrow_color VARCHAR DEFAULT '#1a1a1a',
ADD COLUMN IF NOT EXISTS eyebrow_thickness REAL DEFAULT 1.0;

-- Nose fields
ALTER TABLE player_avatar_config
ADD COLUMN IF NOT EXISTS nose_width REAL DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS nose_length REAL DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS nose_bridge REAL DEFAULT 0.5;

-- Mouth/Lip fields
ALTER TABLE player_avatar_config
ADD COLUMN IF NOT EXISTS lip_fullness REAL DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS lip_width REAL DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS lip_color VARCHAR DEFAULT '#c4777f';

-- Ear fields
ALTER TABLE player_avatar_config
ADD COLUMN IF NOT EXISTS ear_size REAL DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS ear_angle REAL DEFAULT 0.0;