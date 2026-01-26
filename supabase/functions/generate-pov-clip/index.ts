import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// POV Clip prompt templates - MTV2 / Kerrang late-night early-2000s aesthetic
const CLIP_PROMPTS: Record<string, string> = {
  // Guitar variants
  'G1': 'First-person POV of hands strumming an electric guitar during a live rock concert, early 2000s MTV2 / Kerrang late-night aesthetic, grainy handheld camera feel, high contrast overexposed stage lights, energetic but raw, close-up on guitar neck and hands, visible leather jacket sleeves, loopable frame, cinematic, gritty texture, slightly desaturated colors.',
  
  'G2': 'First-person POV looking down at electric guitar playing an intense solo, fingers moving along the fretboard, high contrast overexposed stage lights in background, MTV2 / Kerrang late-night aesthetic, grainy film texture, energetic handheld camera angle, visible jacket sleeves with studs, cinematic rock concert atmosphere, gritty and raw.',
  
  // Bass variants
  'B1': 'First-person POV of hands plucking bass guitar strings, looking down at the bass fretboard, MTV2 / Kerrang late-night concert style, high contrast stage lighting with lens flares, grainy film texture, energetic motion blur, visible leather wristbands and jacket sleeves, cinematic rock performance, gritty early-2000s aesthetic.',
  
  // Drums variants
  'D1': 'POV from a drummer on stage, looking down at snare drum and hi-hat, hands holding drumsticks mid-strike, black fingerless gloves visible, MTV2 / Kerrang late-night concert style, high contrast stage lights creating overexposed highlights, grainy texture, energetic motion blur on sticks, cinematic rock concert frame.',
  
  'D2': 'POV from drummer angled forward at tom drums, hands holding sticks about to strike, MTV2 / Kerrang late-night concert aesthetic, high contrast stage lighting with rim light effects, grainy film texture, energetic performance, visible gloves and wristbands, cinematic rock show atmosphere, gritty and raw.',
  
  // Vocalist variants
  'V1': 'First-person POV of a rock singer holding a microphone, hands gripping mic visible in frame, overexposed stage lights creating lens flares in background, dark crowd silhouettes in distance, MTV2 / Kerrang late-night aesthetic, grainy handheld camera feel, visible leather jacket sleeve, energetic performance, cinematic rock concert.',
  
  // Crowd variants
  'C1': 'Stage POV looking out at a small venue rock concert audience, hands raised in the air, silhouettes only backlit by bright stage lights, MTV2 / Kerrang early-2000s late-night aesthetic, grainy film texture, energetic crowd movement, high contrast lighting, smoke and haze in air, cinematic rock show atmosphere.',
  
  'C2': 'Stage POV of a medium to large arena concert audience, thousands of hands waving and reaching up, silhouettes backlit by colorful stage lights, MTV2 / Kerrang early-2000s aesthetic, grainy texture, energetic crowd, phone lights visible, cinematic wide shot from performer perspective.',
  
  // Overlay variants
  'L1': 'Dynamic stage lights flashing during rock concert, bright lens flares and light beams cutting through smoke, MTV2 / Kerrang late-night aesthetic, overexposed highlights, motion blur on sweeping lights, grainy texture, high contrast, designed as transparent overlay, black background with light effects only.',
  
  'L2': 'Subtle camera shake motion blur effect, MTV2 / Kerrang late-night concert aesthetic, handheld camera movement simulation, slight diagonal blur lines, grainy texture, designed as transparent overlay effect, cinematic rock concert feel.',
  
  // Skin variants
  'H1': 'Close-up first-person POV of hands playing electric guitar with custom finish, leather jacket sleeve with metal studs visible, MTV2 / Kerrang late-night concert aesthetic, high contrast stage lighting, grainy film texture, cinematic rock performance, visible wristbands and rings on fingers, energetic playing motion.',
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
