// Ready Player Me avatar URLs for gig viewer
// Verified working public demo avatars

// Verified working demo avatars (publicly accessible)
export const RPM_DEMO_AVATARS = [
  "https://models.readyplayer.me/62ea7bc28a6d28ec134bbcce.glb",
  "https://api.readyplayer.me/v1/avatars/638df693d72bffc6fa17943c.glb",
];

// Band member avatars - using verified demo avatar with variations
export const RPM_BAND_AVATARS = [
  "https://models.readyplayer.me/62ea7bc28a6d28ec134bbcce.glb", // Vocalist
  "https://models.readyplayer.me/62ea7bc28a6d28ec134bbcce.glb", // Guitarist
  "https://models.readyplayer.me/62ea7bc28a6d28ec134bbcce.glb", // Bassist
  "https://models.readyplayer.me/62ea7bc28a6d28ec134bbcce.glb", // Drummer
  "https://models.readyplayer.me/62ea7bc28a6d28ec134bbcce.glb", // Keyboardist
];

// Crowd avatars - using verified demo avatar
export const RPM_CROWD_AVATARS = [
  "https://models.readyplayer.me/62ea7bc28a6d28ec134bbcce.glb",
  "https://models.readyplayer.me/62ea7bc28a6d28ec134bbcce.glb",
  "https://models.readyplayer.me/62ea7bc28a6d28ec134bbcce.glb",
  "https://models.readyplayer.me/62ea7bc28a6d28ec134bbcce.glb",
  "https://models.readyplayer.me/62ea7bc28a6d28ec134bbcce.glb",
  "https://models.readyplayer.me/62ea7bc28a6d28ec134bbcce.glb",
];

// Primary demo avatar URL
export const RPM_DEMO_AVATAR = RPM_DEMO_AVATARS[0];

// Legacy pool for backwards compatibility
export const RPM_AVATAR_POOL = [...RPM_BAND_AVATARS, ...RPM_CROWD_AVATARS];

// Get a random avatar from the pool using a seed for determinism
export const getPooledAvatar = (seed: number): string => {
  const index = Math.floor((seed * 1000) % RPM_AVATAR_POOL.length);
  return RPM_AVATAR_POOL[index];
};

// Get band avatar by role index
export const getBandAvatar = (roleIndex: number): string => {
  return RPM_BAND_AVATARS[roleIndex % RPM_BAND_AVATARS.length];
};

// Get crowd avatar by index
export const getCrowdAvatar = (index: number): string => {
  return RPM_CROWD_AVATARS[index % RPM_CROWD_AVATARS.length];
};
