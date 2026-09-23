export type AvatarVisualQuality = 'crowd' | 'balanced' | 'high' | 'ultra';

export interface AvatarVisualQualityProfile {
  textureSize: 0 | 256 | 512 | 1024;
  hairSphereSegments: number;
  hairSphereRings: number;
  faceCurveSegments: number;
  accessorySegments: number;
  previewPixelRatioCap: number;
  shadowMapSize: number;
  anisotropy: number;
}

const PROFILES: Record<AvatarVisualQuality, AvatarVisualQualityProfile> = {
  crowd: {
    textureSize: 0,
    hairSphereSegments: 8,
    hairSphereRings: 6,
    faceCurveSegments: 6,
    accessorySegments: 8,
    previewPixelRatioCap: 1,
    shadowMapSize: 512,
    anisotropy: 1,
  },
  balanced: {
    textureSize: 256,
    hairSphereSegments: 16,
    hairSphereRings: 10,
    faceCurveSegments: 10,
    accessorySegments: 12,
    previewPixelRatioCap: 1.5,
    shadowMapSize: 1024,
    anisotropy: 4,
  },
  high: {
    textureSize: 512,
    hairSphereSegments: 24,
    hairSphereRings: 14,
    faceCurveSegments: 16,
    accessorySegments: 18,
    previewPixelRatioCap: 2,
    shadowMapSize: 2048,
    anisotropy: 8,
  },
  ultra: {
    textureSize: 1024,
    hairSphereSegments: 32,
    hairSphereRings: 18,
    faceCurveSegments: 24,
    accessorySegments: 24,
    previewPixelRatioCap: 2.5,
    shadowMapSize: 4096,
    anisotropy: 16,
  },
};

export function avatarQualityProfile(quality: AvatarVisualQuality) {
  return PROFILES[quality];
}

export function recommendedAvatarPreviewQuality(): AvatarVisualQuality {
  if (typeof window === 'undefined') return 'high';
  const cores = navigator.hardwareConcurrency || 4;
  const pixelRatio = window.devicePixelRatio || 1;
  const width = Math.max(window.innerWidth, window.innerHeight);
  if (cores >= 8 && pixelRatio >= 1.5 && width >= 900) return 'ultra';
  if (cores >= 6 && width >= 700) return 'high';
  return 'balanced';
}
