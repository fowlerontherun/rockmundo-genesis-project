import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// POV Clip prompt templates - MTV2 / Kerrang late-night early-2000s aesthetic
// Enhanced with highly detailed textures on hands, instruments, and accessories
const CLIP_PROMPTS: Record<string, string> = {
  // Guitar variants - G1 Strumming, G2 Solo
  'G1': 'First-person POV of hands strumming an electric guitar during a live rock concert, close-up cinematic angle, MTV2 / Kerrang late-night early-2000s aesthetic, grainy handheld camera feel, energetic but raw. Highly detailed textures on hands, fingers, and guitar, visible fingernails, strings, frets, pick, and metallic parts. Leather jacket sleeve and wristbands clearly visible, subtle reflections on guitar body, loopable, designed for layering as a video clip in a game. Background stylized, less detailed, with dynamic overexposed stage lights. Player-owned guitar skin fully visible.',
  
  'G2': 'First-person POV looking down at electric guitar playing an intense solo, fingers moving along the fretboard, close-up cinematic angle, MTV2 / Kerrang late-night aesthetic, grainy film texture. Highly detailed textures on fingers, fingernails, frets, strings, and metallic hardware. Visible jacket sleeves with studs and fabric folds, wristbands with texture detail. Background stylized with overexposed stage lights, high contrast rim lighting. Player-owned guitar skin fully visible, energetic handheld camera, loopable, cinematic.',
  
  // Bass variants - B1 Groove
  'B1': 'First-person POV of hands plucking bass guitar strings, close-up cinematic angle, MTV2 / Kerrang late-night aesthetic, grainy and energetic. Highly detailed textures on hands, fingers, fingernails, bass strings, frets, and hardware. Visible fabric folds on sleeves, metallic reflections on bass strings and tuning pegs, wristbands with detailed texture. Background stylized but minimal, with stage lighting and motion blur. Player-owned bass skin fully visible, loopable, designed for layering as a game clip.',
  
  // Drums variants - D1 Snare, D2 Toms
  'D1': 'First-person POV of drummer hands holding sticks, looking down at snare and hi-hat, MTV2 / Kerrang late-night concert aesthetic, grainy cinematic handheld camera, high contrast lighting, energetic motion. Highly detailed textures on drumsticks grain, black fingerless gloves with visible stitching, wristbands, drum heads with visible tension rods and hardware. Visible fabric folds on sleeves, metallic reflections on cymbals and hardware. Background stylized with overexposed stage lights. Loopable, designed for layering as a game clip.',
  
  'D2': 'First-person POV from drummer angled forward at tom drums, hands holding sticks about to strike, MTV2 / Kerrang late-night concert aesthetic, high contrast stage lighting with rim light effects, grainy film texture, energetic performance. Highly detailed textures on sticks, gloves, wristbands, drum heads, and chrome hardware. Visible fabric folds and metallic reflections. Background stylized with overexposed lights. Player-owned drum skins or hand accessories clearly visible, loopable, cinematic.',
  
  // Vocalist variants - V1 Mic
  'V1': 'First-person POV of rock singer holding a microphone, hands gripping mic visible in frame, MTV2 / Kerrang late-night aesthetic, grainy cinematic handheld camera feel, high contrast stage lights, slightly overexposed, energetic motion. Highly detailed textures on hands, fingers, fingernails, microphone mesh and metallic body with reflections. Sleeves and wristbands highly detailed with fabric folds and textures. Background stylized, crowd silhouetted, minimal detail. Player-owned gloves or skins clearly visible, loopable, designed as composable game clip.',
  
  // Crowd variants - C1 Small Venue, C2 Arena
  'C1': 'Stage POV of small venue concert audience, hands in the air, clapping and waving, silhouettes highly readable, MTV2 / Kerrang late-night early-2000s aesthetic, grainy, energetic. Background lights visible with dynamic overexposed stage lighting, slight motion blur, smoke and haze in air. High contrast lighting creating backlit silhouettes. Loopable, designed to layer behind first-person performer clips.',
  
  'C2': 'Stage POV of medium to large arena concert audience, thousands of hands waving and reaching up, silhouettes highly readable, backlit by colorful stage lights, MTV2 / Kerrang early-2000s aesthetic, grainy texture, energetic. Phone lights visible in crowd, dynamic overexposed stage lighting, slight motion blur. Cinematic wide shot from performer perspective, loopable, designed to layer behind performer clips.',
  
  // Overlay variants - L1 Stage Lights, L2 Camera Shake
  'L1': 'Transparent overlay of dynamic stage lights flashing in sync with energetic rock music, MTV2 / Kerrang late-night aesthetic, cinematic, grainy texture, high contrast, subtle motion blur, overexposed lighting. Bright lens flares and light beams cutting through smoke, black background with light effects only. Loopable, designed to be composited on top of first-person performer clips.',
  
  'L2': 'Cinematic handheld camera shake effect for first-person POV concert, subtle motion blur, MTV2 / Kerrang late-night aesthetic, energetic, grainy, slight diagonal blur lines, handheld camera movement simulation. Designed as transparent overlay effect, loopable, to layer on POV clips to simulate stage movement and performance intensity.',
  
  // Hands + Sleeves Alternate Skin - H1
  'H1': 'Close-up first-person POV of hands playing guitar or bass, wearing leather jacket sleeve, gloves, wristbands, or alternate clothing skin, MTV2 / Kerrang late-night aesthetic, loopable, cinematic. Highly detailed textures on hands, fingers, fingernails, fabric folds, leather grain, metal studs. Guitar strings, frets, or drumsticks visible with metallic reflections. High contrast stage lighting, grainy. Designed for compositing in a rock concert game. Player-owned skin clearly visible.',
  
  // Instrument Alternate Skin - I1 (NEW)
  'I1': 'Close-up first-person POV of hands playing guitar, bass, or drums, instrument featuring alternate player-owned skin, MTV2 / Kerrang late-night aesthetic, loopable, cinematic. Highly detailed textures on instrument body, strings, frets, hardware with reflective metallic parts. Visible sleeves and hands with fabric folds, wristbands. High contrast stage lighting with rim lights, grainy film texture. Designed for layering on top of base POV clips in a game. Player-owned instrument skin fully visible and prominent.',
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
