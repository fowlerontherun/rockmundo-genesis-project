import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Voice options for variety
const VOICE_OPTIONS = {
  energetic: 'JBFqnCBsd6RMkjVDRZzb', // George - classic radio DJ
  deadpan: 'onwK4e9ZLuTAKqWW03F9',   // Daniel - deadpan delivery
  cheerful: 'EXAVITQu4vr4xnSDxMaL',  // Sarah - cheerful
  dramatic: 'N2lVS1w4EtoT3dr4eOWO',  // Callum - dramatic
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const elevenlabsApiKey = Deno.env.get('ELEVENLABS_API_KEY');

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { contentId, generateAll } = await req.json();

    // If generating all pending content
    let contentToGenerate;
    if (generateAll) {
      const { data, error } = await supabase
        .from('radio_content')
        .select('*')
        .eq('audio_status', 'pending')
        .eq('is_active', true)
        .limit(10);

      if (error) throw error;
      contentToGenerate = data || [];
    } else if (contentId) {
      const { data, error } = await supabase
        .from('radio_content')
        .select('*')
        .eq('id', contentId)
        .single();

      if (error) throw error;
      contentToGenerate = data ? [data] : [];
    } else {
      return new Response(
        JSON.stringify({ error: 'contentId or generateAll required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (contentToGenerate.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending content to generate', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = [];

    for (const content of contentToGenerate) {
      console.log(`[generate-radio-content-audio] Processing: ${content.title}`);

      // Mark as generating
      await supabase
        .from('radio_content')
        .update({ audio_status: 'generating' })
        .eq('id', content.id);

      try {
        // Select voice based on humor style
        let voiceId = content.voice_id || VOICE_OPTIONS.energetic;
        if (content.humor_style === 'deadpan') {
          voiceId = VOICE_OPTIONS.deadpan;
        } else if (content.humor_style === 'cheesy') {
          voiceId = VOICE_OPTIONS.cheerful;
        } else if (content.humor_style === 'absurd') {
          voiceId = VOICE_OPTIONS.dramatic;
        }

        // Generate TTS using ElevenLabs
        if (!elevenlabsApiKey) {
          throw new Error('ELEVENLABS_API_KEY not configured');
        }

        const ttsResponse = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
          {
            method: 'POST',
            headers: {
              'xi-api-key': elevenlabsApiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              text: content.script,
              model_id: 'eleven_turbo_v2_5',
              voice_settings: {
                stability: content.content_type === 'jingle' ? 0.7 : 0.5,
                similarity_boost: 0.75,
                style: content.content_type === 'advert' ? 0.6 : 0.4,
                use_speaker_boost: true,
              },
            }),
          }
        );

        if (!ttsResponse.ok) {
          const errorText = await ttsResponse.text();
          throw new Error(`ElevenLabs API error: ${ttsResponse.status} - ${errorText}`);
        }

        const audioBuffer = await ttsResponse.arrayBuffer();
        const audioBytes = new Uint8Array(audioBuffer);

        // Upload to Supabase Storage
        const fileName = `radio-content/${content.content_type}/${content.id}.mp3`;
        
        const { error: uploadError } = await supabase.storage
          .from('music')
          .upload(fileName, audioBytes, {
            contentType: 'audio/mpeg',
            upsert: true,
          });

        if (uploadError) {
          throw new Error(`Storage upload error: ${uploadError.message}`);
        }

        // Get public URL
        const { data: publicUrlData } = supabase.storage
          .from('music')
          .getPublicUrl(fileName);

        const audioUrl = publicUrlData.publicUrl;

        // Estimate duration (rough: ~150 words per minute, ~5 chars per word)
        const wordCount = content.script.split(/\s+/).length;
        const estimatedSeconds = Math.ceil((wordCount / 150) * 60);

        // Update record with audio URL
        await supabase
          .from('radio_content')
          .update({
            audio_url: audioUrl,
            audio_status: 'completed',
            duration_seconds: estimatedSeconds,
            updated_at: new Date().toISOString(),
          })
          .eq('id', content.id);

        results.push({ id: content.id, title: content.title, status: 'completed', audioUrl });
        console.log(`[generate-radio-content-audio] Completed: ${content.title}`);

      } catch (genError) {
        console.error(`[generate-radio-content-audio] Error for ${content.title}:`, genError);
        
        await supabase
          .from('radio_content')
          .update({ audio_status: 'failed', updated_at: new Date().toISOString() })
          .eq('id', content.id);

        results.push({ id: content.id, title: content.title, status: 'failed', error: genError.message });
      }
    }

    return new Response(
      JSON.stringify({ 
        message: `Processed ${results.length} content items`,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[generate-radio-content-audio] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
