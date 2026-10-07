import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Download, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { canvasBlob, renderShareMoment, shareFilename } from './canvas';
import { renderCharacterProfileCard, type CharacterProfileShareMoment } from './characterProfile';
import { downloadBlob, nativeShare } from './share';
import type { ShareFormat, ShareMoment } from './types';

interface Props { open: boolean; onOpenChange: (open: boolean) => void; moment: ShareMoment | CharacterProfileShareMoment; }

export function ShareMomentSheet({ open, onOpenChange, moment }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [format, setFormat] = useState<ShareFormat>('square');
  const [done, setDone] = useState<string | null>(null);
  const { toast } = useToast();
  const text = useMemo(() => [moment.headline, moment.subheadline].filter(Boolean).join(' — '), [moment]);

  useEffect(() => {
    if (!open || !canvasRef.current) return;
    if (moment.type === 'character_profile') void renderCharacterProfileCard(canvasRef.current, moment as CharacterProfileShareMoment, format);
    else renderShareMoment(canvasRef.current, moment, format);
  }, [open, moment, format]);

  const flash = (value: string) => { setDone(value); window.setTimeout(() => setDone(current => current === value ? null : current), 1400); };
  const blob = () => canvasRef.current ? canvasBlob(canvasRef.current) : Promise.reject(new Error('Preview unavailable'));
  const recordShare = () => { if (moment.shareCooldownKey) localStorage.setItem(moment.shareCooldownKey, String(Date.now())); };

  const share = async () => {
    try {
      const image = await blob();
      const file = new File([image], shareFilename(moment, format), { type: 'image/png' });
      const result = await nativeShare({ title: moment.headline + ' — Rockmundo', text, url: moment.destinationUrl ?? undefined, file });
      if (result === 'shared') recordShare();
      if (result === 'unsupported') { downloadBlob(image, file.name); toast({ title: 'Sharing is not supported here', description: 'The image was downloaded instead.' }); }
    } catch (error) { toast({ title: 'Could not share', description: error instanceof Error ? error.message : 'Try downloading the image instead.', variant: 'destructive' }); }
  };

  const download = async () => { const image = await blob(); downloadBlob(image, shareFilename(moment, format)); flash('download'); };
  const copyLink = async () => {
    if (!moment.destinationUrl) return;
    await navigator.clipboard.writeText(moment.destinationUrl); recordShare(); flash('link'); toast({ title: 'Link copied' });
  };
  const copyImage = async () => {
    try {
      const image = await blob();
      if (!window.ClipboardItem) throw new Error('Image clipboard is unavailable');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': image })]); flash('image');
    } catch { toast({ title: 'Copy image is not supported by this browser', description: 'Use Download image instead.', variant: 'destructive' }); }
  };

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>Share your Rockmundo moment</DialogTitle><DialogDescription>Choose a format, preview the graphic, then share or save it.</DialogDescription></DialogHeader>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
        <div className="overflow-hidden rounded-xl border bg-black/30 p-2">
          <canvas ref={canvasRef} className="h-auto max-h-[60vh] w-full object-contain" aria-label="Social share graphic preview" />
        </div>
        <div className="space-y-3">
          <Select value={format} onValueChange={value => setFormat(value as ShareFormat)}><SelectTrigger aria-label="Share graphic format"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="square">Square post</SelectItem><SelectItem value="story">Story / vertical</SelectItem><SelectItem value="landscape">Landscape</SelectItem></SelectContent></Select>
          <Button className="w-full" onClick={() => void share()}><Share2 className="mr-2 h-4 w-4" />Share</Button>
          <Button className="w-full" variant="outline" onClick={() => void copyImage()}>{done === 'image' ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}Copy image</Button>
          <Button className="w-full" variant="outline" onClick={() => void download()}>{done === 'download' ? <Check className="mr-2 h-4 w-4" /> : <Download className="mr-2 h-4 w-4" />}Download image</Button>
          {moment.destinationUrl && <Button className="w-full" variant="ghost" onClick={() => void copyLink()}>{done === 'link' ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}Copy link</Button>}
        </div>
      </div>
    </DialogContent>
  </Dialog>;
}
