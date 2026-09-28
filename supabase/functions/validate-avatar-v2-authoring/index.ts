import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { unzipSync } from 'npm:fflate@0.8.2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const BUCKET = 'avatar-v2-authoring';
const ROOT = 'rockmundo_v2_authoring_import/';
const COUNTS: Record<string, number> = { tee: 4, denim: 3, footwear: 4, punk: 4 };
const hex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');

serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { ...cors, 'Content-Type': 'application/json' },
  });
  if (req.method !== 'POST') return respond({ error: 'POST required' }, 405);
  try {
    const auth = req.headers.get('Authorization');
    if (!auth) return respond({ error: 'Authentication required' }, 401);
    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const { data: identity, error: identityError } = await userClient.auth.getUser();
    if (identityError || !identity.user) return respond({ error: 'Authentication required' }, 401);
    const { key, extract = false } = await req.json();
    if (typeof extract !== 'boolean') return respond({ error: 'Invalid extraction flag' }, 400);
    if (typeof key !== 'string' || !/^incoming\/[a-f0-9-]{36}-[a-zA-Z0-9._-]+\.zip$/.test(key)) {
      return respond({ error: 'Invalid intake archive key' }, 400);
    }
    // The bucket's SELECT policy is admin-only; use the caller's JWT, never service-role bypass.
    const { data: blob, error: downloadError } = await userClient.storage.from(BUCKET).download(key);
    if (downloadError || !blob) return respond({ error: 'Archive not found or admin access denied' }, 403);
    if (blob.size > 50 * 1024 * 1024) return respond({ error: 'Archive exceeds 50 MB' }, 400);
    const archiveBytes = new Uint8Array(await blob.arrayBuffer());
    const archiveSha256 = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', archiveBytes)));
    // Cap total expanded payload and member count before extracting or persisting.
    const zip = unzipSync(archiveBytes);
    if (Object.keys(zip).length > 80 || Object.values(zip).reduce((sum, bytes) => sum + bytes.byteLength, 0) > 100 * 1024 * 1024) {
      return respond({ error: 'Archive expands beyond safe intake limits' }, 400);
    }
    const names = Object.keys(zip).filter(name => !name.endsWith('/'));
    if (!names.includes(ROOT + 'CHECKSUMS.json')) return respond({ error: 'This is not the combined authoring bundle' }, 400);
    if (names.some(name => !name.startsWith(ROOT) || name.split('/').some(part => part === '..' || part === '.') || name.includes('\\'))) {
      return respond({ error: 'Unexpected or unsafe archive paths' }, 400);
    }
    const checksums: unknown = JSON.parse(new TextDecoder().decode(zip[ROOT + 'CHECKSUMS.json']));
    if (!Array.isArray(checksums) || checksums.length !== 38) {
      return respond({ error: 'Expected a manifest with 38 source files' }, 400);
    }
    const listed = new Set<string>();
    const counts: Record<string, number> = { tee: 0, denim: 0, footwear: 0, punk: 0 };
    for (const entry of checksums) {
      if (!entry || typeof entry.path !== 'string' || typeof entry.sha256 !== 'string' ||
          !/^assets\/(tee|denim|footwear|punk)\/[a-zA-Z0-9._/-]+$/.test(entry.path) ||
          listed.has(entry.path)) return respond({ error: 'Invalid or duplicate manifest path' }, 400);
      listed.add(entry.path);
      const bytes = zip[ROOT + entry.path];
      if (!bytes || bytes.length !== entry.size) return respond({ error: 'Missing or incorrect file size', file: entry.path }, 400);
      const digest = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
      if (digest !== entry.sha256) return respond({ error: 'Checksum mismatch', file: entry.path }, 400);
      if (entry.path.endsWith('.glb')) {
        const group = entry.path.split('/')[1];
        counts[group]++;
        if (bytes.length < 12 || new TextDecoder().decode(bytes.subarray(0, 4)) !== 'glTF' ||
            new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(4, true) !== 2 ||
            new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(8, true) !== bytes.length) {
          return respond({ error: 'Invalid GLB header', file: entry.path }, 400);
        }
      }
    }
    if (names.some(name => name.startsWith(ROOT + 'assets/') && name.slice(ROOT.length).split('/').some(segment => segment === '.' || segment === '..')) ||
        Object.keys(counts).some(group => counts[group] !== COUNTS[group]) ||
        names.some(name => name.startsWith(ROOT + 'assets/') && !listed.has(name.slice(ROOT.length)))) {
      return respond({ error: 'Unexpected source inventory' }, 400);
    }
    // Private source review only. This never modifies clothing, manifests, or runtime assets.
    const writer = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: previousReview } = await writer.from('avatar_v2_authoring_reviews')
      .select('status,archive_sha256').eq('storage_key', key).maybeSingle();
    const alreadyStaged = previousReview?.status === 'staged_for_review' && previousReview.archive_sha256 === archiveSha256;
    const { error: reviewError } = await writer.from('avatar_v2_authoring_reviews').upsert({
      storage_key: key, archive_sha256: archiveSha256, status: alreadyStaged ? 'staged_for_review' : 'source_verified',
      source_file_count: listed.size, glb_model_count: Object.values(counts).reduce((a, b) => a + b, 0),
      validated_by: identity.user.id, validated_at: new Date().toISOString(),
    }, { onConflict: 'storage_key' });
    if (reviewError) return respond({ error: 'Source verified but review could not be saved' }, 500);
    if (extract) {
      const prefix = `reviewed/${archiveSha256}/`;
      // An immutable content-addressed destination keeps repeat imports idempotent.
      for (const sourcePath of listed) {
        const bytes = zip[ROOT + sourcePath];
        const contentType = sourcePath.endsWith('.glb') ? 'model/gltf-binary'
          : sourcePath.endsWith('.png') ? 'image/png'
          : sourcePath.endsWith('.json') ? 'application/json' : 'text/plain';
        const { error } = await writer.storage.from(BUCKET).upload(prefix + sourcePath, bytes, {
          contentType, upsert: false,
        });
        if (error && !/already exists|duplicate/i.test(error.message)) {
          return respond({ error: 'Verified archive but staging failed; retry is safe', file: sourcePath }, 500);
        }
      }
    }
    return respond({ valid: true, files: listed.size, models: counts, archiveSha256,
      extracted: extract, status: extract ? 'staged-for-artist-review' : 'source-verified-not-production-ready' });
  } catch (error) {
    return respond({ error: error instanceof Error ? error.message : 'Validation failed' }, 400);
  }
});
