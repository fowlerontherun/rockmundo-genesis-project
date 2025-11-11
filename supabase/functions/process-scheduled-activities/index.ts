import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScheduledActivity {
  id: string;
  user_id: string;
  activity_type: string;
  scheduled_start: string;
  scheduled_end: string;
  status: string;
  metadata: any;
  linked_gig_id?: string;
  linked_rehearsal_id?: string;
  linked_recording_id?: string;
  linked_job_shift_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date().toISOString();
    let processedCount = 0;
    let startedCount = 0;
    let completedCount = 0;

    // 1. Auto-start activities that should have started
    const { data: toStart, error: startError } = await supabase
      .from('player_scheduled_activities')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_start', now)
      .gt('scheduled_end', now);

    if (startError) throw startError;

    for (const activity of toStart || []) {
      console.log(`Starting activity ${activity.id}: ${activity.title}`);
      
      // Update to in_progress
      await supabase
        .from('player_scheduled_activities')
        .update({ 
          status: 'in_progress',
          started_at: now 
        })
        .eq('id', activity.id);

      startedCount++;
    }

    // 2. Complete activities that have ended
    const { data: toComplete, error: completeError } = await supabase
      .from('player_scheduled_activities')
      .select('*')
      .eq('status', 'in_progress')
      .lte('scheduled_end', now);

    if (completeError) throw completeError;

    for (const activity of toComplete || []) {
      console.log(`Completing activity ${activity.id}: ${activity.title}`);
      
      try {
        // Process the activity based on type
        await processActivityCompletion(supabase, activity);
        
        // Mark as completed
        await supabase
          .from('player_scheduled_activities')
          .update({ 
            status: 'completed',
            completed_at: now 
          })
          .eq('id', activity.id);

        completedCount++;
      } catch (error) {
        console.error(`Error processing activity ${activity.id}:`, error);
        // Mark as missed if processing fails
        await supabase
          .from('player_scheduled_activities')
          .update({ status: 'missed' })
          .eq('id', activity.id);
      }
    }

    // 3. Mark missed activities (scheduled time passed but never started)
    const { data: toMiss } = await supabase
      .from('player_scheduled_activities')
      .select('id')
      .eq('status', 'scheduled')
      .lt('scheduled_end', now);

    if (toMiss && toMiss.length > 0) {
      await supabase
        .from('player_scheduled_activities')
        .update({ status: 'missed' })
        .in('id', toMiss.map(a => a.id));
    }

    processedCount = startedCount + completedCount;

    return new Response(
      JSON.stringify({ 
        success: true, 
        processedCount,
        startedCount,
        completedCount,
        missedCount: toMiss?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing scheduled activities:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function processActivityCompletion(supabase: any, activity: ScheduledActivity) {
  const duration = (new Date(activity.scheduled_end).getTime() - new Date(activity.scheduled_start).getTime()) / (1000 * 60 * 60);
  
  switch (activity.activity_type) {
    case 'gig':
      if (activity.linked_gig_id) {
        // Trigger gig completion
        await supabase.functions.invoke('complete-gig', {
          body: { gigId: activity.linked_gig_id }
        });
      }
      break;

    case 'rehearsal':
      if (activity.linked_rehearsal_id) {
        // Complete rehearsal
        await supabase.functions.invoke('complete-rehearsals');
      }
      break;

    case 'recording':
      if (activity.linked_recording_id) {
        // Complete recording session
        await supabase.functions.invoke('complete-recording-sessions');
      }
      break;

    case 'work':
      if (activity.linked_job_shift_id) {
        // Clock out from shift
        await supabase.functions.invoke('shift-clock-out');
      }
      break;

    case 'university':
      // Process university attendance
      await supabase.functions.invoke('university-attendance');
      break;

    case 'reading':
      // Process book reading
      await supabase.functions.invoke('book-reading-attendance');
      break;

    case 'songwriting':
      // Auto-complete songwriting session
      await supabase.functions.invoke('cleanup-songwriting');
      break;

    case 'health':
      // Award health restoration
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, health')
        .eq('user_id', activity.user_id)
        .single();

      if (profile) {
        const healthGain = Math.min(20 * duration, 100 - (profile.health || 0));
        await supabase
          .from('profiles')
          .update({ health: (profile.health || 0) + healthGain })
          .eq('id', profile.id);
      }
      break;

    default:
      console.log(`No specific processing for activity type: ${activity.activity_type}`);
  }
}