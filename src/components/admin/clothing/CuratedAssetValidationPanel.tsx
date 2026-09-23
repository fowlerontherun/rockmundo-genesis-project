import { useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, CircleDashed, ShieldCheck, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  collectionId: string;
  items: any[];
  onChanged?: () => void;
}

const checks = [
  ['front', 'Front fit'],
  ['back', 'Back fit'],
  ['side', 'Side fit'],
  ['tpose', 'T-pose'],
  ['singing', 'Singing'],
  ['guitar', 'Guitar / bass'],
  ['drums', 'Drums / seated'],
  ['clipping', 'No major clipping'],
  ['stretching', 'No extreme stretching'],
] as const;

function checkState(item: any, key: string) {
  const notes = item.validation_notes || {};
  if (notes.checks && key in notes.checks) return notes.checks[key] === true;
  const poses = Array.isArray(notes.poses) ? notes.poses.map((value: unknown) => String(value).toLowerCase()) : [];
  if (key === 'front' || key === 'back' || key === 'side' || key === 'tpose') return notes.result === 'pass';
  if (key === 'singing') return poses.includes('singing');
  if (key === 'guitar') return poses.includes('guitar') || poses.includes('bass');
  if (key === 'drums') return poses.includes('drums') || poses.includes('seated');
  if (key === 'clipping' || key === 'stretching') return notes.result === 'pass';
  return false;
}

function validationComplete(item: any) {
  const frames = Array.isArray(item.supported_frames) ? item.supported_frames : [];
  return frames.includes('masculine')
    && frames.includes('feminine')
    && checks.every(([key]) => checkState(item, key));
}

function statusClass(status: string) {
  if (status === 'published') return 'border-emerald-500/30 text-emerald-600';
  if (status === 'validated') return 'border-sky-500/30 text-sky-600';
  if (status === 'blocked') return 'border-destructive/30 text-destructive';
  if (status === 'asset_ready') return 'border-amber-500/30 text-amber-600';
  return '';
}

export function CuratedAssetValidationPanel({ collectionId, items, onChanged }: Props) {
  const queryClient = useQueryClient();
  const curated = useMemo(() => items.filter(item => item.curated_asset_key && item.curated_asset_status !== 'legacy'), [items]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-collection-items', collectionId] });
    queryClient.invalidateQueries({ queryKey: ['clothing-items'] });
    queryClient.invalidateQueries({ queryKey: ['featured-items'] });
    onChanged?.();
  };

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await (supabase.from('avatar_clothing_items') as any)
        .update({ curated_asset_status: status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Curated asset status updated');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!curated.length) return null;

  const published = curated.filter(item => item.curated_asset_status === 'published').length;
  const validated = curated.filter(item => item.curated_asset_status === 'validated').length;
  const blocked = curated.filter(item => item.curated_asset_status === 'blocked').length;

  return <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" />Curated asset validation</CardTitle>
      <p className="text-sm text-muted-foreground">Curated skins never use the old procedural garment generator. Publish only after both avatar frames and performance poses pass.</p>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">{curated.length} curated</Badge>
        <Badge variant="outline" className="border-emerald-500/30 text-emerald-600">{published} published</Badge>
        <Badge variant="outline" className="border-sky-500/30 text-sky-600">{validated} validated</Badge>
        {blocked > 0 && <Badge variant="outline" className="border-destructive/30 text-destructive">{blocked} blocked</Badge>}
      </div>

      <div className="divide-y rounded-lg border">
        {curated.map(item => {
          const complete = validationComplete(item);
          const frames = Array.isArray(item.supported_frames) ? item.supported_frames : [];
          return <div key={item.id} className="p-4 space-y-3">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
              <div>
                <div className="font-medium">{item.name}</div>
                <div className="text-xs text-muted-foreground font-mono mt-1">{item.curated_asset_key}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={statusClass(item.curated_asset_status || 'planned')}>{item.curated_asset_status || 'planned'}</Badge>
                {complete
                  ? <Badge variant="outline" className="border-emerald-500/30 text-emerald-600"><CheckCircle2 className="h-3 w-3 mr-1" />QA complete</Badge>
                  : <Badge variant="outline"><CircleDashed className="h-3 w-3 mr-1" />QA incomplete</Badge>}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant={frames.includes('masculine') ? 'secondary' : 'outline'}>Masculine</Badge>
              <Badge variant={frames.includes('feminine') ? 'secondary' : 'outline'}>Feminine</Badge>
              {checks.map(([key, label]) => <Badge key={key} variant="outline" className={checkState(item, key) ? 'border-emerald-500/30 text-emerald-600' : ''}>
                {checkState(item, key) ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}{label}
              </Badge>)}
            </div>

            <div className="flex flex-wrap gap-2">
              {item.curated_asset_status === 'asset_ready' && <Button size="sm" variant="outline" disabled={!complete || updateStatus.isPending} onClick={() => updateStatus.mutate({ id: item.id, status: 'validated' })}>Mark validated</Button>}
              {item.curated_asset_status === 'validated' && <Button size="sm" disabled={!complete || updateStatus.isPending} onClick={() => updateStatus.mutate({ id: item.id, status: 'published' })}>Publish skin</Button>}
              {!['published','blocked'].includes(item.curated_asset_status) && <Button size="sm" variant="destructive" disabled={updateStatus.isPending} onClick={() => updateStatus.mutate({ id: item.id, status: 'blocked' })}>Block asset</Button>}
              {item.curated_asset_status === 'blocked' && <Button size="sm" variant="outline" disabled={updateStatus.isPending} onClick={() => updateStatus.mutate({ id: item.id, status: 'asset_ready' })}>Return to QA</Button>}
            </div>
            {!complete && <p className="text-xs text-muted-foreground">Publishing is locked until both body frames and every required fit/pose check are recorded as passing.</p>}
          </div>;
        })}
      </div>
    </CardContent>
  </Card>;
}
