# Festival projection RPC binding fix

The edition-scoped Festival projection repository stored `supabase.rpc` as a detached function reference. In the browser this can fail before any HTTP request is sent, which left Line-up and Tickets & budget in their generic unavailable states even though the corresponding database projections were healthy.

The repository now binds `rpc` to the Supabase client before using the shared typed wrapper. This preserves the existing projection API while ensuring edition site, ticket, line-up and artist action RPC calls reach Supabase.
