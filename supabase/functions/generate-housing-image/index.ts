import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { housing_type_id, country } = await req.json()
    if (!housing_type_id || !country) {
      return new Response(JSON.stringify({ error: 'Missing housing_type_id or country' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get housing type details
    const { data: housingType, error: htError } = await supabase
      .from('housing_types')
      .select('*')
      .eq('id', housing_type_id)
      .single()

    if (htError || !housingType) {
      return new Response(JSON.stringify({ error: 'Housing type not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Already has image?
    if (housingType.image_url) {
      return new Response(JSON.stringify({ image_url: housingType.image_url }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Generate image prompt
    const tierLabel = housingType.tier <= 5 ? 'modest' : housingType.tier <= 10 ? 'comfortable' : housingType.tier <= 15 ? 'upscale' : 'luxury'
    const prompt = `A beautiful exterior photograph of a ${tierLabel} ${housingType.name} in ${country}. The architecture should reflect authentic ${country} style and local building traditions. ${housingType.bedrooms} bedroom home. Professional real estate photography, natural daylight, well-maintained property. 4:3 aspect ratio.`

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image',
        messages: [{ role: 'user', content: prompt }],
        modalities: ['image', 'text'],
      }),
    })

    if (!aiResponse.ok) {
      const errText = await aiResponse.text()
      console.error('AI gateway error:', aiResponse.status, errText)
      return new Response(JSON.stringify({ error: 'Image generation failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const aiData = await aiResponse.json()
    const imageDataUrl = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url

    if (!imageDataUrl) {
      return new Response(JSON.stringify({ error: 'No image generated' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Upload to storage
    const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, '')
    const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))
    const fileName = `${country.toLowerCase().replace(/\s+/g, '-')}/${housing_type_id}.png`

    const { error: uploadError } = await supabase.storage
      .from('housing-images')
      .upload(fileName, binaryData, {
        contentType: 'image/png',
        upsert: true,
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return new Response(JSON.stringify({ error: 'Failed to upload image' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('housing-images')
      .getPublicUrl(fileName)

    const publicUrl = publicUrlData.publicUrl

    // Update housing type with image URL
    await supabase
      .from('housing_types')
      .update({ image_url: publicUrl })
      .eq('id', housing_type_id)

    return new Response(JSON.stringify({ image_url: publicUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
