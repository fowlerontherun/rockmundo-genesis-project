import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Eye, Loader2, PackageCheck, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ReleaseDesignDialog } from "./ReleaseDesignDialog";

interface SavedDesignsProps {
  bandId: string;
  onLoadDesign?: (designId: string) => void;
  onUseDesign?: (designId: string, designName: string) => void;
}

export const SavedDesigns = ({ bandId, onLoadDesign }: SavedDesignsProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [releaseDialogOpen, setReleaseDialogOpen] = useState(false);
  const [selectedDesign, setSelectedDesign] = useState<{ id: string; name: string } | null>(null);

  const { data: designs, isLoading } = useQuery({
    queryKey: ["tshirt-designs", bandId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("tshirt_designs")
        .select("*")
        .eq("band_id", bandId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: Boolean(bandId),
  });

  const deleteMutation = useMutation({
    mutationFn: async (designId: string) => {
      const { error } = await supabase.from("tshirt_designs").delete().eq("id", designId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tshirt-designs", bandId] });
      toast({ title: "Design deleted", description: "The saved merchandise design has been removed." });
    },
    onError: (error: any) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  const handleReleaseClick = (designId: string, designName: string) => {
    setSelectedDesign({ id: designId, name: designName });
    setReleaseDialogOpen(true);
  };

  if (isLoading) {
    return <Card><CardContent className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></CardContent></Card>;
  }

  if (!designs?.length) {
    return (
      <Card>
        <CardHeader><CardTitle>Saved Designs</CardTitle><CardDescription>No saved merchandise designs yet</CardDescription></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">Create a product in Merch Studio, upload artwork or add text, then save it to build a reusable design library.</p></CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Saved Designs</CardTitle>
          <CardDescription>Reusable product artwork and mock-ups for future merchandise drops</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {designs.map((design: any) => (
              <Card key={design.id} className="overflow-hidden">
                <div className="relative aspect-square bg-muted">
                  {design.preview_image_url ? <img src={design.preview_image_url} alt={design.design_name} className="h-full w-full object-contain" /> : <div className="flex h-full items-center justify-center text-muted-foreground">No preview</div>}
                </div>
                <CardContent className="space-y-3 p-4">
                  <div>
                    <h3 className="truncate font-semibold">{design.design_name}</h3>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <Badge variant="outline" className="text-xs">{design.product_type || "Graphic Tee"}</Badge>
                      {design.artwork_url ? <Badge variant="secondary" className="text-xs">Uploaded artwork</Badge> : null}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {onLoadDesign ? (
                      <Button onClick={() => onLoadDesign(design.id)} variant="outline" size="sm" className="flex-1"><Eye className="mr-1 h-3 w-3" /> Edit</Button>
                    ) : null}
                    <Button onClick={() => handleReleaseClick(design.id, design.design_name)} size="sm" className="flex-1"><PackageCheck className="mr-1 h-3 w-3" /> Produce</Button>
                    <Button onClick={() => deleteMutation.mutate(design.id)} variant="destructive" size="sm"><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {selectedDesign ? (
        <ReleaseDesignDialog
          open={releaseDialogOpen}
          onOpenChange={setReleaseDialogOpen}
          designId={selectedDesign.id}
          designName={selectedDesign.name}
          bandId={bandId}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ["player-merchandise", bandId] })}
        />
      ) : null}
    </>
  );
};
