import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { festivalId } = await req.json()
    if (!festivalId) {
      return new Response(JSON.stringify({ error: 'Missing festivalId' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch festival
    const { data: festival, error: festError } = await supabase
      .from('game_events')
      .select('*')
      .eq('id', festivalId)
      .single()

    if (festError || !festival) {
      return new Response(JSON.stringify({ error: 'Festival not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch stages
    const { data: stages = [] } = await supabase
      .from('festival_stages')
      .select('*')
      .eq('festival_id', festivalId)
      .order('stage_number')

    // Fetch slots with band info
    const { data: slots = [] } = await supabase
      .from('festival_stage_slots')
      .select('*, band:bands(name, logo_url)')
      .eq('festival_id', festivalId)
      .order('day_number')
      .order('slot_number')

    // Build lineup description for the prompt
    const lineupParts: string[] = []
    const bandNames: string[] = []
    const headliners: string[] = []

    for (const stage of (stages || [])) {
      const stageSlots = (slots || []).filter((s: any) => s.stage_id === stage.id)
      if (stageSlots.length === 0) continue

      const slotDescriptions: string[] = []
      for (const slot of stageSlots) {
        const name = slot.is_npc_dj
          ? (slot.npc_dj_name || 'DJ')
          : (slot.band?.name || 'TBA')

        if (slot.slot_type === 'headliner') {
          headliners.push(name)
        }
        bandNames.push(name)
        slotDescriptions.push(`Day ${slot.day_number}: ${name} (${slot.slot_type})`)
      }
      lineupParts.push(`${stage.stage_name}${stage.genre_focus ? ` [${stage.genre_focus}]` : ''}:\n${slotDescriptions.join('\n')}`)
    }

    const startDate = new Date(festival.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const endDate = festival.end_date ? new Date(festival.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''

    const prompt = `Create a professional music festival lineup poster for "${festival.title}". 
Location: ${festival.location || 'TBA'}
Dates: ${startDate}${endDate ? ` - ${endDate}` : ''}

The poster should have a dramatic, professional music festival aesthetic with bold typography.
Headliners should be displayed in the LARGEST text: ${headliners.join(', ') || 'Various Artists'}
Other performers in smaller text: ${bandNames.filter(n => !headliners.includes(n)).join(', ') || 'Various Artists'}

${(stages || []).length > 1 ? `Multiple stages: ${(stages || []).map((s: any) => s.stage_name).join(', ')}` : ''}

Style: Dark background with vibrant neon/gradient accents, festival poster art style, eye-catching design.
Include the festival name prominently at the top, dates and location at the bottom.
Portrait orientation (3:4 aspect ratio). Ultra high resolution.`

    console.log('Generating poster for:', festival.title)

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
      console.error('AI error:', aiResponse.status, errText)
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limited, please try again later' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      return new Response(JSON.stringify({ error: 'AI generation failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const aiData = await aiResponse.json()
    const imageDataUrl = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url

    if (!imageDataUrl) {
      return new Response(JSON.stringify({ error: 'No image generated' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Upload to storage
    const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, '')
    const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))
    const fileName = `${festivalId}.png`

    const { error: uploadError } = await supabase.storage
      .from('festival-posters')
      .upload(fileName, binaryData, { contentType: 'image/png', upsert: true })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return new Response(JSON.stringify({ error: 'Failed to upload poster' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: publicUrlData } = supabase.storage
      .from('festival-posters')
      .getPublicUrl(fileName)

    // Save poster URL to festival
    await supabase
      .from('game_events')
      .update({ poster_url: publicUrlData.publicUrl })
      .eq('id', festivalId)

    console.log('Poster generated:', publicUrlData.publicUrl)

    return new Response(JSON.stringify({ poster_url: publicUrlData.publicUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
