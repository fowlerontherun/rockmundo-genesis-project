// Pre-generated Ready Player Me avatar URLs for crowd diversity
// These are sample avatar URLs that can be used for crowd members
// To generate your own, visit https://readyplayer.me and create avatars

export const RPM_AVATAR_POOL = [
  // Male avatars
  "https://models.readyplayer.me/64f0a0b0f0a0b0c0d0e0f0a1.glb",
  "https://models.readyplayer.me/64f0a0b0f0a0b0c0d0e0f0a2.glb",
  "https://models.readyplayer.me/64f0a0b0f0a0b0c0d0e0f0a3.glb",
  "https://models.readyplayer.me/64f0a0b0f0a0b0c0d0e0f0a4.glb",
  "https://models.readyplayer.me/64f0a0b0f0a0b0c0d0e0f0a5.glb",
  "https://models.readyplayer.me/64f0a0b0f0a0b0c0d0e0f0a6.glb",
  "https://models.readyplayer.me/64f0a0b0f0a0b0c0d0e0f0a7.glb",
  "https://models.readyplayer.me/64f0a0b0f0a0b0c0d0e0f0a8.glb",
  "https://models.readyplayer.me/64f0a0b0f0a0b0c0d0e0f0a9.glb",
  "https://models.readyplayer.me/64f0a0b0f0a0b0c0d0e0f0b0.glb",
  // Female avatars
  "https://models.readyplayer.me/64f0a0b0f0a0b0c0d0e0f0b1.glb",
  "https://models.readyplayer.me/64f0a0b0f0a0b0c0d0e0f0b2.glb",
  "https://models.readyplayer.me/64f0a0b0f0a0b0c0d0e0f0b3.glb",
  "https://models.readyplayer.me/64f0a0b0f0a0b0c0d0e0f0b4.glb",
  "https://models.readyplayer.me/64f0a0b0f0a0b0c0d0e0f0b5.glb",
  "https://models.readyplayer.me/64f0a0b0f0a0b0c0d0e0f0b6.glb",
  "https://models.readyplayer.me/64f0a0b0f0a0b0c0d0e0f0b7.glb",
  "https://models.readyplayer.me/64f0a0b0f0a0b0c0d0e0f0b8.glb",
  "https://models.readyplayer.me/64f0a0b0f0a0b0c0d0e0f0b9.glb",
  "https://models.readyplayer.me/64f0a0b0f0a0b0c0d0e0f0c0.glb",
];

// Get a random avatar from the pool using a seed for determinism
export const getPooledAvatar = (seed: number): string => {
  const index = Math.floor((seed * 1000) % RPM_AVATAR_POOL.length);
  return RPM_AVATAR_POOL[index];
};
