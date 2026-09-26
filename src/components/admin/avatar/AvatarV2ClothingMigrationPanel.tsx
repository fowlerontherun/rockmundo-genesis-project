import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ClipboardList, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { ClothingItem, SkinCollection } from '@/hooks/useSkinStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  auditAvatarV2ClothingCatalog, type ClothingMigrationWave,
} from '@/features/player-model/v2/avatarV2ClothingMigrationAudit';

const WAVES: Array<{ key: ClothingMigrationWave | 'all'; label: string }> = [
  { key: 'all', label: 'All existing items' },
  { key: '1-published', label: '1 · Published items' },
  { key: '2-blocked', label: '2 · Blocked curated items' },
  { key: '3-legacy', label: '3 · Owned legacy compatibility' },
  { key: '4-unreleased', label: '4 · Unreleased catalogue' },
];

async function allExistingItems(): Promise<ClothingItem[]> {
  // Admin-only audit: do not truncate later when new skin packs take the
  // catalogue beyond the default PostgREST page limit.
  const result: ClothingItem[] = [];
  for (let start = 0; start < 20000; start += 500) {
    const { data, error } = await supabase.from('avatar_clothing_items')
      .select('*').order('id').range(start, start + 499);
    if (error) throw error;
    result.push(...(data as ClothingItem[] ?? []));
    if (!data || data.length < 500) return result;
  }
  throw new Error('Clothing audit exceeded 20,000 rows. Narrow the audit safely before continuing.');
}

/** Does not write to the live catalogue, purchases, inventory or release flags. */
export function AvatarV2ClothingMigrationPanel({
  collections,
}: {
  collections: Pick<SkinCollection, 'id' | 'name'>[];
}) {
  const [wave, setWave] = useState<ClothingMigrationWave | 'all'>('all');
  const [showAll, setShowAll] = useState(false);
  const { data: items, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['admin-avatar-v2-clothing-migration-inventory'],
    queryFn: allExistingItems,
    staleTime: 60_000,
  });
  const report = useMemo(() =>
    items ? auditAvatarV2ClothingCatalog(items, collections) : null,
  [items, collections]);
  const filtered = report?.rows.filter(item => wave === 'all' || item.wave === wave) ?? [];
  const displayed = showAll ? filtered : filtered.slice(0, 24);

  return (
    <Card className="border-cyan-600/40">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" /> Existing clothing → Avatar V2 migration
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Live, read-only inventory of every original item, current pack,
              preview and future V2 mapping. No purchases, prices or bonuses are changed.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline"><ShieldCheck className="mr-1 h-3 w-3" />V1 ownership protected</Badge>
            <Button type="button" variant="outline" size="sm" disabled={isFetching}
              onClick={() => { void refetch(); }}>
              {isFetching ? 'Refreshing…' : 'Refresh inventory'}
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          This is migration planning, not a V2 production certification. A validated
          database mapping alone does not prove that GLBs exist or have passed 3D QA.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {isLoading && <p role="status">Auditing the full existing clothing catalogue…</p>}
        {isError && (
          <p role="alert" className="rounded-lg border border-destructive p-3 text-sm text-destructive">
            Clothing inventory could not be read: {error instanceof Error ? error.message : 'Unknown error'}.
            No inventory totals are inferred.
          </p>
        )}
        {report && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: 'Existing items', count: report.total, detail: `${report.legacy} legacy / ${report.blocked} blocked` },
                { label: 'Published / player-facing', count: report.published, detail: `${report.publishedMissingV2} still missing complete V2 mappings` },
                { label: 'Published with pending previews', count: report.publishedPendingPreviews, detail: 'Review proof generation and preview metadata' },
                { label: 'V2 mapping metadata complete', count: report.v2MappingComplete, detail: `${report.v2Mapped} mapped / ${report.unassigned} unassigned to a pack` },
              ].map(tile => (
                <div key={tile.label} className="rounded-xl border bg-muted/30 p-4">
                  <div className="text-2xl font-bold tabular-nums">{tile.count}</div>
                  <div className="mt-1 text-sm font-medium">{tile.label}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{tile.detail}</p>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              {report.existingBonuses} items currently have bonuses enabled. Their
              existing values, purchase IDs, chosen variants and equipped state
              must carry over unchanged as artwork is upgraded.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {report.byCollection.map(collection => (
                <div key={collection.id} className="rounded-lg border p-3 text-sm">
                  <div className="font-semibold">{collection.name}</div>
                  <p className="mt-1 text-muted-foreground">
                    {collection.total} existing · {collection.published} published · {collection.blocked} blocked
                    · {collection.v2MappingComplete} V2 mapping-complete
                  </p>
                  <Link className="mt-2 inline-flex items-center gap-1 text-primary underline underline-offset-4"
                    to={`/admin/skin-collections/${collection.id}/items`}>
                    Review existing items <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold">Migration work queue</h3>
                <label className="flex items-center gap-2 text-sm">
                  <span>Wave</span>
                  <select className="rounded-md border bg-background p-2"
                    aria-label="Migration wave" value={wave}
                    onChange={event => { setWave(event.target.value as ClothingMigrationWave | 'all'); setShowAll(false); }}>
                    {WAVES.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
                  </select>
                </label>
              </div>
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="border-b bg-muted/40">
                    <tr>
                      <th scope="col" className="p-3">Existing item</th>
                      <th scope="col" className="p-3">Collection</th>
                      <th scope="col" className="p-3">Current status</th>
                      <th scope="col" className="p-3">V2 status</th>
                      <th scope="col" className="p-3">Migration blockers</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayed.map(item => (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="p-3">
                          <div className="font-medium">{item.name}</div>
                          <div className="max-w-[240px] break-all text-xs text-muted-foreground">{item.key ?? 'No stable curated key'}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {item.slot} · {item.hasBonuses ? 'preserve existing bonus' : 'no enabled bonus'}
                          </div>
                        </td>
                        <td className="p-3">{item.collectionName}</td>
                        <td className="p-3">
                          <Badge variant={item.curatedStatus === 'blocked' ? 'destructive' : 'outline'}>
                            {item.curatedStatus}
                          </Badge>
                          <p className="mt-1 text-xs text-muted-foreground">Preview: {item.previewStatus}</p>
                        </td>
                        <td className="p-3">
                          <Badge variant={item.v2MappingComplete ? 'default' : 'secondary'}>
                            {item.v2Status}
                          </Badge>
                        </td>
                        <td className="p-3">
                          {item.issues.length
                            ? <div className="flex max-w-[320px] flex-wrap gap-1">
                              {item.issues.map(issue =>
                                <Badge key={issue} variant="outline" className="text-xs">
                                  {issue.replace(/-/g, ' ')}
                                </Badge>)}
                            </div>
                            : <span className="text-muted-foreground">Metadata complete; separate 3D QA required</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!showAll && filtered.length > displayed.length && (
                <Button variant="outline" type="button" onClick={() => setShowAll(true)}>
                  Show all {filtered.length} items in this wave
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
