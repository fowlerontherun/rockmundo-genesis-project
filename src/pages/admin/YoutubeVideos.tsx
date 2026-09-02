import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ExternalLink, Plus, Star, Trash2, Youtube } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

import {
  defaultResourceFormValues,
  mapResourceFormToPayload,
  mapResourceRowToFormValues,
  type YoutubeResourceFormValues,
  type YoutubeResourceRow,
  youtubeResourceSchema,
} from "./youtubeVideos.helpers";

interface SkillOption {
  slug: string;
  display_name: string;
}

const YoutubeVideos = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<YoutubeResourceRow | null>(null);
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<YoutubeResourceFormValues>({
    resolver: zodResolver(youtubeResourceSchema),
    defaultValues: defaultResourceFormValues,
  });

  const { data: resources = [], isLoading } = useQuery({
    queryKey: ["youtube-resources", "admin"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("education_youtube_resources")
        .select("*")
        .order("is_featured", { ascending: false })
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as YoutubeResourceRow[];
    },
  });

  const { data: skillOptions = [] } = useQuery({
    queryKey: ["youtube-resources", "skill-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("skill_definitions")
        .select("slug, display_name")
        .order("display_name", { ascending: true });

      if (error) throw error;
      return (data ?? []) as SkillOption[];
    },
    staleTime: 1000 * 60 * 30,
  });

  const filteredResources = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return resources;
    return resources.filter((resource) =>
      [
        resource.title,
        resource.description ?? "",
        resource.category ?? "",
        resource.skill_slug ?? "",
        resource.channel_name ?? "",
        ...(resource.tags ?? []),
      ]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [resources, search]);

  const saveMutation = useMutation({
    mutationFn: async (values: YoutubeResourceFormValues) => {
      const payload = mapResourceFormToPayload(values);

      if (editingResource) {
        const { error } = await (supabase as any)
          .from("education_youtube_resources")
          .update(payload)
          .eq("id", editingResource.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("education_youtube_resources")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["youtube-resources"] });
      queryClient.invalidateQueries({ queryKey: ["education", "youtube-resources"] });
      toast.success(editingResource ? "Lesson updated" : "Lesson added");
      setIsDialogOpen(false);
      setEditingResource(null);
      reset(defaultResourceFormValues);
    },
    onError: (error: Error) => {
      toast.error("Failed to save lesson", { description: error.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("education_youtube_resources")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["youtube-resources"] });
      queryClient.invalidateQueries({ queryKey: ["education", "youtube-resources"] });
      toast.success("Lesson deleted");
    },
    onError: (error: Error) => {
      toast.error("Failed to delete lesson", { description: error.message });
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

  return (
    <div className="container mx-auto space-y-6 py-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Youtube className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">PooTube Learning</h1>
            <p className="text-muted-foreground">
              Manage skill-linked lessons, channels, difficulty and featured recommendations.
            </p>
          </div>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add lesson
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          className="max-w-xl"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search title, skill, channel or tag..."
        />
        <div className="flex gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary">{resources.length} lessons</Badge>
          <Badge variant="outline">{resources.filter((resource) => resource.is_featured).length} featured</Badge>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingResource ? "Edit lesson" : "Add PooTube lesson"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit((values) => saveMutation.mutate(values))} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" {...register("title")} />
              {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" rows={3} {...register("description")} />
              {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="videoUrl">YouTube URL</Label>
              <Input id="videoUrl" placeholder="https://www.youtube.com/watch?v=..." {...register("videoUrl")} />
              {errors.videoUrl && <p className="text-sm text-destructive">{errors.videoUrl.message}</p>}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Skill rewarded</Label>
                <Controller
                  control={control}
                  name="skillSlug"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose skill" />
                      </SelectTrigger>
                      <SelectContent>
                        {skillOptions.map((skill) => (
                          <SelectItem key={skill.slug} value={skill.slug}>
                            {skill.display_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.skillSlug && <p className="text-sm text-destructive">{errors.skillSlug.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Library category</Label>
                <Input id="category" placeholder="guitar, production, dj..." {...register("category")} />
                {errors.category && <p className="text-sm text-destructive">{errors.category.message}</p>}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="channelName">Channel</Label>
                <Input id="channelName" placeholder="e.g. Drumeo" {...register("channelName")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="durationMinutes">Duration (minutes)</Label>
                <Input id="durationMinutes" type="number" {...register("durationMinutes", { valueAsNumber: true })} />
                {errors.durationMinutes && <p className="text-sm text-destructive">{errors.durationMinutes.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Difficulty</Label>
              <Controller
                control={control}
                name="difficultyLevel"
                render={({ field }) => (
                  <Select value={String(field.value)} onValueChange={(value) => field.onChange(Number(value))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Beginner</SelectItem>
                      <SelectItem value="2">Intermediate</SelectItem>
                      <SelectItem value="3">Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tagsText">Tags</Label>
              <Input id="tagsText" placeholder="chords, rhythm, beginner" {...register("tagsText")} />
              <p className="text-xs text-muted-foreground">Comma-separated. These power the player-facing topic filters.</p>
            </div>

            <label className="flex cursor-pointer items-center gap-3 rounded-md border p-3">
              <input type="checkbox" className="h-4 w-4" {...register("isFeatured")} />
              <span>
                <span className="block text-sm font-medium">Featured lesson</span>
                <span className="block text-xs text-muted-foreground">Featured lessons rank higher in recommendations.</span>
              </span>
            </label>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving..." : editingResource ? "Update lesson" : "Add lesson"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">Loading lessons...</CardContent>
        </Card>
      ) : filteredResources.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">No lessons match your search.</CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredResources.map((resource) => (
            <Card key={resource.id} className="flex h-full flex-col">
              <CardHeader className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {resource.is_featured && (
                    <Badge>
                      <Star className="mr-1 h-3 w-3" /> Featured
                    </Badge>
                  )}
                  {resource.skill_slug && <Badge variant="secondary">{resource.skill_slug}</Badge>}
                  <Badge variant="outline">Level {resource.difficulty_level ?? 1}</Badge>
                </div>
                <CardTitle className="text-lg leading-snug">{resource.title}</CardTitle>
                <div className="text-xs text-muted-foreground">
                  {resource.channel_name || "Channel not set"}
                  {resource.duration_minutes ? ` · ${resource.duration_minutes} min` : ""}
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                <p className="text-sm text-muted-foreground line-clamp-3">{resource.description}</p>
                <div className="flex flex-wrap gap-1">
                  {(resource.tags ?? []).slice(0, 5).map((tag) => (
                    <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>
                  ))}
                </div>
                <div className="mt-auto flex flex-wrap gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={() => window.open(resource.video_url, "_blank", "noopener,noreferrer")}>
                    <ExternalLink className="mr-1 h-4 w-4" /> View
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleEdit(resource)}>Edit</Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={deleteMutation.isPending}
                    onClick={() => {
                      if (window.confirm(`Delete "${resource.title}"?`)) deleteMutation.mutate(resource.id);
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
