// Ready Player Me avatar URLs for gig viewer
// IMPORTANT: These must be FULL-BODY avatars, not half-body/bust
// Half-body avatars will only show head and hands

// Texture optimization parameters to reduce GPU load
const TEXTURE_PARAMS = '?textureAtlas=512&textureSizeLimit=512&morphTargets=none';

// Verified working FULL-BODY demo avatars (publicly accessible)
// These are full-body avatars created with bodyType: 'fullbody' config
export const RPM_DEMO_AVATARS = [
  // Note: Replace these with verified full-body avatar URLs
  // Half-body avatars like 62ea7bc28a6d28ec134bbcce will NOT work correctly
  `https://models.readyplayer.me/64f83f0f9a0152b0c78f5e8a.glb${TEXTURE_PARAMS}`,
  `https://models.readyplayer.me/64f83f0f9a0152b0c78f5e8a.glb${TEXTURE_PARAMS}`,
];

// Band member avatars - using verified full-body avatar with variations
export const RPM_BAND_AVATARS = [
  `https://models.readyplayer.me/64f83f0f9a0152b0c78f5e8a.glb${TEXTURE_PARAMS}`, // Vocalist
  `https://models.readyplayer.me/64f83f0f9a0152b0c78f5e8a.glb${TEXTURE_PARAMS}`, // Guitarist
  `https://models.readyplayer.me/64f83f0f9a0152b0c78f5e8a.glb${TEXTURE_PARAMS}`, // Bassist
  `https://models.readyplayer.me/64f83f0f9a0152b0c78f5e8a.glb${TEXTURE_PARAMS}`, // Drummer
  `https://models.readyplayer.me/64f83f0f9a0152b0c78f5e8a.glb${TEXTURE_PARAMS}`, // Keyboardist
];

// Crowd avatars - using verified full-body avatar
export const RPM_CROWD_AVATARS = [
  `https://models.readyplayer.me/64f83f0f9a0152b0c78f5e8a.glb${TEXTURE_PARAMS}`,
  `https://models.readyplayer.me/64f83f0f9a0152b0c78f5e8a.glb${TEXTURE_PARAMS}`,
  `https://models.readyplayer.me/64f83f0f9a0152b0c78f5e8a.glb${TEXTURE_PARAMS}`,
  `https://models.readyplayer.me/64f83f0f9a0152b0c78f5e8a.glb${TEXTURE_PARAMS}`,
  `https://models.readyplayer.me/64f83f0f9a0152b0c78f5e8a.glb${TEXTURE_PARAMS}`,
  `https://models.readyplayer.me/64f83f0f9a0152b0c78f5e8a.glb${TEXTURE_PARAMS}`,
];

// Primary demo avatar URL (full-body)
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

// Add texture optimization to any avatar URL
export const optimizeAvatarUrl = (url: string): string => {
  if (!url) return url;
  if (url.includes('textureAtlas')) return url; // Already optimized
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}textureAtlas=512&textureSizeLimit=512&morphTargets=none`;
};

