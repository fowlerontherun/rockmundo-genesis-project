import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { INSTRUMENT_CLIP_CONFIGS, UNIVERSAL_CLIP_CONFIGS, getTotalClipCount } from '@/data/instrumentClipConfig';
import { Film, RefreshCw, Play, CheckCircle, AlertCircle, Clock, Zap } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export default function POVClipAdmin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: clips = [], isLoading } = useQuery({
    queryKey: ['admin-pov-clips'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pov_clip_templates')
        .select('*')
        .order('instrument_family', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const completedCount = clips.filter(c => c.generation_status === 'completed').length;
  const pendingCount = clips.filter(c => c.generation_status === 'pending').length;
  const failedCount = clips.filter(c => c.generation_status === 'failed').length;
  const generatingCount = clips.filter(c => c.generation_status === 'generating').length;
  const totalExpected = getTotalClipCount();

  const seedClipsMutation = useMutation({
    mutationFn: async () => {
      const templates: any[] = [];

      for (const config of INSTRUMENT_CLIP_CONFIGS) {
        for (const variant of config.variants) {
          templates.push({
            instrument_family: config.instrumentFamily,
            instrument_track: config.instrumentTrack,
            variant: variant.variant,
            clip_type: variant.variant,
            description: variant.prompt.substring(0, 200),
            generation_prompt: variant.prompt,
            generation_status: 'pending',
            venue_size: 'any',
          });
        }
      }

      for (const config of UNIVERSAL_CLIP_CONFIGS) {
        templates.push({
          instrument_family: 'universal',
          instrument_track: config.category,
          variant: config.variant,
          clip_type: config.category,
          description: config.prompt.substring(0, 200),
          generation_prompt: config.prompt,
          generation_status: 'pending',
          venue_size: config.venueSize,
        });
      }

      const { error } = await supabase.from('pov_clip_templates').upsert(templates, {
        onConflict: 'instrument_track,variant',
        ignoreDuplicates: true,
      });

      if (error) throw error;
      return templates.length;
    },
    onSuccess: (count) => {
      toast({ title: `Seeded ${count} clip templates` });
      queryClient.invalidateQueries({ queryKey: ['admin-pov-clips'] });
    },
    onError: (err: any) => {
      toast({ title: 'Error seeding clips', description: err.message, variant: 'destructive' });
    },
  });

  const generateBatchMutation = useMutation({
    mutationFn: async (clipIds?: string[]) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const body: any = { action: 'generate-pov-clips', batchSize: 3 };
      if (clipIds?.length) body.clipIds = clipIds;

      const { data, error } = await supabase.functions.invoke('generate-sprite', {
        body,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({ title: `Generation started for ${data.processed} clips` });
      queryClient.invalidateQueries({ queryKey: ['admin-pov-clips'] });
    },
    onError: (err: any) => {
      toast({ title: 'Generation error', description: err.message, variant: 'destructive' });
    },
  });

  const statusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'generating': return <RefreshCw className="h-4 w-4 text-yellow-500 animate-spin" />;
      case 'failed': return <AlertCircle className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Film className="h-8 w-8" />
            POV Clip Manager
          </h1>
          <p className="text-muted-foreground">Manage AI-generated POV concert clips</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => seedClipsMutation.mutate()} disabled={seedClipsMutation.isPending} variant="outline">
            {seedClipsMutation.isPending ? 'Seeding...' : 'Seed All Templates'}
          </Button>
          <Button
            onClick={() => generateBatchMutation.mutate(undefined)}
            disabled={generateBatchMutation.isPending || pendingCount === 0}
          >
            <Zap className="h-4 w-4 mr-2" />
            {generateBatchMutation.isPending ? 'Generating...' : `Generate Batch (${pendingCount} pending)`}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{totalExpected}</p>
          <p className="text-xs text-muted-foreground">Total Expected</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-green-500">{completedCount}</p>
          <p className="text-xs text-muted-foreground">Completed</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{pendingCount}</p>
          <p className="text-xs text-muted-foreground">Pending</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-yellow-500">{generatingCount}</p>
          <p className="text-xs text-muted-foreground">Generating</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-red-500">{failedCount}</p>
          <p className="text-xs text-muted-foreground">Failed</p>
        </CardContent></Card>
      </div>

      <Progress value={clips.length > 0 ? (completedCount / clips.length) * 100 : 0} className="h-2" />

      {/* Clip list */}
      <div className="space-y-2">
        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">Loading clips...</p>
        ) : clips.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">
            No clips seeded yet. Click "Seed All Templates" to create clip definitions.
          </CardContent></Card>
        ) : (
          clips.map((clip: any) => (
            <Card key={clip.id} className="hover:bg-accent/30 transition-colors">
              <CardContent className="p-3 flex items-center gap-3">
                {statusIcon(clip.generation_status)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{clip.instrument_track}</span>
                    <Badge variant="outline" className="text-[10px]">{clip.variant}</Badge>
                    <Badge variant="secondary" className="text-[10px]">{clip.instrument_family}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{clip.description}</p>
                  {clip.generation_error && (
                    <p className="text-xs text-destructive truncate">{clip.generation_error}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {clip.generation_status === 'failed' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => generateBatchMutation.mutate([clip.id])}
                      disabled={generateBatchMutation.isPending}
                    >
                      <RefreshCw className="h-3 w-3" />
                    </Button>
                  )}
                  {clip.video_url && (
                    <Button variant="ghost" size="sm" asChild>
                      <a href={clip.video_url} target="_blank" rel="noreferrer"><Play className="h-3 w-3" /></a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}