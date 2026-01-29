// Gear image mapping utility
import electricGuitar from "@/assets/gear/electric-guitar.jpg";
import acousticGuitar from "@/assets/gear/acoustic-guitar.jpg";
import bassGuitar from "@/assets/gear/bass-guitar.jpg";
import drums from "@/assets/gear/drums.jpg";
import cymbals from "@/assets/gear/cymbals.jpg";
import keyboard from "@/assets/gear/keyboard.jpg";
import amplifier from "@/assets/gear/amplifier.jpg";
import effects from "@/assets/gear/effects.jpg";
import microphone from "@/assets/gear/microphone.jpg";
import stage from "@/assets/gear/stage.jpg";

// Map subcategories to images
const subcategoryImages: Record<string, string> = {
  electric_guitar: electricGuitar,
  guitar: electricGuitar,
  acoustic_guitar: acousticGuitar,
  bass: bassGuitar,
  drums: drums,
  electronic_drums: drums,
  cymbals: cymbals,
  keyboard: keyboard,
  synthesizer: keyboard,
  guitar_amp: amplifier,
  bass_amp: amplifier,
  tube_combo: amplifier,
  tube_head: amplifier,
  modeler: amplifier,
  // Effects
  overdrive: effects,
  distortion: effects,
  fuzz: effects,
  delay: effects,
  reverb: effects,
  chorus: effects,
  flanger: effects,
  phaser: effects,
  tremolo: effects,
  vibe: effects,
  compressor: effects,
  noise_gate: effects,
  tuner: effects,
  wah: effects,
  volume: effects,
  pitch: effects,
  octave: effects,
  modulation: effects,
  multi: effects,
  // Recording
  condenser_mic: microphone,
  dynamic_mic: microphone,
  ribbon_mic: microphone,
  tube_mic: microphone,
  condenser: microphone,
  microphone: microphone,
  // Stage
  pa_speaker: stage,
  subwoofer: stage,
  monitor: stage,
  line_array: stage,
  mixer: stage,
  di_box: stage,
  cable: stage,
  wireless_mic: stage,
  wireless_guitar: stage,
  iem: stage,
  moving_head: stage,
  par_light: stage,
  strobe: stage,
  led_par: stage,
  lighting: stage,
  fog: stage,
  hazer: stage,
  speaker: stage,
};

// Map categories to fallback images
const categoryImages: Record<string, string> = {
  instrument: electricGuitar,
  amplifier: amplifier,
  effects: effects,
  recording: microphone,
  stage: stage,
  transport: stage,
};

/**
 * Get the appropriate image for a gear item based on its category and subcategory
 */
export function getGearImage(category?: string | null, subcategory?: string | null): string {
  // First try subcategory
  if (subcategory && subcategoryImages[subcategory]) {
    return subcategoryImages[subcategory];
  }
  
  // Fall back to category
  if (category && categoryImages[category]) {
    return categoryImages[category];
  }
  
  // Default to electric guitar
  return electricGuitar;
}

/**
 * Get all gear images for preloading
 */
export const gearImages = {
  electricGuitar,
  acousticGuitar,
  bassGuitar,
  drums,
  cymbals,
  keyboard,
  amplifier,
  effects,
  microphone,
  stage,
};
