import { useState } from "react";
import { nanoid } from "nanoid";
import { Music2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
  getMediaMetadata,
  type MediaMetadata,
  uploadMediaAsset,
} from "@/integrations/supabase/storage";

interface AudioUploadProps {
  bucketId?: string;
  onUploaded?: (metadata: MediaMetadata) => void;
}

const AUDIO_BUCKET = "music";

export const AudioUpload = ({ bucketId = AUDIO_BUCKET, onUploaded }: AudioUploadProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [lastUploaded, setLastUploaded] = useState<MediaMetadata | null>(null);
  const { toast } = useToast();

  const handleUpload = async () => {
    if (!selectedFile) {
      toast({
        title: "Select an audio file",
        description: "Choose a WAV, MP3, or lossless file to upload.",
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(10);

    try {
      const path = `uploads/audio/${nanoid()}-${selectedFile.name}`;
      const result = await uploadMediaAsset({
        bucketId,
        file: selectedFile,
        path,
        metadata: {
          mediaType: "audio",
          originalName: selectedFile.name,
          size: selectedFile.size,
        },
      });

      setUploadProgress(70);
      const metadata = await getMediaMetadata(result.bucketId, result.path);
      setUploadProgress(100);

      if (metadata) {
        setLastUploaded(metadata);
        onUploaded?.(metadata);
      }

      toast({
        title: "Audio uploaded",
        description: "Your track is ready to be scheduled for release.",
      });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadProgress(0), 1200);
    }
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Music2 className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>Audio Upload</CardTitle>
            <CardDescription>High fidelity masters or demo ideas you want to refine.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Input
            type="file"
            accept="audio/*"
            onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
            disabled={isUploading}
          />
          <p className="text-xs text-muted-foreground">
            Supported formats include WAV, AIFF, MP3, and FLAC. Files are stored in the "{bucketId}" bucket.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={handleUpload} disabled={!selectedFile || isUploading} className="flex-1">
            <UploadCloud className="mr-2 h-4 w-4" />
            {isUploading ? "Uploading" : "Upload audio"}
          </Button>
          {selectedFile && (
            <Badge variant="outline" className="whitespace-nowrap">
              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
            </Badge>
          )}
        </div>

        {(isUploading || uploadProgress > 0) && (
          <div className="space-y-2">
            <Progress value={uploadProgress} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {uploadProgress === 100 ? "Upload complete." : "Uploading… this may take a moment for large files."}
            </p>
          </div>
        )}
      </CardContent>
      {lastUploaded && (
        <CardFooter className="flex-col items-start gap-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            Last upload
            <Badge variant="secondary">{lastUploaded.mimeType ?? "audio"}</Badge>
          </div>
          <dl className="grid w-full grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <dt className="text-muted-foreground">Filename</dt>
            <dd className="truncate" title={lastUploaded.name}>
              {lastUploaded.name}
            </dd>
            <dt className="text-muted-foreground">Size</dt>
            <dd>{(lastUploaded.size / 1024 / 1024).toFixed(2)} MB</dd>
            <dt className="text-muted-foreground">Updated</dt>
            <dd>{new Date(lastUploaded.updatedAt ?? "").toLocaleString()}</dd>
          </dl>
        </CardFooter>
      )}
    </Card>
  );
};

export default AudioUpload;
