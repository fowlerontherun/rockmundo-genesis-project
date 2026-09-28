import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, Download, UploadCloud } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const BUCKET = 'avatar-v2-authoring';
const MAX_BYTES = 50 * 1024 * 1024;

export function AvatarV2AuthoringImport() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [digest, setDigest] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [validating, setValidating] = useState<string | null>(null);
  const [reviews, setReviews] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();
  const { data: archives = [], isLoading } = useQuery({
    queryKey: ['admin-avatar-v2-authoring-archives'],
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(BUCKET).list('incoming', {
        limit: 100, sortBy: { column: 'created_at', order: 'desc' },
      });
      if (error) throw error;
      return data.filter(item => item.name.toLowerCase().endsWith('.zip'));
    },
  });

  async function chooseFile(next: File | null) {
    setFile(next);
    setDigest(null);
    if (!next || next.size > MAX_BYTES) return;
    try {
      const bytes = await next.arrayBuffer();
      const hash = await crypto.subtle.digest('SHA-256', bytes);
      setDigest(Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join(''));
    } catch {
      toast.error('Could not calculate the archive checksum.');
    }
  }

  async function downloadArchive(name: string) {
    setOpening(name);
    try {
      const { data, error } = await supabase.storage.from(BUCKET)
        .createSignedUrl(`incoming/${name}`, 60, { download: name });
      if (error) throw error;
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not open archive');
    } finally {
      setOpening(null);
    }
  }

  async function validateArchive(name: string) {
    setValidating(name);
    try {
      const { data, error } = await supabase.functions.invoke('validate-avatar-v2-authoring', {
        body: { key: `incoming/${name}` },
      });
      if (error || !data?.valid) throw new Error(data?.error ?? error?.message ?? 'Validation failed');
      setReviews(previous => ({ ...previous, [name]: `Source verified: ${data.files} files, 15 models` }));
      toast.success('All source checksums and GLB headers verified. Production QA is still required.');
    } catch (error) {
      setReviews(previous => ({ ...previous, [name]: 'Validation failed' }));
      toast.error(error instanceof Error ? error.message : 'Validation failed');
    } finally {
      setValidating(null);
    }
  }

  async function upload() {
    if (!file || uploading) return;
    if (!file.name.toLowerCase().endsWith('.zip') || file.size > MAX_BYTES || file.size === 0) {
      toast.error('Select a non-empty ZIP archive no larger than 50 MB.');
      return;
    }
    setUploading(true);
    try {
      const header = new Uint8Array(await file.slice(0, 4).arrayBuffer());
      if (header[0] !== 0x50 || header[1] !== 0x4b || header[2] !== 0x03 || header[3] !== 0x04) {
        throw new Error('The selected file is not a standard ZIP archive.');
      }
      const safeName = file.name.replace(/[^a-z0-9._-]/gi, '-');
      const key = `incoming/${crypto.randomUUID()}-${safeName}`;
      const { error } = await supabase.storage.from(BUCKET).upload(key, file, {
        contentType: 'application/zip', upsert: false,
      });
      if (error) throw error;
      setFile(null);
      setDigest(null);
      await queryClient.invalidateQueries({ queryKey: ['admin-avatar-v2-authoring-archives'] });
      toast.success('Archive uploaded to private authoring intake. Not published to the game.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Archive className="h-5 w-5" /> Import Avatar V2 assets</CardTitle>
        <CardDescription>
          Upload the combined RockMundo authoring ZIP here. Files stay in private admin storage;
          they are not extracted, rigged, certified, or added to the live clothing catalogue.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Input aria-label="Choose Avatar V2 authoring ZIP" type="file" accept=".zip,application/zip"
            className="max-w-md" disabled={uploading}
            onChange={event => void chooseFile(event.target.files?.[0] ?? null)} />
          <Button disabled={!file || uploading} onClick={upload}>
            <UploadCloud className="mr-2 h-4 w-4" />
            {uploading ? 'Uploading…' : 'Upload authoring ZIP'}
          </Button>
        </div>
        {file && <div className="space-y-1 text-sm text-muted-foreground"><p>Selected: {file.name} ({(file.size / 1048576).toFixed(1)} MB)</p>{digest && <p className="break-all font-mono text-xs">Local SHA-256: {digest}</p>}</div>}
        <div className="space-y-2">
          <p className="font-medium">Uploaded archives {isLoading ? '(loading)' : `(${archives.length})`}</p>
          {archives.map(archive => (
            <div key={archive.name} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
              <span className="break-all">{archive.name}</span>
              <div className="flex flex-wrap items-center gap-2"><Badge variant={reviews[archive.name]?.startsWith("Source verified") ? "default" : "secondary"}>{reviews[archive.name] ?? "Awaiting source validation"}</Badge><Button size="sm" variant="outline" disabled={validating === archive.name} onClick={() => void validateArchive(archive.name)}>{validating === archive.name ? "Validating…" : "Validate bundle"}</Button><Button size="sm" variant="outline" disabled={opening === archive.name} onClick={() => void downloadArchive(archive.name)}><Download className="mr-1 h-4 w-4" /> Download</Button></div>
            </div>
          ))}
          {!isLoading && !archives.length && <p className="text-sm text-muted-foreground">No archives uploaded yet.</p>}
        </div>
      </CardContent>
    </Card>
  );
}
