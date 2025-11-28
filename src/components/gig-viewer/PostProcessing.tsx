import { EffectComposer, Bloom, ChromaticAberration, Vignette } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';

interface PostProcessingProps {
  performanceTier: 'low' | 'medium' | 'high';
  intensity?: number;
}

export const PostProcessing = ({ performanceTier, intensity = 1.0 }: PostProcessingProps) => {
  if (performanceTier === 'low') return null;

  const bloomIntensity = performanceTier === 'high' ? 1.5 * intensity : 1.0 * intensity;
  const chromaticAberrationOffset = performanceTier === 'high' ? 0.002 : 0.001;

  return (
    <EffectComposer>
      {/* Bloom for stage lights and effects */}
      <Bloom
        intensity={bloomIntensity}
        luminanceThreshold={0.3}
        luminanceSmoothing={0.9}
        mipmapBlur
      />
      
      {/* Subtle chromatic aberration for atmosphere */}
      {performanceTier === 'high' && (
        <ChromaticAberration
          blendFunction={BlendFunction.NORMAL}
          offset={[chromaticAberrationOffset, chromaticAberrationOffset]}
        />
      )}
      
      {/* Vignette for focus */}
      <Vignette
        offset={0.3}
        darkness={0.5}
        blendFunction={BlendFunction.NORMAL}
      />
    </EffectComposer>
  );
};
