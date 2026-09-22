import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Guitar, Check } from 'lucide-react';
import { STAGE_INSTRUMENTS } from '@/features/gig-demo-3d/instrumentCatalog';
import type { InstrumentSkinItem } from '@/features/instrument-skins/instrumentSkin';

export function InstrumentSkinCard({ item, isOwned, onPreview }: { item: InstrumentSkinItem; isOwned: boolean; onPreview: (item: InstrumentSkinItem) => void }) {
  const label = STAGE_INSTRUMENTS[item.target_instrument]?.label || item.target_instrument.replaceAll('_', ' ');
  return <Card className="overflow-hidden">
    <button type="button" className="block w-full text-left" onClick={() => onPreview(item)}>
      <div className="relative aspect-[4/3] overflow-hidden border-b bg-muted/30">
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${item.body_color} 0 58%, ${item.secondary_color} 58% 72%, ${item.pickguard_color} 72%)` }} />
        <Guitar className="absolute inset-0 m-auto h-20 w-20 text-white drop-shadow-[0_3px_8px_rgba(0,0,0,.65)]" />
        {isOwned && <Badge className="absolute right-2 top-2 gap-1"><Check className="h-3 w-3" />Owned</Badge>}
      </div>
      <CardContent className="p-3 space-y-2">
        <div className="min-w-0">
          <div className="font-semibold truncate">{item.name}</div>
          <div className="text-xs text-muted-foreground truncate">{label} · {item.design_key.replaceAll('_', ' ')}</div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <Badge variant="outline" className="capitalize">{item.rarity || 'common'}</Badge>
          <strong className="text-sm">${Number(item.price || 0).toLocaleString()}</strong>
        </div>
      </CardContent>
    </button>
    <div className="px-3 pb-3"><Button type="button" size="sm" variant="secondary" className="w-full" onClick={() => onPreview(item)}>{isOwned ? 'Customise & equip' : 'Preview & customise'}</Button></div>
  </Card>;
}
