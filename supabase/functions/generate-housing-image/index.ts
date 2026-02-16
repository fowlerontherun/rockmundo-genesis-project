import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function generateAndUploadImage(supabase: any, ht: any, apiKey: string): Promise<{ success: boolean; error?: string; imageUrl?: string }> {
  const tierLabel = ht.tier <= 5 ? 'modest' : ht.tier <= 10 ? 'comfortable' : ht.tier <= 15 ? 'upscale' : 'luxury'
  const prompt = `A beautiful exterior photograph of a ${tierLabel} ${ht.name} in ${ht.country}. The architecture should reflect authentic ${ht.country} style and local building traditions. ${ht.bedrooms} bedroom home. Professional real estate photography, natural daylight, well-maintained property. 4:3 aspect ratio.`

  const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
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
    console.error(`AI error for ${ht.id}:`, aiResponse.status, errText)
    return { success: false, error: `AI error ${aiResponse.status}` }
  }

  const aiData = await aiResponse.json()
  const imageDataUrl = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url

  if (!imageDataUrl) {
    return { success: false, error: 'No image in response' }
  }

  const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, '')
  const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))
  const fileName = `${ht.country.toLowerCase().replace(/\s+/g, '-')}/${ht.id}.png`

  const { error: uploadError } = await supabase.storage
    .from('housing-images')
    .upload(fileName, binaryData, { contentType: 'image/png', upsert: true })

  if (uploadError) {
    console.error(`Upload error for ${ht.id}:`, uploadError)
    return { success: false, error: 'Upload failed' }
  }

  const { data: publicUrlData } = supabase.storage
    .from('housing-images')
    .getPublicUrl(fileName)

  await supabase
    .from('housing_types')
    .update({ image_url: publicUrlData.publicUrl })
    .eq('id', ht.id)

  return { success: true, imageUrl: publicUrlData.publicUrl }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // BATCH MODE: generate multiple missing images
    if (body.batch) {
      const batchSize = body.batch_size || 5
      const delayMs = body.delay_ms || 4000

      const { data: missingTypes, error: fetchError } = await supabase
        .from('housing_types')
        .select('id, country, name, tier, bedrooms, description')
        .is('image_url', null)
        .order('country')
        .order('tier')
        .limit(batchSize)

      if (fetchError) {
        return new Response(JSON.stringify({ error: fetchError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (!missingTypes || missingTypes.length === 0) {
        return new Response(JSON.stringify({ message: 'All done!', processed: 0, remaining: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      let processed = 0
      let failed = 0

      for (let i = 0; i < missingTypes.length; i++) {
        const ht = missingTypes[i]
        const result = await generateAndUploadImage(supabase, ht, LOVABLE_API_KEY)
        if (result.success) {
          processed++
          console.log(`✓ ${ht.country} - ${ht.name} (${processed}/${missingTypes.length})`)
        } else {
          failed++
          console.error(`✗ ${ht.country} - ${ht.name}: ${result.error}`)
        }

        if (i < missingTypes.length - 1) {
          await sleep(delayMs)
        }
      }

      const { count: remaining } = await supabase
        .from('housing_types')
        .select('id', { count: 'exact', head: true })
        .is('image_url', null)

      return new Response(JSON.stringify({ processed, failed, remaining: remaining ?? 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // SINGLE MODE: generate one image
    const { housing_type_id, country } = body
    if (!housing_type_id || !country) {
      return new Response(JSON.stringify({ error: 'Missing housing_type_id or country' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

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

    if (housingType.image_url) {
      return new Response(JSON.stringify({ image_url: housingType.image_url }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const result = await generateAndUploadImage(supabase, { ...housingType, country }, LOVABLE_API_KEY)
    
    if (!result.success) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ image_url: result.imageUrl }), {
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