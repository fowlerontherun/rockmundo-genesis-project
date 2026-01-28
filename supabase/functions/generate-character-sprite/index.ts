import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Punk rock art style prompt base
const PUNK_ART_STYLE = `Stylised illustrated punk rock character art. Hand-drawn comic-book style with bold confident linework, slightly exaggerated proportions, gritty but clean finish. Flat colours with subtle texture and light shading, no gradients. Inspired by classic punk zine illustrations, 80s-90s underground comics, and modern indie game character art. Clear outlines suitable for sprite layering. Transparent background. No realism, no 3D, no anime.`;

// Category-specific prompt builders
const categoryPrompts: Record<string, (subcategory: string, color?: string) => string> = {
  body: (subcategory: string) => {
    const gender = subcategory.includes('female') ? 'female' : 'male';
    const bodyType = subcategory.replace(`${gender}_`, '');
    return `Full-body ${gender} character base, neutral standing pose, arms relaxed. ${PUNK_ART_STYLE} Body type: ${bodyType}. Bald head, no facial hair, no clothes except plain underwear. Neutral expression. Clear silhouette. Centered on canvas.`;
  },
  
  eyes: (subcategory: string) => {
    return `Set of stylised punk character eyes, ${subcategory} expression. Bold linework, expressive but simple. Front-facing. No face or head visible. Suitable for sprite overlay. ${PUNK_ART_STYLE}`;
  },
  
  nose: (subcategory: string) => {
    return `Stylised punk character nose, ${subcategory} shape. Side-light shading, strong outlines. No face included. ${PUNK_ART_STYLE}`;
  },
  
  mouth: (subcategory: string) => {
    return `Stylised punk character mouth, ${subcategory} expression. Bold linework. No face included. ${PUNK_ART_STYLE}`;
  },
  
  hair: (subcategory: string) => {
    return `Punk rock hairstyle: ${subcategory.replace(/_/g, ' ')}. Bold shapes, clean edges. No head or face included. ${PUNK_ART_STYLE}`;
  },
  
  hat: (subcategory: string) => {
    return `Stylised punk ${subcategory.replace(/_/g, ' ')} hat. Illustrated comic style. No head included. ${PUNK_ART_STYLE}`;
  },
  
  jacket: (subcategory: string) => {
    return `Stylised punk ${subcategory.replace(/_/g, ' ')} jacket. Comic illustration style. Front view. No body included. Clear edges. ${PUNK_ART_STYLE}`;
  },
  
  shirt: (subcategory: string) => {
    return `Stylised punk ${subcategory.replace(/_/g, ' ')}. Comic illustration style. Front view. No body included. ${PUNK_ART_STYLE}`;
  },
  
  trousers: (subcategory: string) => {
    return `Stylised punk ${subcategory.replace(/_/g, ' ')} trousers. Comic illustration style. No body included. ${PUNK_ART_STYLE}`;
  },
  
  shoes: (subcategory: string) => {
    return `Stylised punk ${subcategory.replace(/_/g, ' ')} footwear. Comic illustration style. Front-facing. ${PUNK_ART_STYLE}`;
  },
  
  glasses: (subcategory: string) => {
    return `Stylised ${subcategory.replace(/_/g, ' ')} glasses. Punk comic illustration style. No face included. ${PUNK_ART_STYLE}`;
  },
  
  facial_hair: (subcategory: string) => {
    return `Stylised ${subcategory.replace(/_/g, ' ')} facial hair for punk character. Bold linework. No face included. ${PUNK_ART_STYLE}`;
  },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { category, subcategory, name, color } = await req.json();
    
    if (!category || !subcategory) {
      throw new Error('Category and subcategory are required');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Build the prompt for this category
    const promptBuilder = categoryPrompts[category];
    if (!promptBuilder) {
      throw new Error(`Unknown category: ${category}`);
    }

    const prompt = promptBuilder(subcategory, color);
    console.log(`[generate-character-sprite] Generating ${category}/${subcategory}:`, prompt.substring(0, 100) + '...');

    // Generate the image using Lovable AI gateway
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        modalities: ['image', 'text']
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[generate-character-sprite] AI gateway error:', response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      console.error('[generate-character-sprite] No image in response:', JSON.stringify(data));
      throw new Error('No image generated');
    }

    // Upload to Supabase storage
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    // Convert base64 to blob
    const base64Data = imageUrl.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    
    const fileName = `${category}/${subcategory}_${Date.now()}.png`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('character-sprites')
      .upload(fileName, imageBuffer, {
        contentType: 'image/png',
        upsert: true,
      });

    if (uploadError) {
      console.error('[generate-character-sprite] Upload error:', uploadError);
      throw new Error(`Failed to upload sprite: ${uploadError.message}`);
    }

    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from('character-sprites')
      .getPublicUrl(fileName);

    // Layer order mapping
    const layerOrders: Record<string, number> = {
      body: 1,
      shoes: 1,
      trousers: 2,
      shirt: 2,
      jacket: 3,
      hair: 9,
      eyes: 4,
      nose: 5,
      mouth: 6,
      facial_hair: 7,
      face_detail: 8,
      hat: 10,
      glasses: 10,
    };

    // Insert into database
    const { data: assetData, error: insertError } = await supabase
      .from('character_sprite_assets')
      .insert({
        category,
        subcategory,
        name: name || `${subcategory.replace(/_/g, ' ')}`,
        asset_url: publicUrl,
        layer_order: layerOrders[category] || 5,
        gender_filter: category === 'body' || category === 'facial_hair' 
          ? [subcategory.includes('female') ? 'female' : 'male']
          : ['any'],
        body_type_filter: ['any'],
        is_default: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[generate-character-sprite] Insert error:', insertError);
      throw new Error(`Failed to save sprite record: ${insertError.message}`);
    }

    console.log('[generate-character-sprite] Sprite generated successfully:', assetData.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        asset: assetData,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('[generate-character-sprite] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
