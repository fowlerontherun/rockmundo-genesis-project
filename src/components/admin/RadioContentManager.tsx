import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAllRadioContent, RadioContent } from "@/hooks/useRadioContent";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Radio, 
  Megaphone, 
  Play, 
  Pause, 
  Plus, 
  RefreshCw, 
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Upload,
  AlertCircle
} from "lucide-react";

export const RadioContentManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: content, isLoading } = useAllRadioContent();
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Form state
  const [newContent, setNewContent] = useState({
    content_type: 'jingle' as 'jingle' | 'advert',
    title: '',
    script: '',
    category: '',
    brand_name: '',
    humor_style: 'cheesy' as string,
    play_weight: 1,
  });

  // Toggle active status
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('radio_content')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rm-radio-content-all"] });
      queryClient.invalidateQueries({ queryKey: ["rm-radio-content"] });
    },
  });

  // Generate audio for single item
  const generateAudioMutation = useMutation({
    mutationFn: async (contentId: string) => {
      console.log('[RadioContentManager] Generating audio for:', contentId);
      const { data, error } = await supabase.functions.invoke('generate-radio-content-audio', {
        body: { contentId },
      });
      console.log('[RadioContentManager] Generation response:', { data, error });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rm-radio-content-all"] });
      queryClient.invalidateQueries({ queryKey: ["rm-radio-content"] });
      toast({ title: "Audio generation started" });
    },
    onError: (error: any) => {
      console.error('[RadioContentManager] Generation error:', error);
      const message = error?.message || error?.error || "Unknown error";
      toast({ title: "Generation failed", description: message, variant: "destructive" });
    },
  });

  // Upload audio file for an item
  const handleFileUpload = async (item: RadioContent, file: File) => {
    if (!file || !file.type.startsWith('audio/')) {
      toast({ title: "Invalid file", description: "Please select an audio file (MP3, WAV, etc.)", variant: "destructive" });
      return;
    }

    setUploadingId(item.id);

    try {
      // Upload to Supabase Storage
      const fileName = `radio-content/${item.content_type}/${item.id}.mp3`;
      
      const { error: uploadError } = await supabase.storage
        .from('music')
        .upload(fileName, file, {
          contentType: file.type,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('music')
        .getPublicUrl(fileName);

      const audioUrl = publicUrlData.publicUrl;

      // Estimate duration (audio will be analyzed when played)
      const estimatedSeconds = 15; // Default estimate

      // Update record with audio URL
      const { error: updateError } = await supabase
        .from('radio_content')
        .update({
          audio_url: audioUrl,
          audio_status: 'completed',
          duration_seconds: estimatedSeconds,
        })
        .eq('id', item.id);

      if (updateError) throw updateError;

      queryClient.invalidateQueries({ queryKey: ["rm-radio-content-all"] });
      queryClient.invalidateQueries({ queryKey: ["rm-radio-content"] });
      toast({ title: "Audio uploaded successfully!" });

    } catch (error: any) {
      console.error('[RadioContentManager] Upload error:', error);
      toast({ 
        title: "Upload failed", 
        description: error?.message || "Unknown error", 
        variant: "destructive" 
      });
    } finally {
      setUploadingId(null);
    }
  };

  // Generate all pending audio
  const generateAllAudio = async () => {
    setGeneratingAll(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-radio-content-audio', {
        body: { generateAll: true },
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["rm-radio-content-all"] });
      queryClient.invalidateQueries({ queryKey: ["rm-radio-content"] });
      toast({ 
        title: "Batch generation complete", 
        description: `Processed ${data.results?.length || 0} items` 
      });
    } catch (error: any) {
      toast({ title: "Batch generation failed", description: error.message, variant: "destructive" });
    } finally {
      setGeneratingAll(false);
    }
  };

  // Add new content
  const addContentMutation = useMutation({
    mutationFn: async (data: typeof newContent) => {
      const { error } = await supabase
        .from('radio_content')
        .insert({
          content_type: data.content_type,
          title: data.title,
          script: data.script,
          category: data.category || null,
          brand_name: data.brand_name || null,
          humor_style: data.humor_style,
          play_weight: data.play_weight,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rm-radio-content-all"] });
      setAddDialogOpen(false);
      setNewContent({
        content_type: 'jingle',
        title: '',
        script: '',
        category: '',
        brand_name: '',
        humor_style: 'cheesy',
        play_weight: 1,
      });
      toast({ title: "Content added successfully" });
    },
    onError: (error) => {
      toast({ title: "Failed to add content", description: error.message, variant: "destructive" });
    },
  });

  const playPreview = (item: RadioContent) => {
    if (audioRef) {
      audioRef.pause();
      audioRef.src = '';
    }

    if (playingId === item.id) {
      setPlayingId(null);
      return;
    }

    if (item.audio_url) {
      const audio = new Audio(item.audio_url);
      audio.onended = () => setPlayingId(null);
      audio.play();
      setAudioRef(audio);
      setPlayingId(item.id);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500/20 text-green-400"><CheckCircle2 className="h-3 w-3 mr-1" />Ready</Badge>;
      case 'generating':
        return <Badge className="bg-amber-500/20 text-amber-400"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Generating</Badge>;
      case 'failed':
        return <Badge className="bg-red-500/20 text-red-400"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      default:
        return <Badge className="bg-gray-500/20 text-gray-400"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    }
  };

  const jingles = content?.filter(c => c.content_type === 'jingle') || [];
  const adverts = content?.filter(c => c.content_type === 'advert') || [];
  const pendingCount = content?.filter(c => c.audio_status === 'pending').length || 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Radio className="h-5 w-5" />
                RM Radio Content Manager
              </CardTitle>
              <CardDescription>
                Manage jingles and fake adverts for RM Radio
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {pendingCount > 0 && (
                <Button 
                  onClick={generateAllAudio} 
                  disabled={generatingAll}
                  variant="outline"
                >
                  {generatingAll ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Generate All ({pendingCount})
                </Button>
              )}
              <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Content
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Add Radio Content</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Type</Label>
                      <Select
                        value={newContent.content_type}
                        onValueChange={(v) => setNewContent({ ...newContent, content_type: v as 'jingle' | 'advert' })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="jingle">Jingle</SelectItem>
                          <SelectItem value="advert">Advert</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Title</Label>
                      <Input
                        value={newContent.title}
                        onChange={(e) => setNewContent({ ...newContent, title: e.target.value })}
                        placeholder="e.g., RM Radio Station ID"
                      />
                    </div>
                    <div>
                      <Label>Script</Label>
                      <Textarea
                        value={newContent.script}
                        onChange={(e) => setNewContent({ ...newContent, script: e.target.value })}
                        placeholder="Write the script that will be read by the AI voice..."
                        rows={4}
                      />
                    </div>
                    {newContent.content_type === 'advert' && (
                      <div>
                        <Label>Brand Name</Label>
                        <Input
                          value={newContent.brand_name}
                          onChange={(e) => setNewContent({ ...newContent, brand_name: e.target.value })}
                          placeholder="e.g., StringSafe Insurance"
                        />
                      </div>
                    )}
                    <div>
                      <Label>Humor Style</Label>
                      <Select
                        value={newContent.humor_style}
                        onValueChange={(v) => setNewContent({ ...newContent, humor_style: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cheesy">Cheesy</SelectItem>
                          <SelectItem value="absurd">Absurd</SelectItem>
                          <SelectItem value="parody">Parody</SelectItem>
                          <SelectItem value="deadpan">Deadpan</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Play Weight (1-5)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={5}
                        value={newContent.play_weight}
                        onChange={(e) => setNewContent({ ...newContent, play_weight: parseInt(e.target.value) || 1 })}
                      />
                      <p className="text-xs text-muted-foreground mt-1">Higher = played more often</p>
                    </div>
                    <Button
                      onClick={() => addContentMutation.mutate(newContent)}
                      disabled={!newContent.title || !newContent.script || addContentMutation.isPending}
                      className="w-full"
                    >
                      {addContentMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : null}
                      Add Content
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Jingles */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Radio className="h-4 w-4 text-primary" />
                Jingles ({jingles.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {jingles.map((item) => (
                    <div key={item.id} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{item.title}</span>
                        {getStatusBadge(item.audio_status)}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{item.script}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex gap-2">
                          {item.audio_status === 'completed' && (
                            <Button size="sm" variant="outline" onClick={() => playPreview(item)}>
                              {playingId === item.id ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                            </Button>
                          )}
                          {(item.audio_status === 'pending' || item.audio_status === 'failed') && (
                            <>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => generateAudioMutation.mutate(item.id)}
                                disabled={generateAudioMutation.isPending}
                              >
                                Generate
                              </Button>
                              <input
                                type="file"
                                accept="audio/*"
                                className="hidden"
                                ref={(el) => { fileInputRefs.current[item.id] = el; }}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleFileUpload(item, file);
                                }}
                              />
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => fileInputRefs.current[item.id]?.click()}
                                disabled={uploadingId === item.id}
                              >
                                {uploadingId === item.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Upload className="h-3 w-3" />
                                )}
                              </Button>
                            </>
                          )}
                        </div>
                        <Switch
                          checked={item.is_active}
                          onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: item.id, is_active: checked })}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Adverts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Megaphone className="h-4 w-4 text-amber-500" />
                Fake Adverts ({adverts.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {adverts.map((item) => (
                    <div key={item.id} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{item.title}</span>
                        {getStatusBadge(item.audio_status)}
                      </div>
                      {item.brand_name && (
                        <Badge variant="secondary" className="text-xs">{item.brand_name}</Badge>
                      )}
                      <p className="text-sm text-muted-foreground line-clamp-2">{item.script}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex gap-2">
                          {item.audio_status === 'completed' && (
                            <Button size="sm" variant="outline" onClick={() => playPreview(item)}>
                              {playingId === item.id ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                            </Button>
                          )}
                          {(item.audio_status === 'pending' || item.audio_status === 'failed') && (
                            <>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => generateAudioMutation.mutate(item.id)}
                                disabled={generateAudioMutation.isPending}
                              >
                                Generate
                              </Button>
                              <input
                                type="file"
                                accept="audio/*"
                                className="hidden"
                                ref={(el) => { fileInputRefs.current[item.id] = el; }}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleFileUpload(item, file);
                                }}
                              />
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => fileInputRefs.current[item.id]?.click()}
                                disabled={uploadingId === item.id}
                              >
                                {uploadingId === item.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Upload className="h-3 w-3" />
                                )}
                              </Button>
                            </>
                          )}
                        </div>
                        <Switch
                          checked={item.is_active}
                          onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: item.id, is_active: checked })}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
