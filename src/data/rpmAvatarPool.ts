// Ready Player Me avatar URLs for gig viewer
// Note: RPM avatars require valid avatar IDs from actual user accounts
// The demo avatar below is a publicly available sample

// Verified working demo avatar (publicly available)
export const RPM_DEMO_AVATAR = "https://models.readyplayer.me/62ea7bc28a6d28ec134bbcce.glb";

// For production, avatars come from user profiles (profiles.rpm_avatar_url)
// These arrays are placeholders - actual avatars are fetched from database
export const RPM_BAND_AVATARS: string[] = [];
export const RPM_CROWD_AVATARS: string[] = [];

// Legacy pool for backwards compatibility
export const RPM_AVATAR_POOL = [RPM_DEMO_AVATAR];

// Get a random avatar from the pool using a seed for determinism
export const getPooledAvatar = (seed: number): string => {
  if (RPM_AVATAR_POOL.length === 0) return RPM_DEMO_AVATAR;
  const index = Math.floor((seed * 1000) % RPM_AVATAR_POOL.length);
  return RPM_AVATAR_POOL[index];
};

// Get band avatar by role index - returns undefined if not available
export const getBandAvatar = (roleIndex: number): string | undefined => {
  if (RPM_BAND_AVATARS.length === 0) return undefined;
  return RPM_BAND_AVATARS[roleIndex % RPM_BAND_AVATARS.length];
};

// Get crowd avatar by index - returns undefined if not available
export const getCrowdAvatar = (index: number): string | undefined => {
  if (RPM_CROWD_AVATARS.length === 0) return undefined;
  return RPM_CROWD_AVATARS[index % RPM_CROWD_AVATARS.length];
};
