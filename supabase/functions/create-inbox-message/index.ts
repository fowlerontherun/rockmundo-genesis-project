import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export type InboxCategory = 
  | 'random_event' 
  | 'gig_result' 
  | 'pr_media' 
  | 'record_label' 
  | 'sponsorship' 
  | 'financial' 
  | 'social' 
  | 'achievement' 
  | 'system';

export type InboxPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface CreateInboxMessageParams {
  user_id: string;
  category: InboxCategory;
  priority?: InboxPriority;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  action_type?: 'navigate' | 'accept_decline' | 'view_details' | null;
  action_data?: Record<string, unknown>;
  related_entity_type?: string;
  related_entity_id?: string;
  expires_at?: string;
}

// Helper function that can be called from other edge functions
export async function createInboxMessage(
  supabase: ReturnType<typeof createClient>,
  params: CreateInboxMessageParams
) {
  const { error } = await supabase.from("player_inbox").insert({
    user_id: params.user_id,
    category: params.category,
    priority: params.priority || 'normal',
    title: params.title,
    message: params.message,
    metadata: params.metadata || {},
    action_type: params.action_type || null,
    action_data: params.action_data || null,
    related_entity_type: params.related_entity_type || null,
    related_entity_id: params.related_entity_id || null,
    expires_at: params.expires_at || null,
  });

  if (error) {
    console.error("[create-inbox-message] Error creating message:", error);
    throw error;
  }

  return { success: true };
}

// HTTP endpoint for direct calls
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const params: CreateInboxMessageParams = await req.json();

    if (!params.user_id || !params.category || !params.title || !params.message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: user_id, category, title, message" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await createInboxMessage(supabase, params);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[create-inbox-message] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
