// Both browser-driven and service-driven gig work uses this same gate.
// Never trust client-supplied role flags, gig ownership, or a caller's API key.
// A backend function invokes downstream functions with the service-role bearer;
// browser requests must independently prove band membership.
export type GigAccessClient = {
  auth: { getUser: (token: string) => Promise<{ data: { user: { id: string } | null }; error: unknown }> };
  // The service-role client executes these narrow read queries only.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

function reject(message: string, status: number, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Return null only for a trusted internal invocation or an active band member. */
export async function authorizeGigRequest(
  req: Request,
  client: GigAccessClient,
  gigId: unknown,
  corsHeaders: Record<string, string>,
  serviceRoleKey: string | undefined,
): Promise<Response | null> {
  if (req.method !== 'POST') return reject('Method not allowed', 405, corsHeaders);
  if (typeof gigId !== 'string' || !UUID.test(gigId)) {
    return reject('Invalid gig identifier', 400, corsHeaders);
  }

  const bearer = /^Bearer\s+([^\s]+)$/i.exec(req.headers.get('Authorization') ?? '')?.[1];
  if (!bearer) return reject('Unauthorized', 401, corsHeaders);

  // Supabase server-to-server function calls use this exact bearer value.
  // No request body flag or publicly available anon/publishable key is trusted.
  if (serviceRoleKey && bearer === serviceRoleKey) return null;

  let userId: string | undefined;
  try {
    const { data, error } = await client.auth.getUser(bearer);
    if (!error) userId = data?.user?.id;
  } catch {
    // A failed Auth lookup must always fail closed.
  }
  if (!userId) return reject('Unauthorized', 401, corsHeaders);

  try {
    const { data: gig, error: gigError } = await client.from('gigs')
      .select('band_id').eq('id', gigId).maybeSingle();
    if (gigError || !gig?.band_id) return reject('Forbidden', 403, corsHeaders);
    const { data: member, error: memberError } = await client.from('band_members')
      .select('id').eq('band_id', gig.band_id).eq('user_id', userId)
      .eq('member_status', 'active').maybeSingle();
    if (memberError || !member?.id) return reject('Forbidden', 403, corsHeaders);
  } catch {
    return reject('Forbidden', 403, corsHeaders);
  }
  return null;
}
