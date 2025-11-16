import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SavedDesignsProps {
  bandId: string;
  onLoadDesign?: (designId: string) => void;
  onUseDesign?: (designId: string, designName: string) => void;
}

export const SavedDesigns = ({ bandId, onLoadDesign, onUseDesign }: SavedDesignsProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: designs, isLoading } = useQuery({
    queryKey: ['tshirt-designs', bandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tshirt_designs')
        .select('*')
        .eq('band_id', bandId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!bandId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (designId: string) => {
      const { error } = await supabase
        .from('tshirt_designs')
        .delete()
        .eq('id', designId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tshirt-designs', bandId] });
      toast({
        title: "Design deleted",
        description: "The design has been removed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!designs || designs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Saved Designs</CardTitle>
          <CardDescription>No saved designs yet</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Create your first custom t-shirt design to see it here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Saved Designs</CardTitle>
        <CardDescription>Your custom t-shirt designs</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {designs.map((design) => (
            <Card key={design.id} className="overflow-hidden">
              <div className="aspect-square bg-muted relative">
                {design.preview_image_url ? (
                  <img
                    src={design.preview_image_url}
                    alt={design.design_name}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    No preview
                  </div>
                )}
              </div>
              <CardContent className="p-4 space-y-3">
                <div>
                  <h3 className="font-semibold truncate">{design.design_name}</h3>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {design.background_color}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      +1% sales
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-2">
                  {onLoadDesign && (
                    <Button
                      onClick={() => onLoadDesign(design.id)}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                  )}
                  {onUseDesign && (
                    <Button
                      onClick={() => onUseDesign(design.id, design.design_name)}
                      variant="default"
                      size="sm"
                      className="flex-1"
                    >
                      Use
                    </Button>
                  )}
                  <Button
                    onClick={() => deleteMutation.mutate(design.id)}
                    variant="destructive"
                    size="sm"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
