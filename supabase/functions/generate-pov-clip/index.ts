import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// POV Clip prompt templates - MTV2 / Kerrang late-night early-2000s aesthetic
// Enhanced with angle variations (A/B) for dynamic clip cycling
const CLIP_PROMPTS: Record<string, string> = {
  // Guitar Strumming - G1A (Angle A - tilted left)
  'G1A': 'First-person POV of hands strumming an electric guitar during a live rock concert, close-up cinematic angle, slightly tilted to the left, MTV2 / Kerrang late-night early-2000s aesthetic, grainy handheld camera feel, high contrast overexposed stage lights, energetic but raw. Highly detailed textures on hands, fingernails, strings, frets, pick, and metallic parts. Leather jacket sleeve and wristbands visible, subtle reflections on guitar body, loopable, designed for layering. Player-owned guitar skin fully visible.',
  
  // Guitar Strumming - G1B (Angle B - tilted right, tighter on fretboard)
  'G1B': 'First-person POV of hands strumming an electric guitar during a live rock concert, close-up cinematic angle, slightly tilted to the right, tighter on fretboard, MTV2 / Kerrang late-night early-2000s aesthetic, grainy handheld camera feel, high contrast overexposed stage lights, energetic but raw. Highly detailed textures on hands, fingernails, strings, frets, pick, and metallic parts, emphasizing finger positions and hand movement. Leather jacket sleeve and wristbands visible, subtle reflections on guitar body, loopable. Player-owned guitar skin fully visible.',
  
  // Guitar Solo - G2 (Close-up on fretboard)
  'G2': 'First-person POV looking down at electric guitar playing an intense solo, cinematic angle slightly zoomed in on fretboard, MTV2 / Kerrang late-night aesthetic, grainy handheld camera, high contrast overexposed stage lights, energetic motion. Highly detailed textures on fingers, fingernails, strings, frets, metallic hardware. Leather jacket sleeve with studs visible, rim lighting, loopable. Player-owned guitar skin clearly displayed.',
  
  // Bass Groove - B1A (Angle A - tilted left)
  'B1A': 'First-person POV of hands plucking bass guitar strings, cinematic angle, slight tilt to the left, MTV2 / Kerrang late-night aesthetic, grainy, high contrast lighting with lens flares, energetic motion. Highly detailed textures on fingers, fingernails, bass strings, frets, wristbands, visible fabric folds on sleeves, subtle metallic reflections on tuning pegs and hardware. Loopable. Player-owned bass skin fully visible.',
  
  // Bass Groove - B1B (Angle B - tilted right, tighter on fretboard)
  'B1B': 'First-person POV of hands plucking bass guitar strings, cinematic angle, slight tilt to the right, tighter on fretboard, MTV2 / Kerrang late-night aesthetic, grainy, high contrast lighting, energetic motion emphasizing finger motion. Highly detailed textures on fingers, fingernails, bass strings, frets, wristbands, visible fabric folds on sleeves, subtle metallic reflections. Loopable. Player-owned bass skin fully visible.',
  
  // Drums Snare - D1A (Angle A - tilted left)
  'D1A': 'First-person POV of drummer hands holding sticks, looking down at snare and hi-hat, cinematic angle slightly left, MTV2 / Kerrang late-night concert aesthetic, grainy handheld camera, high contrast lighting with overexposed highlights, energetic motion. Highly detailed textures on drumsticks grain, black fingerless gloves with visible stitching, wristbands, drum heads with tension rods, metallic reflections on hardware. Loopable. Player-owned drum skins visible.',
  
  // Drums Snare - D1B (Angle B - tilted right, focus on hi-hat/cymbals)
  'D1B': 'First-person POV of drummer hands holding sticks, looking down at snare and hi-hat, cinematic angle slightly right with more focus on hi-hat and cymbals, MTV2 / Kerrang late-night concert aesthetic, grainy handheld camera, high contrast lighting, energetic motion. Highly detailed textures on drumsticks grain, gloves with stitching, wristbands, drum heads, cymbal metallic reflections. Loopable. Player-owned drum skins visible.',
  
  // Drums Overhead Toms - D2
  'D2': 'First-person POV from drummer angled forward at tom drums, hands holding sticks about to strike, MTV2 / Kerrang late-night concert aesthetic, high contrast stage lighting with rim light effects, grainy film texture, energetic performance. Highly detailed textures on sticks, gloves, wristbands, drum heads, and chrome hardware. Loopable. Drum hardware and player skins clearly visible.',
  
  // Vocalist Mic - V1A (Angle A - tilted left)
  'V1A': 'First-person POV of rock singer holding a microphone, hands gripping mic visible in frame, cinematic angle slightly left, MTV2 / Kerrang late-night aesthetic, grainy handheld camera feel, high contrast overexposed stage lights, energetic motion. Highly detailed textures on hands, fingers, fingernails, microphone mesh and metallic body with reflections. Sleeves and wristbands highly detailed with fabric folds. Background crowd silhouetted, minimal detail. Player-owned gloves or sleeve skins clearly visible, loopable.',
  
  // Vocalist Mic - V1B (Angle B - tilted right, tighter on hands/mic)
  'V1B': 'First-person POV of rock singer holding a microphone, hands gripping mic visible in frame, cinematic angle slightly right, tighter on hands and mic, MTV2 / Kerrang late-night aesthetic, grainy handheld camera feel, high contrast overexposed stage lights, energetic motion. Highly detailed textures on hands, fingers, fingernails, microphone mesh and metallic body with reflections. Sleeves and wristbands highly detailed with fabric folds. Background crowd silhouetted. Player-owned gloves or sleeve skins clearly visible, loopable.',
  
  // Crowd Small Venue - C1 (Detailed POV)
  'C1': 'Stage POV of a small venue concert audience, close enough to see individual hands and fingers with bracelets, rings, and wristbands in the foreground, heads with varied hair styles visible, MTV2 / Kerrang late-night early-2000s aesthetic, grainy texture, high contrast stage lights reflecting subtly on arms and hair, energetic motion. Highly detailed foreground hands with visible knuckles, jewelry, and different skin tones. Background slightly stylized silhouettes for depth, smoke and haze in air. Loopable, designed to layer behind first-person performer clips. Multiple hand positions including fists, devil horns, and reaching fingers.',
  
  // Crowd Medium/Arena - C2 (Detailed POV)
  'C2': 'Stage POV of a medium to large arena concert audience, foreground hands highly detailed with bracelets, rings, wristbands, and different skin tones, visible head shapes and varied hair styles, MTV2 / Kerrang early-2000s aesthetic, grainy cinematic texture, high contrast lighting with subtle stage reflections on arms. Phone lights and lighters visible in crowd, energetic and loopable. Background crowd slightly stylized silhouettes for depth, dynamic overexposed stage lighting. Designed for layering behind POV clips. Multiple variations of hand positions including banners, phones held up, and reaching arms.',
  
  // Stage Lights Overlay - L1A (Version A)
  'L1A': 'Transparent overlay of dynamic stage lights flashing in sync with energetic rock music, MTV2 / Kerrang late-night aesthetic, cinematic, grainy texture, high contrast, subtle motion blur, overexposed lighting. Bright lens flares and light beams cutting through smoke, warm orange and white tones, black background with light effects only. Loopable, designed to composite on POV clips.',
  
  // Stage Lights Overlay - L1B (Version B - different pattern)
  'L1B': 'Transparent overlay of dynamic stage lights flashing with different pattern and color intensity, MTV2 / Kerrang late-night aesthetic, cinematic, grainy texture, high contrast, subtle motion blur. Cool blue and purple tones mixed with bright white strobes, lens flares, black background with light effects only. Loopable, designed to composite on POV clips.',
  
  // Camera Shake Overlay - L2A (Mild)
  'L2A': 'Subtle handheld camera shake effect for first-person POV concert, mild motion blur, MTV2 / Kerrang late-night aesthetic, slight diagonal movement, grainy. Designed as transparent overlay effect, loopable, for verse and bridge sections to simulate gentle stage movement.',
  
  // Camera Shake Overlay - L2B (Intense)
  'L2B': 'Pronounced handheld camera shake effect for first-person POV concert, intense motion blur, MTV2 / Kerrang late-night aesthetic, energetic diagonal and vertical movement, grainy. Designed as transparent overlay effect, loopable, for solo or chorus peaks to simulate high-energy performance intensity.',
  
  // Hands + Sleeves Skin - H1A (Angle A)
  'H1A': 'Close-up first-person POV of hands playing guitar or bass, wearing leather jacket sleeve or gloves, MTV2 / Kerrang late-night aesthetic, loopable, cinematic. Highly detailed textures on hands, fingers, visible fingernails, fabric folds, leather grain, metal studs. Guitar strings, frets visible with metallic reflections. High contrast stage lighting, grainy. Player-owned skin clearly visible.',
  
  // Hands + Sleeves Skin - H1B (Angle B - slightly angled for variety)
  'H1B': 'Close-up first-person POV of hands playing guitar or bass, wearing leather jacket sleeve or gloves, slightly angled for variety, MTV2 / Kerrang late-night aesthetic, loopable, cinematic. Highly detailed textures on hands, fingers, visible fingernails, fabric folds, leather grain, metal studs. Guitar strings, frets visible with metallic reflections. High contrast stage lighting, grainy. Player-owned skin clearly visible.',
  
  // Instrument Skin - I1A (Angle A)
  'I1A': 'Close-up first-person POV of hands playing guitar, bass, or drums, instrument featuring alternate player-owned skin, MTV2 / Kerrang late-night aesthetic, loopable, cinematic. Highly detailed textures on instrument body, strings, frets, hardware with reflective metallic parts. Visible sleeves and hands with fabric folds, wristbands. High contrast stage lighting with rim lights, grainy film texture. Player-owned instrument skin fully visible and prominent.',
  
  // Instrument Skin - I1B (Angle B - slightly different angle)
  'I1B': 'Close-up first-person POV of hands playing guitar, bass, or drums, instrument featuring alternate player-owned skin, slightly different angle for variety, MTV2 / Kerrang late-night aesthetic, loopable, cinematic. Highly detailed textures on instrument body, strings, frets, hardware with reflective metallic parts. Visible sleeves and hands with fabric folds, wristbands. High contrast stage lighting, grainy film texture. Player-owned instrument skin fully visible and prominent.',
  
  // Legacy aliases for backward compatibility
  'G1': 'First-person POV of hands strumming an electric guitar during a live rock concert, close-up cinematic angle, slightly tilted to the left, MTV2 / Kerrang late-night early-2000s aesthetic, grainy handheld camera feel, high contrast overexposed stage lights, energetic but raw. Highly detailed textures on hands, fingernails, strings, frets, pick, and metallic parts. Leather jacket sleeve and wristbands visible, subtle reflections on guitar body, loopable, designed for layering. Player-owned guitar skin fully visible.',
  'B1': 'First-person POV of hands plucking bass guitar strings, cinematic angle, slight tilt to the left, MTV2 / Kerrang late-night aesthetic, grainy, high contrast lighting with lens flares, energetic motion. Highly detailed textures on fingers, fingernails, bass strings, frets, wristbands, visible fabric folds on sleeves, subtle metallic reflections on tuning pegs and hardware. Loopable. Player-owned bass skin fully visible.',
  'D1': 'First-person POV of drummer hands holding sticks, looking down at snare and hi-hat, cinematic angle slightly left, MTV2 / Kerrang late-night concert aesthetic, grainy handheld camera, high contrast lighting with overexposed highlights, energetic motion. Highly detailed textures on drumsticks grain, black fingerless gloves with visible stitching, wristbands, drum heads with tension rods, metallic reflections on hardware. Loopable. Player-owned drum skins visible.',
  'V1': 'First-person POV of rock singer holding a microphone, hands gripping mic visible in frame, cinematic angle slightly left, MTV2 / Kerrang late-night aesthetic, grainy handheld camera feel, high contrast overexposed stage lights, energetic motion. Highly detailed textures on hands, fingers, fingernails, microphone mesh and metallic body with reflections. Sleeves and wristbands highly detailed with fabric folds. Background crowd silhouetted, minimal detail. Player-owned gloves or sleeve skins clearly visible, loopable.',
  'L1': 'Transparent overlay of dynamic stage lights flashing in sync with energetic rock music, MTV2 / Kerrang late-night aesthetic, cinematic, grainy texture, high contrast, subtle motion blur, overexposed lighting. Bright lens flares and light beams cutting through smoke, warm orange and white tones, black background with light effects only. Loopable, designed to composite on POV clips.',
  'L2': 'Subtle handheld camera shake effect for first-person POV concert, mild motion blur, MTV2 / Kerrang late-night aesthetic, slight diagonal movement, grainy. Designed as transparent overlay effect, loopable, for verse and bridge sections to simulate gentle stage movement.',
  'H1': 'Close-up first-person POV of hands playing guitar or bass, wearing leather jacket sleeve or gloves, MTV2 / Kerrang late-night aesthetic, loopable, cinematic. Highly detailed textures on hands, fingers, visible fingernails, fabric folds, leather grain, metal studs. Guitar strings, frets visible with metallic reflections. High contrast stage lighting, grainy. Player-owned skin clearly visible.',
  'I1': 'Close-up first-person POV of hands playing guitar, bass, or drums, instrument featuring alternate player-owned skin, MTV2 / Kerrang late-night aesthetic, loopable, cinematic. Highly detailed textures on instrument body, strings, frets, hardware with reflective metallic parts. Visible sleeves and hands with fabric folds, wristbands. High contrast stage lighting with rim lights, grainy film texture. Player-owned instrument skin fully visible and prominent.',
};

// Instrument skin modifiers
const SKIN_MODIFIERS: Record<string, string> = {
  'classic-sunburst': 'vintage sunburst finish guitar',
  'midnight-black': 'sleek black finish guitar',
  'arctic-white': 'pearl white finish guitar',
  'cherry-red': 'deep cherry red finish guitar',
  'ocean-blue': 'metallic ocean blue finish guitar',
  'neon-green': 'electric neon green finish guitar',
  'purple-haze': 'deep purple finish guitar',
  'natural-wood': 'natural wood grain bass guitar',
  'jet-black': 'jet black bass guitar',
  'vintage-sunburst': 'vintage sunburst bass guitar',
  'blood-red': 'blood red bass guitar',
  'electric-blue': 'electric blue bass guitar',
};

// Sleeve style modifiers
const SLEEVE_MODIFIERS: Record<string, string> = {
  'leather': 'black leather jacket sleeve',
  'denim': 'worn denim jacket sleeve',
  'hoodie': 'dark hoodie sleeve',
  'bare': 'bare arm with tattoos',
  'band-tee': 'black band t-shirt sleeve',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clipVariant, instrumentSkin, sleeveStyle, customPrompt } = await req.json();
    
    // Build the prompt
    let prompt = CLIP_PROMPTS[clipVariant] || CLIP_PROMPTS['G1'];
    
    // Add skin modifier if provided
    if (instrumentSkin && SKIN_MODIFIERS[instrumentSkin]) {
      prompt = prompt.replace(/electric guitar|guitar/gi, SKIN_MODIFIERS[instrumentSkin]);
    }
    
    // Add sleeve modifier if provided
    if (sleeveStyle && SLEEVE_MODIFIERS[sleeveStyle]) {
      prompt = prompt.replace(/jacket sleeve|sleeves/gi, SLEEVE_MODIFIERS[sleeveStyle]);
    }
    
    // Use custom prompt if provided
    if (customPrompt) {
      prompt = customPrompt;
    }

    console.log(`Generating POV clip: ${clipVariant} with skin: ${instrumentSkin}, sleeve: ${sleeveStyle}`);
    console.log(`Prompt: ${prompt}`);

    // Call the Lovable AI gateway for image generation
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        modalities: ['image', 'text'],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const imageData = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    const description = data.choices?.[0]?.message?.content || '';

    if (!imageData) {
      throw new Error('No image generated');
    }

    return new Response(
      JSON.stringify({
        success: true,
        clipVariant,
        imageUrl: imageData,
        description,
        prompt,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error generating POV clip:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
