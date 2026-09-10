import { useRef, useState } from 'react';
import { Download, FileJson, Upload, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  browserDownloadJson,
  parsePortableBundle,
  toPortableBundle,
  validatePortableItem,
  type PortableClothingBundle,
  type PortableClothingItem,
} from '@/features/clothing-transfer/clothingTransfer';

type Strategy = 'skip' | 'update' | 'copy';

interface Props {
  collectionId: string;
  collection?: { id?: string; name?: string | null; theme?: string | null } | null;
  items: Array<Record<string, any>>;
  onChanged?: () => void;
}

interface ReviewRow {
  entry: PortableClothingItem;
  errors: string[];
  duplicateId?: string;
}

export function ClothingTransferPanel({ collectionId, collection, items, onChanged }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [bundle, setBundle] = useState<PortableClothingBundle | null>(null);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [strategy, setStrategy] = useState<Strategy>('skip');
  const [importing, setImporting] = useState(false);

  const exportCollection = async () => {
    const portable = toPortableBundle(items, { id: collectionId, name: collection?.name, theme: collection?.theme });
    const safeName = (collection?.name || 'skin-collection').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    browserDownloadJson(`rockmundo-${safeName || 'skin-collection'}.json`, portable);
    await (supabase.from('admin_clothing_transfer_audit' as any) as any).insert({
      action_type: 'export', collection_id: collectionId, item_count: items.length,
      result_summary: { schema_version: portable.schemaVersion, mode: 'collection' },
    });
    toast.success(`Exported ${items.length} clothing item${items.length === 1 ? '' : 's'}`);
  };

  const readFile = async (file: File) => {
    try {
      const parsed = parsePortableBundle(await file.text());
      const keys = parsed.items.map(entry => entry.externalKey).filter(Boolean);
      const { data: existing, error } = keys.length
        ? await (supabase.from('avatar_clothing_items') as any).select('id,external_key,name').in('external_key', keys)
        : { data: [], error: null } as any;
      if (error) throw error;
      const byKey = new Map((existing || []).map((row: any) => [row.external_key, row.id]));
      const review = parsed.items.map(entry => ({ entry, errors: validatePortableItem(entry), duplicateId: byKey.get(entry.externalKey) as string | undefined }));
      setBundle(parsed);
      setRows(review);
      toast.success(`Loaded ${review.length} item${review.length === 1 ? '' : 's'} for review`);
    } catch (error: any) {
      setBundle(null); setRows([]);
      toast.error(error?.message || 'Could not read clothing import file');
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const importBundle = async () => {
    if (!bundle || rows.length === 0) return;
    if (rows.some(row => row.errors.length)) {
      toast.error('Fix the invalid entries before importing.');
      return;
    }
    setImporting(true);
    const batchId = crypto.randomUUID();
    let created = 0, updated = 0, skipped = 0, failed = 0;
    try {
      for (const row of rows) {
        try {
          if (row.duplicateId && strategy === 'skip') { skipped++; continue; }
          const payload: Record<string, unknown> = {
            ...row.entry.item,
            collection_id: collectionId,
            schema_version: row.entry.schemaVersion || 1,
            import_source: bundle.collection?.name || 'file import',
            import_batch_id: batchId,
            external_key: strategy === 'copy' && row.duplicateId ? `${row.entry.externalKey}.copy.${crypto.randomUUID().slice(0, 8)}` : row.entry.externalKey,
            preview_status: 'ready',
          };
          delete (payload as any).id;
          if (row.duplicateId && strategy === 'update') {
            const { error } = await (supabase.from('avatar_clothing_items') as any).update(payload).eq('id', row.duplicateId);
            if (error) throw error;
            updated++;
          } else {
            const { error } = await (supabase.from('avatar_clothing_items') as any).insert(payload);
            if (error) throw error;
            created++;
          }
        } catch (error) {
          console.error('[clothing-import] item failed', row.entry.externalKey, error);
          failed++;
        }
      }
      await (supabase.from('admin_clothing_transfer_audit' as any) as any).insert({
        action_type: 'import', batch_id: batchId, collection_id: collectionId, item_count: rows.length,
        result_summary: { created, updated, skipped, failed, strategy, schema_version: bundle.schemaVersion },
      });
      toast.success(`Import complete: ${created} created, ${updated} updated, ${skipped} skipped${failed ? `, ${failed} failed` : ''}`);
      setBundle(null); setRows([]); onChanged?.();
    } finally {
      setImporting(false);
    }
  };

  const duplicates = rows.filter(row => row.duplicateId).length;
  const invalid = rows.filter(row => row.errors.length).length;

  return <Card>
    <CardHeader className="pb-3">
      <CardTitle className="text-base flex items-center gap-2"><FileJson className="h-4 w-4" />Import / Export</CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      <p className="text-sm text-muted-foreground">Move detailed garments between RockMundo environments using a versioned JSON file. Rich materials, layers, variants, render metadata and gameplay bonuses are preserved.</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={exportCollection} disabled={!items.length}><Download className="h-4 w-4 mr-2" />Export collection</Button>
        <Button type="button" variant="outline" onClick={() => fileInput.current?.click()}><Upload className="h-4 w-4 mr-2" />Import file</Button>
        <input ref={fileInput} type="file" accept="application/json,.json" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) void readFile(file); }} />
      </div>

      {bundle && <div className="rounded-lg border p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="secondary">{rows.length} items</Badge>
          {duplicates > 0 && <Badge variant="outline">{duplicates} duplicates</Badge>}
          {invalid > 0 ? <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />{invalid} invalid</Badge> : <Badge variant="outline"><CheckCircle2 className="h-3 w-3 mr-1" />Validated</Badge>}
        </div>
        <div className="max-h-44 overflow-y-auto rounded border divide-y text-sm">
          {rows.map((row, index) => <div key={`${row.entry.externalKey}-${index}`} className="p-2 flex items-start justify-between gap-3">
            <div><div className="font-medium">{String(row.entry.item.name || 'Unnamed item')}</div><div className="text-xs text-muted-foreground">{row.entry.externalKey}</div>{row.errors.length > 0 && <div className="text-xs text-destructive mt-1">{row.errors.join(' · ')}</div>}</div>
            <Badge variant={row.errors.length ? 'destructive' : row.duplicateId ? 'secondary' : 'outline'}>{row.errors.length ? 'Invalid' : row.duplicateId ? 'Duplicate' : 'New'}</Badge>
          </div>)}
        </div>
        {duplicates > 0 && <div className="space-y-1"><div className="text-xs font-medium">Duplicate handling</div><Select value={strategy} onValueChange={value => setStrategy(value as Strategy)}><SelectTrigger className="w-full sm:w-72"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="skip">Skip existing items</SelectItem><SelectItem value="update">Update by external key</SelectItem><SelectItem value="copy">Import as new copies</SelectItem></SelectContent></Select></div>}
        <div className="flex gap-2"><Button type="button" onClick={importBundle} disabled={importing || invalid > 0}>{importing ? 'Importing…' : 'Import validated items'}</Button><Button type="button" variant="ghost" onClick={() => { setBundle(null); setRows([]); }}>Cancel</Button></div>
      </div>}
    </CardContent>
  </Card>;
}
