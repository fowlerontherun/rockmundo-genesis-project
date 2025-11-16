import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Youtube, Plus, Trash2, ExternalLink } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  youtubeResourceSchema,
  defaultResourceFormValues,
  type YoutubeResourceFormValues,
  type YoutubeResourceRow,
  mapResourceFormToPayload,
  mapResourceRowToFormValues
} from "./youtubeVideos.helpers";

const YoutubeVideos = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<YoutubeResourceRow | null>(null);
  const queryClient = useQueryClient();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<YoutubeResourceFormValues>({
    resolver: zodResolver(youtubeResourceSchema),
    defaultValues: defaultResourceFormValues,
  });

  // Fetch all YouTube resources
  const { data: resources = [], isLoading } = useQuery({
    queryKey: ["youtube-resources"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("education_youtube_resources")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as YoutubeResourceRow[];
    },
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (values: YoutubeResourceFormValues) => {
      const payload = mapResourceFormToPayload(values);

      if (editingResource) {
        const { error } = await supabase
          .from("education_youtube_resources")
          .update(payload as any)
          .eq("id", editingResource.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("education_youtube_resources")
          .insert([payload as any]);
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["youtube-resources"] });
      toast.success(editingResource ? "Resource updated" : "Resource created");
      setIsDialogOpen(false);
      setEditingResource(null);
      reset(defaultResourceFormValues);
    },
    onError: (error: any) => {
      toast.error("Failed to save resource", { description: error.message });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("education_youtube_resources")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["youtube-resources"] });
      toast.success("Resource deleted");
    },
    onError: (error: any) => {
      toast.error("Failed to delete resource", { description: error.message });
    },
  });

  const handleEdit = (resource: YoutubeResourceRow) => {
    setEditingResource(resource);
    reset(mapResourceRowToFormValues(resource));
    setIsDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingResource(null);
    reset(defaultResourceFormValues);
    setIsDialogOpen(true);
  };

  const onSubmit = (values: YoutubeResourceFormValues) => {
    saveMutation.mutate(values);
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Youtube className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">YouTube Resources</h1>
            <p className="text-muted-foreground">Manage educational video resources</p>
          </div>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Add Resource
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingResource ? "Edit Resource" : "Add New Resource"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="collectionKey">Collection Key</Label>
                  <Input id="collectionKey" {...register("collectionKey")} />
                  {errors.collectionKey && (
                    <p className="text-sm text-destructive">{errors.collectionKey.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="collectionSortOrder">Collection Sort Order</Label>
                  <Input
                    id="collectionSortOrder"
                    type="number"
                    {...register("collectionSortOrder", { valueAsNumber: true })}
                  />
                  {errors.collectionSortOrder && (
                    <p className="text-sm text-destructive">{errors.collectionSortOrder.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="collectionTitle">Collection Title</Label>
                <Input id="collectionTitle" {...register("collectionTitle")} />
                {errors.collectionTitle && (
                  <p className="text-sm text-destructive">{errors.collectionTitle.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="collectionDescription">Collection Description</Label>
                <Textarea id="collectionDescription" {...register("collectionDescription")} rows={2} />
                {errors.collectionDescription && (
                  <p className="text-sm text-destructive">{errors.collectionDescription.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="resourceName">Resource Name</Label>
                <Input id="resourceName" {...register("resourceName")} />
                {errors.resourceName && (
                  <p className="text-sm text-destructive">{errors.resourceName.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="resourceFormat">Format</Label>
                  <Input id="resourceFormat" {...register("resourceFormat")} placeholder="e.g., Tutorial" />
                  {errors.resourceFormat && (
                    <p className="text-sm text-destructive">{errors.resourceFormat.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="resourceSortOrder">Resource Sort Order</Label>
                  <Input
                    id="resourceSortOrder"
                    type="number"
                    {...register("resourceSortOrder", { valueAsNumber: true })}
                  />
                  {errors.resourceSortOrder && (
                    <p className="text-sm text-destructive">{errors.resourceSortOrder.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="resourceFocus">Focus</Label>
                <Input id="resourceFocus" {...register("resourceFocus")} />
                {errors.resourceFocus && (
                  <p className="text-sm text-destructive">{errors.resourceFocus.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="resourceSummary">Summary</Label>
                <Textarea id="resourceSummary" {...register("resourceSummary")} rows={3} />
                {errors.resourceSummary && (
                  <p className="text-sm text-destructive">{errors.resourceSummary.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="resourceUrl">YouTube URL</Label>
                <Input id="resourceUrl" {...register("resourceUrl")} placeholder="https://youtube.com/..." />
                {errors.resourceUrl && (
                  <p className="text-sm text-destructive">{errors.resourceUrl.message}</p>
                )}
              </div>

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Saving..." : editingResource ? "Update" : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            Loading resources...
          </CardContent>
        </Card>
      ) : resources.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            No YouTube resources yet. Click "Add Resource" to create one.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {resources.map((resource) => (
            <Card key={resource.id}>
              <CardHeader>
                <CardTitle className="text-lg line-clamp-2">
                  {(resource as any).resource_name || resource.title}
                </CardTitle>
                <div className="flex gap-2 flex-wrap">
                  {(resource as any).resource_format && (
                    <Badge variant="secondary">{(resource as any).resource_format}</Badge>
                  )}
                  {resource.category && (
                    <Badge variant="outline">{resource.category}</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {(resource as any).resource_summary || resource.description}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open((resource as any).resource_url || resource.video_url, "_blank")}
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    View
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleEdit(resource)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      if (confirm("Delete this resource?")) {
                        deleteMutation.mutate(resource.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default YoutubeVideos;
