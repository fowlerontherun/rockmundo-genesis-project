import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Video, Sparkles, Image } from "lucide-react";
import { useDikCokVideoTypes } from "@/hooks/useDikCokVideoTypes";
import { useDikCokVideos } from "@/hooks/useDikCokVideos";
import { Badge } from "@/components/ui/badge";

interface DikCokCreateDialogProps {
  bandId: string;
  userId: string;
  bandName: string;
  bandGenre?: string;
}

export const DikCokCreateDialog = ({ bandId, userId, bandName, bandGenre }: DikCokCreateDialogProps) => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [videoTypeId, setVideoTypeId] = useState("");
  const [trendingTag, setTrendingTag] = useState("");

  const { videoTypes } = useDikCokVideoTypes();
  const { createVideo, isCreating } = useDikCokVideos(bandId);

  const selectedType = videoTypes?.find(vt => vt.id === videoTypeId);

  const handleSubmit = () => {
    if (!title || !videoTypeId) return;

    createVideo({
      band_id: bandId,
      creator_user_id: userId,
      video_type_id: videoTypeId,
      title,
      description,
      trending_tag: trendingTag || undefined,
      bandName,
      bandGenre,
      videoTypeName: selectedType?.name,
    });

    setOpen(false);
    setTitle("");
    setDescription("");
    setVideoTypeId("");
    setTrendingTag("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="gap-2">
          <Video className="h-5 w-5" />
          Create Video
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Create DikCok Video - {bandName}
            <Badge variant="outline" className="gap-1 text-xs ml-2">
              <Image className="h-3 w-3" />
              AI Thumbnail
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="video-type">Video Template *</Label>
            <Select value={videoTypeId} onValueChange={setVideoTypeId}>
              <SelectTrigger id="video-type">
                <SelectValue placeholder="Choose a video type..." />
              </SelectTrigger>
              <SelectContent>
                {videoTypes?.map((vt) => (
                  <SelectItem key={vt.id} value={vt.id}>
                    <div className="flex items-center gap-2">
                      <span>{vt.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {vt.difficulty}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedType && (
              <p className="text-sm text-muted-foreground mt-1">
                {selectedType.description} • {selectedType.duration_hint}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="title">Video Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Give your video a catchy title..."
              maxLength={100}
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description..."
              rows={3}
              maxLength={500}
            />
          </div>

          <div>
            <Label htmlFor="trending-tag">Trending Tag (optional)</Label>
            <Input
              id="trending-tag"
              value={trendingTag}
              onChange={(e) => setTrendingTag(e.target.value)}
              placeholder="e.g., SummerVibes, NewMusic"
              maxLength={30}
            />
          </div>

          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Image className="h-3 w-3" />
            An AI-generated thumbnail will be created automatically based on your video title and genre.
          </p>

          <Button
            onClick={handleSubmit}
            disabled={!title || !videoTypeId || isCreating}
            className="w-full"
          >
            {isCreating ? "Creating..." : "Create Video"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};