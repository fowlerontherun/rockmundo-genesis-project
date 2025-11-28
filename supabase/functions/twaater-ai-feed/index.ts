import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { account_id } = await req.json()
    
    if (!account_id) {
      return new Response(
        JSON.stringify({ error: 'account_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Fetch account preferences and interaction history
    const { data: preferences } = await supabase
      .from('twaater_ai_preferences')
      .select('*')
      .eq('account_id', account_id)
      .maybeSingle()

    // Fetch user's following list
    const { data: follows } = await supabase
      .from('twaater_follows')
      .select('followed_account_id, weight')
      .eq('follower_account_id', account_id)

    const followedIds = follows?.map(f => f.followed_account_id) || []

    // Fetch recent twaats from followed accounts and popular accounts
    const { data: twaats } = await supabase
      .from('twaats')
      .select(`
        id,
        body,
        account_id,
        created_at,
        linked_type,
        linked_id,
        account:twaater_accounts(id, handle, display_name, verified, fame_score, owner_type),
        metrics:twaat_metrics(likes, replies, retwaats, impressions)
      `)
      .is('deleted_at', null)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(200)

    if (!twaats || twaats.length === 0) {
      return new Response(
        JSON.stringify({ ranked_feed: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Build context for AI ranking
    const context = {
      preferences: preferences || { preferred_genres: [], interaction_history: {} },
      following: followedIds.length,
      twaats_summary: twaats.slice(0, 50).map(t => ({
        id: t.id,
        is_followed: followedIds.includes(t.account_id),
        fame_score: (t.account as any).fame_score || 0,
        verified: (t.account as any).verified || false,
        engagement: (t.metrics as any)?.likes + (t.metrics as any)?.replies * 2 + (t.metrics as any)?.retwaats * 3 || 0,
        has_link: !!t.linked_type,
        hours_old: (Date.now() - new Date(t.created_at).getTime()) / (1000 * 60 * 60),
      }))
    }

    // Call Lovable AI for intelligent ranking
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are an expert social media feed algorithm. Rank twaats based on relevance, engagement, and user preferences. Consider:
1. Posts from followed accounts (higher priority)
2. High engagement posts (likes, replies, retwaa

ts)
3. Verified and high-fame accounts
4. Posts with linked content (gigs, songs)
5. Recency (balance fresh content with quality)

Return ONLY a JSON array of twaat IDs in ranked order from most to least relevant.`
          },
          {
            role: 'user',
            content: `User follows ${context.following} accounts. Rank these ${context.twaats_summary.length} twaats:\n${JSON.stringify(context.twaats_summary)}`
          }
        ],
        temperature: 0.3,
      }),
    })

    if (!aiResponse.ok) {
      console.error('AI API error:', aiResponse.status)
      // Fallback to simple algorithm
      const ranked = twaats
        .sort((a, b) => {
          const scoreA = (followedIds.includes(a.account_id) ? 100 : 0) +
                        ((a.metrics as any)?.likes || 0) * 1 +
                        ((a.metrics as any)?.replies || 0) * 2 +
                        ((a.metrics as any)?.retwaats || 0) * 3 +
                        ((a.account as any).verified ? 50 : 0)
          const scoreB = (followedIds.includes(b.account_id) ? 100 : 0) +
                        ((b.metrics as any)?.likes || 0) * 1 +
                        ((b.metrics as any)?.replies || 0) * 2 +
                        ((b.metrics as any)?.retwaats || 0) * 3 +
                        ((b.account as any).verified ? 50 : 0)
          return scoreB - scoreA
        })
        .slice(0, 50)

      return new Response(
        JSON.stringify({ ranked_feed: ranked }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const aiData = await aiResponse.json()
    const rankedIds = JSON.parse(aiData.choices[0].message.content)

    // Map ranked IDs back to full twaat objects
    const twaatMap = new Map(twaats.map(t => [t.id, t]))
    const rankedFeed = rankedIds
      .map((id: string) => twaatMap.get(id))
      .filter((t: any) => t)
      .slice(0, 50)

    // Update interaction history (async, don't await)
    if (preferences) {
      const newHistory = {
        ...(preferences.interaction_history || {}),
        last_feed_generated: new Date().toISOString(),
      }
      supabase
        .from('twaater_ai_preferences')
        .update({ 
          interaction_history: newHistory,
          last_updated: new Date().toISOString()
        })
        .eq('account_id', account_id)
        .then()
    }

    return new Response(
      JSON.stringify({ ranked_feed: rankedFeed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in AI feed:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
