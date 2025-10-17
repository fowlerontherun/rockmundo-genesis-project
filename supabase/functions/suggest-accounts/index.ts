import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting account suggestion refresh...');

    // Clear old suggestions (older than 1 day)
    const { error: deleteError } = await supabase
      .from('twaater_suggested_follows')
      .delete()
      .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (deleteError) {
      console.error('Error clearing old suggestions:', deleteError);
    }

    // Get all active accounts
    const { data: accounts, error: accountsError } = await supabase
      .from('twaater_accounts')
      .select('id, fame_score, owner_type, owner_id')
      .order('fame_score', { ascending: false });

    if (accountsError) throw accountsError;
    if (!accounts || accounts.length === 0) {
      console.log('No accounts found');
      return new Response(JSON.stringify({ suggestions: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let totalSuggestions = 0;

    // For each account, generate suggestions
    for (const account of accounts) {
      // Get accounts this account already follows
      const { data: following } = await supabase
        .from('twaater_follows')
        .select('followed_account_id')
        .eq('follower_account_id', account.id);

      const followingIds = following?.map(f => f.followed_account_id) || [];

      // Find similar accounts by fame score (±500)
      const suggestions = accounts
        .filter(a => 
          a.id !== account.id && 
          !followingIds.includes(a.id) &&
          Math.abs((a.fame_score || 0) - (account.fame_score || 0)) <= 500
        )
        .map(a => ({
          account_id: account.id,
          suggested_account_id: a.id,
          reason: 'similar_fame',
          score: 1 - Math.abs((a.fame_score || 0) - (account.fame_score || 0)) / 500
        }));

      // Get band genre matches for band accounts
      if (account.owner_type === 'band') {
        const { data: accountBand } = await supabase
          .from('bands')
          .select('genre')
          .eq('id', account.owner_id)
          .single();

        if (accountBand?.genre) {
          const { data: similarBands } = await supabase
            .from('bands')
            .select('id')
            .eq('genre', accountBand.genre)
            .neq('id', account.owner_id);

          if (similarBands) {
            for (const band of similarBands) {
              const { data: bandAccount } = await supabase
                .from('twaater_accounts')
                .select('id')
                .eq('owner_type', 'band')
                .eq('owner_id', band.id)
                .single();

              if (bandAccount && !followingIds.includes(bandAccount.id)) {
                suggestions.push({
                  account_id: account.id,
                  suggested_account_id: bandAccount.id,
                  reason: 'same_genre',
                  score: 1.5 // Higher priority for genre matches
                });
              }
            }
          }
        }
      }

      // Find recently active accounts
      const { data: recentTwaats } = await supabase
        .from('twaats')
        .select('account_id')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .neq('account_id', account.id);

      const activeAccountIds = [...new Set(recentTwaats?.map(t => t.account_id) || [])];
      
      for (const activeId of activeAccountIds) {
        if (!followingIds.includes(activeId) && !suggestions.find(s => s.suggested_account_id === activeId)) {
          suggestions.push({
            account_id: account.id,
            suggested_account_id: activeId,
            reason: 'active',
            score: 1.2
          });
        }
      }

      // Sort by score and take top 20
      const topSuggestions = suggestions
        .sort((a, b) => b.score - a.score)
        .slice(0, 20);

      if (topSuggestions.length > 0) {
        const { error: insertError } = await supabase
          .from('twaater_suggested_follows')
          .insert(topSuggestions);

        if (insertError) {
          console.error(`Error inserting suggestions for ${account.id}:`, insertError);
        } else {
          totalSuggestions += topSuggestions.length;
        }
      }
    }

    console.log(`Generated ${totalSuggestions} total suggestions`);

    return new Response(
      JSON.stringify({ success: true, suggestions: totalSuggestions }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in suggest-accounts:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
