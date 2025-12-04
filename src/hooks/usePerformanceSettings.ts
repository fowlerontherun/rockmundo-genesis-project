import { useState, useEffect } from 'react';

export type PerformanceTier = 'low' | 'medium' | 'high';

export interface PerformanceSettings {
  tier: PerformanceTier;
  crowdDensity: number;
  shadows: boolean;
  postProcessing: boolean;
  maxCrowdCount: number;
}

const detectDeviceCapabilities = (): PerformanceTier => {
  if (typeof window === 'undefined') return 'medium';

  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl') as WebGLRenderingContext | null;
  
  if (!gl) return 'low';

  // Check for WebGL2 support
  const hasWebGL2 = !!document.createElement('canvas').getContext('webgl2');
  
  // Check renderer info
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = debugInfo ? (gl as any).getParameter((debugInfo as any).UNMASKED_RENDERER_WEBGL) : '';
  
  // Mobile devices or low-end GPUs
  const isMobile = /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent);
  const isLowEndGPU = /Intel.*HD|Mali|Adreno [0-4]/i.test(renderer);
  
  if (isMobile || isLowEndGPU) return 'low';
  if (!hasWebGL2) return 'medium';
  
  return 'high';
};

export const usePerformanceSettings = (): PerformanceSettings => {
  const [settings, setSettings] = useState<PerformanceSettings>(() => {
    const tier = detectDeviceCapabilities();
    return getSettingsForTier(tier);
  });

  useEffect(() => {
    // Sample FPS after a brief period to adjust tier if needed
    let frameCount = 0;
    let lastTime = performance.now();
    let rafId: number;

    const measureFPS = () => {
      frameCount++;
      const currentTime = performance.now();
      const elapsed = currentTime - lastTime;

      if (elapsed >= 1000) {
        const fps = (frameCount / elapsed) * 1000;
        frameCount = 0;
        lastTime = currentTime;

        // Adjust tier based on FPS - more aggressive downgrade
        if (fps < 20 && settings.tier !== 'low') {
          setSettings(getSettingsForTier('low'));
        } else if (fps < 35 && settings.tier === 'high') {
          setSettings(getSettingsForTier('medium'));
        }
      }

      rafId = requestAnimationFrame(measureFPS);
    };

    // Start measuring after 2 seconds
    const timeoutId = setTimeout(() => {
      rafId = requestAnimationFrame(measureFPS);
    }, 2000);

    // Stop after 5 seconds
    const stopId = setTimeout(() => {
      cancelAnimationFrame(rafId);
    }, 7000);

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(stopId);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return settings;
};

const getSettingsForTier = (tier: PerformanceTier): PerformanceSettings => {
  switch (tier) {
    case 'low':
      return {
        tier: 'low',
        crowdDensity: 0.3,
        shadows: false,
        postProcessing: false,
        maxCrowdCount: 25, // Reduced from 40
      };
    case 'medium':
      return {
        tier: 'medium',
        crowdDensity: 0.5,
        shadows: false, // Disabled shadows for medium too
        postProcessing: false,
        maxCrowdCount: 60, // Reduced from 100
      };
    case 'high':
      return {
        tier: 'high',
        crowdDensity: 0.8,
        shadows: true,
        postProcessing: false, // Disabled post-processing by default
        maxCrowdCount: 120, // Reduced from 250
      };
  }
};
