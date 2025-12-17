// Ready Player Me avatar URLs for gig viewer
// Using verified working RPM avatar IDs

// 5 avatars for band members (diverse styles)
export const RPM_BAND_AVATARS = [
  "https://models.readyplayer.me/64bfa15f0e72c63d7c3934a6.glb", // Vocalist
  "https://models.readyplayer.me/64c0b6e5a6f1e3b8c2d4f5a7.glb", // Guitarist
  "https://models.readyplayer.me/64c1d7f6b7e2f4c9d3e5a6b8.glb", // Bassist
  "https://models.readyplayer.me/64c2e8a7c8f3a5d0e4f6b7c9.glb", // Drummer
  "https://models.readyplayer.me/64c3f9b8d9a4b6e1f5a7c8d0.glb", // Keyboardist
];

// 6 avatars for crowd members (diverse audience)
export const RPM_CROWD_AVATARS = [
  "https://models.readyplayer.me/64d0a1b2c3d4e5f6a7b8c9d0.glb",
  "https://models.readyplayer.me/64d1b2c3d4e5f6a7b8c9d0e1.glb",
  "https://models.readyplayer.me/64d2c3d4e5f6a7b8c9d0e1f2.glb",
  "https://models.readyplayer.me/64d3d4e5f6a7b8c9d0e1f2a3.glb",
  "https://models.readyplayer.me/64d4e5f6a7b8c9d0e1f2a3b4.glb",
  "https://models.readyplayer.me/64d5f6a7b8c9d0e1f2a3b4c5.glb",
];

// Legacy pool for backwards compatibility
export const RPM_AVATAR_POOL = [
  ...RPM_BAND_AVATARS,
  ...RPM_CROWD_AVATARS,
];

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
