import { supabase } from "@/integrations/supabase/client";

export interface CrowdSound {
  id: string;
  name: string;
  sound_type: string;
  audio_url: string;
  duration_seconds: number | null;
  intensity_level: number;
  is_active: boolean;
}

export class CrowdSoundMixer {
  private sounds: Map<string, CrowdSound[]> = new Map();
  private activeAudio: Map<string, HTMLAudioElement> = new Map();
  private mainVolume: number = 0.3;
  private isMuted: boolean = false;

  async loadSounds(): Promise<void> {
    const { data, error } = await supabase
      .from('gig_crowd_sounds')
      .select('*')
      .eq('is_active', true);

    if (error || !data) {
      console.error('Failed to load crowd sounds:', error);
      return;
    }

    // Group sounds by type
    this.sounds.clear();
    for (const sound of data as CrowdSound[]) {
      const existing = this.sounds.get(sound.sound_type) || [];
      existing.push(sound);
      this.sounds.set(sound.sound_type, existing);
    }

    console.log(`[CrowdSoundMixer] Loaded ${data.length} sounds across ${this.sounds.size} types`);
  }

  setVolume(volume: number): void {
    this.mainVolume = Math.max(0, Math.min(1, volume));
    // Update all active audio elements
    this.activeAudio.forEach((audio) => {
      audio.volume = this.isMuted ? 0 : this.mainVolume;
    });
  }

  setMuted(muted: boolean): void {
    this.isMuted = muted;
    this.activeAudio.forEach((audio) => {
      audio.volume = muted ? 0 : this.mainVolume;
    });
  }

  /**
   * Play a random sound of the given type
   * @param soundType The type of sound to play
   * @param volumeMultiplier Optional multiplier for this specific sound (0-1)
   * @returns The audio element if successful, null otherwise
   */
  playSound(soundType: string, volumeMultiplier: number = 1): HTMLAudioElement | null {
    const soundsOfType = this.sounds.get(soundType);
    if (!soundsOfType || soundsOfType.length === 0) {
      console.log(`[CrowdSoundMixer] No sounds available for type: ${soundType}`);
      return null;
    }

    // Pick a random sound of this type
    const sound = soundsOfType[Math.floor(Math.random() * soundsOfType.length)];
    
    const audio = new Audio(sound.audio_url);
    audio.volume = this.isMuted ? 0 : this.mainVolume * volumeMultiplier;
    
    const playId = `${soundType}-${Date.now()}`;
    this.activeAudio.set(playId, audio);
    
    audio.onended = () => {
      this.activeAudio.delete(playId);
    };
    
    audio.onerror = (e) => {
      console.error(`[CrowdSoundMixer] Error playing ${soundType}:`, e);
      this.activeAudio.delete(playId);
    };
    
    audio.play().catch(console.error);
    console.log(`[CrowdSoundMixer] Playing: ${sound.name} (${soundType})`);
    
    return audio;
  }

  /**
   * Play a sound matching the crowd response level
   * @param crowdResponse The crowd response (ecstatic, enthusiastic, engaged, mixed, disappointed)
   */
  playCrowdReaction(crowdResponse: string): HTMLAudioElement | null {
    const typeMap: Record<string, string> = {
      ecstatic: 'crowd_cheer_large',
      enthusiastic: 'crowd_cheer_medium',
      engaged: 'crowd_cheer_small',
      mixed: 'ambient_chatter',
      disappointed: 'booing',
    };
    
    const soundType = typeMap[crowdResponse] || 'crowd_cheer_small';
    return this.playSound(soundType);
  }

  /**
   * Play a sound for a specific gig moment
   */
  playGigMoment(moment: 'entrance' | 'exit' | 'encore' | 'highlight' | 'applause'): HTMLAudioElement | null {
    const typeMap: Record<string, string> = {
      entrance: 'band_entrance',
      exit: 'band_exit',
      encore: 'encore_request',
      highlight: 'crowd_cheer_large',
      applause: 'applause',
    };
    
    return this.playSound(typeMap[moment]);
  }

  /**
   * Fade in a sound over a duration
   */
  fadeIn(soundType: string, durationMs: number = 2000): HTMLAudioElement | null {
    const audio = this.playSound(soundType, 0);
    if (!audio) return null;
    
    audio.volume = 0;
    const targetVolume = this.isMuted ? 0 : this.mainVolume;
    const steps = 20;
    const stepDuration = durationMs / steps;
    const volumeStep = targetVolume / steps;
    
    let currentStep = 0;
    const interval = setInterval(() => {
      currentStep++;
      audio.volume = Math.min(targetVolume, volumeStep * currentStep);
      if (currentStep >= steps) {
        clearInterval(interval);
      }
    }, stepDuration);
    
    return audio;
  }

  /**
   * Fade out a specific audio element
   */
  fadeOut(audio: HTMLAudioElement, durationMs: number = 2000): void {
    const startVolume = audio.volume;
    const steps = 20;
    const stepDuration = durationMs / steps;
    const volumeStep = startVolume / steps;
    
    let currentStep = 0;
    const interval = setInterval(() => {
      currentStep++;
      audio.volume = Math.max(0, startVolume - (volumeStep * currentStep));
      if (currentStep >= steps) {
        clearInterval(interval);
        audio.pause();
      }
    }, stepDuration);
  }

  /**
   * Stop all currently playing sounds
   */
  stopAll(): void {
    this.activeAudio.forEach((audio) => {
      audio.pause();
    });
    this.activeAudio.clear();
  }

  /**
   * Get available sound types
   */
  getAvailableSoundTypes(): string[] {
    return Array.from(this.sounds.keys());
  }

  /**
   * Check if sounds are loaded
   */
  hasSounds(): boolean {
    return this.sounds.size > 0;
  }

  /**
   * Get count of sounds for a type
   */
  getSoundCount(soundType: string): number {
    return this.sounds.get(soundType)?.length || 0;
  }
}

// Singleton instance for easy reuse
let mixerInstance: CrowdSoundMixer | null = null;

export function getCrowdSoundMixer(): CrowdSoundMixer {
  if (!mixerInstance) {
    mixerInstance = new CrowdSoundMixer();
  }
  return mixerInstance;
}
