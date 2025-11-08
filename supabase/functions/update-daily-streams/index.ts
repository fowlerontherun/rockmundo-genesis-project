import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import {
  completeJobRun,
  failJobRun,
  getErrorMessage,
  safeJson,
  startJobRun,
} from '../_shared/job-logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-triggered-by',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const payload = await safeJson<{ triggeredBy?: string; requestId?: string | null }>(req);
  const triggeredBy = payload?.triggeredBy ?? req.headers.get('x-triggered-by') ?? undefined;

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  let runId: string | null = null;
  const startedAt = Date.now();
  let streamUpdates = 0;
  let salesUpdates = 0;
  let errorCount = 0;

  try {
    console.log('Starting daily streams and sales update...');

    runId = await startJobRun({
      jobName: 'update-daily-streams',
      functionName: 'update-daily-streams',
      supabaseClient: supabase,
      triggeredBy,
      requestPayload: payload ?? null,
      requestId: payload?.requestId ?? null,
    });

    const { data: streamingReleases, error: streamingError } = await supabase
      .from('song_releases')
      .select('id, song_id, platform_id, total_streams')
      .eq('is_active', true)
      .eq('release_type', 'streaming');

    if (streamingError) {
      throw streamingError;
    }

    for (const release of streamingReleases || []) {
      try {
        const dailyStreams = Math.floor(Math.random() * 4900) + 100;
        const dailyRevenue = Math.floor(dailyStreams * 0.004);

        const { error: updateError } = await supabase
          .from('song_releases')
          .update({
            total_streams: (release.total_streams || 0) + dailyStreams,
            total_revenue: dailyRevenue,
          })
          .eq('id', release.id);

        if (updateError) {
          throw updateError;
        }

        await supabase.from('streaming_analytics_daily').insert({
          song_release_id: release.id,
          analytics_date: new Date().toISOString().split('T')[0],
          daily_streams: dailyStreams,
          daily_revenue: dailyRevenue,
          platform_id: release.platform_id,
        });

        streamUpdates++;
      } catch (streamError) {
        errorCount += 1;
        console.error(`Error processing streaming release ${release.id}:`, streamError);
      }
    }

    const { data: physicalReleases, error: physicalError } = await supabase
      .from('release_formats')
      .select('id, release_id, format_type')
      .in('format_type', ['digital', 'cd', 'vinyl'])
      .gte('release_date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

    if (physicalError) {
      throw physicalError;
    }

    for (const format of physicalReleases || []) {
      if (Math.random() > 0.5) {
        try {
          const quantity = Math.floor(Math.random() * 10) + 1;
          let pricePerUnit = 10;

          if (format.format_type === 'cd') pricePerUnit = 15;
          if (format.format_type === 'vinyl') pricePerUnit = 25;

          const totalAmount = quantity * pricePerUnit;

          const { error: saleError } = await supabase
            .from('release_sales')
            .insert({
              release_format_id: format.id,
              quantity_sold: quantity,
              total_amount: totalAmount,
              sale_date: new Date().toISOString(),
            });

          if (saleError) {
            throw saleError;
          }

          await supabase.rpc('increment_release_revenue', {
            release_id: format.release_id,
            amount: totalAmount,
          });

          salesUpdates++;
        } catch (salesError) {
          errorCount += 1;
          console.error(`Error processing physical sales for format ${format.id}:`, salesError);
        }
      }
    }

    console.log(`Updated ${streamUpdates} streaming releases and generated ${salesUpdates} sales`);

    await completeJobRun({
      jobName: 'update-daily-streams',
      runId,
      supabaseClient: supabase,
      durationMs: Date.now() - startedAt,
      processedCount: streamUpdates + salesUpdates,
      errorCount,
      resultSummary: {
        streamUpdates,
        salesUpdates,
        errorCount,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        streamUpdates,
        salesUpdates,
        errors: errorCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    await failJobRun({
      jobName: 'update-daily-streams',
      runId,
      supabaseClient: supabase,
      durationMs: Date.now() - startedAt,
      error,
      resultSummary: {
        streamUpdates,
        salesUpdates,
        errorCount,
      },
    });

    console.error('Error updating daily streams:', error);
    return new Response(
      JSON.stringify({ error: getErrorMessage(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
