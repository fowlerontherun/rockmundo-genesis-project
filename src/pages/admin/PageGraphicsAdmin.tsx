import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Image, Upload, Trash2, Edit, Save, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { AdminRoute } from "@/components/AdminRoute";

interface PageGraphic {
  id: string;
  page_key: string;
  page_name: string;
  hero_image_url: string | null;
  background_image_url: string | null;
  accent_image_url: string | null;
  icon_image_url: string | null;
  banner_image_url: string | null;
  metadata: any;
  is_active: boolean;
}

interface EditState {
  hero_image_url: string;
  background_image_url: string;
  accent_image_url: string;
  icon_image_url: string;
  banner_image_url: string;
}

function PageGraphicsAdmin() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({
    hero_image_url: "",
    background_image_url: "",
    accent_image_url: "",
    icon_image_url: "",
    banner_image_url: "",
  });

  const { data: pageGraphics, isLoading } = useQuery({
    queryKey: ["page-graphics-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("page_graphics")
        .select("*")
        .order("page_name");

      if (error) throw error;
      return data as PageGraphic[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<PageGraphic>;
    }) => {
      const { error } = await supabase
        .from("page_graphics")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["page-graphics-admin"] });
      queryClient.invalidateQueries({ queryKey: ["page-graphics"] });
      toast.success("Page graphics updated successfully");
      setEditingId(null);
    },
    onError: (error: any) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  const handleEdit = (graphic: PageGraphic) => {
    setEditingId(graphic.id);
    setEditState({
      hero_image_url: graphic.hero_image_url || "",
      background_image_url: graphic.background_image_url || "",
      accent_image_url: graphic.accent_image_url || "",
      icon_image_url: graphic.icon_image_url || "",
      banner_image_url: graphic.banner_image_url || "",
    });
  };

  const handleSave = (id: string) => {
    updateMutation.mutate({
      id,
      updates: {
        hero_image_url: editState.hero_image_url || null,
        background_image_url: editState.background_image_url || null,
        accent_image_url: editState.accent_image_url || null,
        icon_image_url: editState.icon_image_url || null,
        banner_image_url: editState.banner_image_url || null,
      },
    });
  };

  const handleClear = (id: string, field: keyof EditState) => {
    updateMutation.mutate({
      id,
      updates: { [field]: null },
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 md:p-6">
        <div className="text-center py-8">Loading page graphics...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-bold">Page Graphics Manager</h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Manage hero images, backgrounds, and graphics for each page. Optimized for mobile, tablet, and desktop.
        </p>
      </div>

      <div className="grid gap-4 md:gap-6">
        {pageGraphics?.map((graphic) => {
          const isEditing = editingId === graphic.id;

          return (
            <Card key={graphic.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg md:text-xl truncate">
                      {graphic.page_name}
                    </CardTitle>
                    <CardDescription className="text-xs md:text-sm">
                      {graphic.page_key} • {graphic.metadata?.description}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {!isEditing ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(graphic)}
                      >
                        <Edit className="h-4 w-4" />
                        <span className="hidden sm:inline ml-2">Edit</span>
                      </Button>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleSave(graphic.id)}
                          disabled={updateMutation.isPending}
                        >
                          <Save className="h-4 w-4" />
                          <span className="hidden sm:inline ml-2">Save</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingId(null)}
                        >
                          <X className="h-4 w-4" />
                          <span className="hidden sm:inline ml-2">Cancel</span>
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Hero Image */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Hero Image</Label>
                    {graphic.hero_image_url && !isEditing && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleClear(graphic.id, "hero_image_url")}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  {isEditing ? (
                    <Input
                      placeholder="https://... or /path/to/image.png"
                      value={editState.hero_image_url}
                      onChange={(e) =>
                        setEditState({ ...editState, hero_image_url: e.target.value })
                      }
                      className="text-sm"
                    />
                  ) : (
                    <div className="text-sm text-muted-foreground break-all">
                      {graphic.hero_image_url || (
                        <span className="italic">No image set</span>
                      )}
                    </div>
                  )}
                  {graphic.hero_image_url && (
                    <div className="aspect-video md:aspect-[21/9] bg-muted rounded-md overflow-hidden">
                      <img
                        src={graphic.hero_image_url}
                        alt={`${graphic.page_name} hero`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>

                {/* Background Image */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Background Image</Label>
                    {graphic.background_image_url && !isEditing && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleClear(graphic.id, "background_image_url")}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  {isEditing ? (
                    <Input
                      placeholder="https://... or /path/to/image.png"
                      value={editState.background_image_url}
                      onChange={(e) =>
                        setEditState({
                          ...editState,
                          background_image_url: e.target.value,
                        })
                      }
                      className="text-sm"
                    />
                  ) : (
                    <div className="text-sm text-muted-foreground break-all">
                      {graphic.background_image_url || (
                        <span className="italic">No image set</span>
                      )}
                    </div>
                  )}
                  {graphic.background_image_url && (
                    <div className="aspect-video bg-muted rounded-md overflow-hidden">
                      <img
                        src={graphic.background_image_url}
                        alt={`${graphic.page_name} background`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>

                {/* Accent, Icon, Banner in a responsive grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Accent Image */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Accent</Label>
                      {graphic.accent_image_url && !isEditing && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleClear(graphic.id, "accent_image_url")}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    {isEditing ? (
                      <Input
                        placeholder="URL"
                        value={editState.accent_image_url}
                        onChange={(e) =>
                          setEditState({ ...editState, accent_image_url: e.target.value })
                        }
                        className="text-sm"
                      />
                    ) : (
                      <div className="text-xs text-muted-foreground truncate">
                        {graphic.accent_image_url || <span className="italic">Not set</span>}
                      </div>
                    )}
                    {graphic.accent_image_url && (
                      <div className="aspect-square bg-muted rounded-md overflow-hidden">
                        <img
                          src={graphic.accent_image_url}
                          alt="Accent"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                  </div>

                  {/* Icon Image */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Icon</Label>
                      {graphic.icon_image_url && !isEditing && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleClear(graphic.id, "icon_image_url")}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    {isEditing ? (
                      <Input
                        placeholder="URL"
                        value={editState.icon_image_url}
                        onChange={(e) =>
                          setEditState({ ...editState, icon_image_url: e.target.value })
                        }
                        className="text-sm"
                      />
                    ) : (
                      <div className="text-xs text-muted-foreground truncate">
                        {graphic.icon_image_url || <span className="italic">Not set</span>}
                      </div>
                    )}
                    {graphic.icon_image_url && (
                      <div className="aspect-square bg-muted rounded-md overflow-hidden">
                        <img
                          src={graphic.icon_image_url}
                          alt="Icon"
                          className="w-full h-full object-contain p-2"
                        />
                      </div>
                    )}
                  </div>

                  {/* Banner Image */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Banner</Label>
                      {graphic.banner_image_url && !isEditing && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleClear(graphic.id, "banner_image_url")}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    {isEditing ? (
                      <Input
                        placeholder="URL"
                        value={editState.banner_image_url}
                        onChange={(e) =>
                          setEditState({ ...editState, banner_image_url: e.target.value })
                        }
                        className="text-sm"
                      />
                    ) : (
                      <div className="text-xs text-muted-foreground truncate">
                        {graphic.banner_image_url || <span className="italic">Not set</span>}
                      </div>
                    )}
                    {graphic.banner_image_url && (
                      <div className="aspect-[3/1] bg-muted rounded-md overflow-hidden">
                        <img
                          src={graphic.banner_image_url}
                          alt="Banner"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-base md:text-lg">📱 Usage Guidelines</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs md:text-sm text-muted-foreground">
          <p><strong>Hero Image:</strong> Main visual at top of page (16:9 desktop, 4:3 mobile)</p>
          <p><strong>Background:</strong> Full-page background pattern or texture</p>
          <p><strong>Accent:</strong> Decorative element or section divider</p>
          <p><strong>Icon:</strong> Page icon or logo (square, transparent PNG recommended)</p>
          <p><strong>Banner:</strong> Wide promotional or header banner (3:1 ratio)</p>
          <p className="pt-2"><strong>Recommended sizes:</strong> Hero 1920x1080px, Background 1920x1080px, Accent 500x500px, Icon 256x256px, Banner 1500x500px</p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PageGraphicsAdminPage() {
  return (
    <AdminRoute>
      <PageGraphicsAdmin />
    </AdminRoute>
  );
}
