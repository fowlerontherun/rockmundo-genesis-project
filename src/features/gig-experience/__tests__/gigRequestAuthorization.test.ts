import { describe, expect, it, vi } from 'vitest';
import { authorizeGigRequest, type GigAccessClient } from '../../../../supabase/functions/_shared/authorize-gig-request';

const GIG_ID = '11111111-1111-4111-8111-111111111111';
const SECRET = 'server-only-service-role-key';
const HEADERS = { 'Access-Control-Allow-Origin': '*' };
const request = (bearer: string | null, method = 'POST') => new Request('https://rockmundo.test/functions/v1/process-gig-song', {
  method, headers: bearer ? { Authorization: `Bearer ${bearer}` } : {},
});

function client(options: { validUser?: boolean; activeMember?: boolean; gigExists?: boolean; authFails?: boolean } = {}) {
  const getUser = vi.fn(async (_token: string) => ({
    data: { user: options.validUser ? { id: 'user-123' } : null },
    error: options.authFails ? { message: 'Auth unavailable' } : null,
  }));
  const reads: string[] = [];
  const from = vi.fn((table: string) => {
    reads.push(table);
    const query = {
      select: (_cols: string) => query,
      eq: (_column: string, _value: string) => query,
      maybeSingle: async () => table === 'gigs'
        ? { data: options.gigExists === false ? null : { band_id: 'band-123' }, error: null }
        : { data: options.activeMember ? { id: 'member-123' } : null, error: null },
    };
    return query;
  });
  return { client: { auth: { getUser }, from } as unknown as GigAccessClient, getUser, from, reads };
}

describe('gig request authorisation boundary', () => {
  it('rejects requests without a bearer or with invalid gig IDs', async () => {
    const c = client();
    expect((await authorizeGigRequest(request(null), c.client, GIG_ID, HEADERS, SECRET))?.status).toBe(401);
    expect((await authorizeGigRequest(request('user-token'), c.client, 'not-a-uuid', HEADERS, SECRET))?.status).toBe(400);
    expect((await authorizeGigRequest(request('user-token', 'GET'), c.client, GIG_ID, HEADERS, SECRET))?.status).toBe(405);
    expect(c.from).not.toHaveBeenCalled();
  });

  it('does not accept an anonymous/publishable API key or an unavailable identity provider', async () => {
    const c = client({ authFails: true });
    expect((await authorizeGigRequest(request('public-key'), c.client, GIG_ID, HEADERS, SECRET))?.status).toBe(401);
    expect(c.from).not.toHaveBeenCalled();
  });

  it('allows exact service-to-service credentials without pretending they are user identities', async () => {
    const c = client();
    expect(await authorizeGigRequest(request(SECRET), c.client, GIG_ID, HEADERS, SECRET)).toBeNull();
    expect(c.getUser).not.toHaveBeenCalled();
    expect(c.from).not.toHaveBeenCalled();
  });

  it('rejects unrelated and inactive band members even with a valid session', async () => {
    const unrelated = client({ validUser: true, activeMember: false });
    expect((await authorizeGigRequest(request('valid-user'), unrelated.client, GIG_ID, HEADERS, SECRET))?.status).toBe(403);
    expect(unrelated.reads).toEqual(['gigs', 'band_members']);

    const missingGig = client({ validUser: true, gigExists: false, activeMember: true });
    expect((await authorizeGigRequest(request('valid-user'), missingGig.client, GIG_ID, HEADERS, SECRET))?.status).toBe(403);
  });

  it('allows a verified member of the gig band', async () => {
    const c = client({ validUser: true, activeMember: true });
    expect(await authorizeGigRequest(request('valid-user'), c.client, GIG_ID, HEADERS, SECRET)).toBeNull();
    expect(c.getUser).toHaveBeenCalledWith('valid-user');
    expect(c.from).toHaveBeenCalledWith('band_members');
  });
});
