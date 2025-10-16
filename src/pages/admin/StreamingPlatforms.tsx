import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Disc, Plus } from "lucide-react";
import { useState } from "react";

const AdminStreamingPlatforms = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);

  const { data: platforms, isLoading } = useQuery({
    queryKey: ["admin-streaming-platforms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("streaming_platforms")
        .select("*")
        .order("platform_name");

      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Disc className="h-10 w-10 text-primary" />
          <div>
            <h1 className="text-4xl font-bold">Streaming Platforms</h1>
            <p className="text-muted-foreground">
              Manage streaming platforms and payout rates
            </p>
          </div>
        </div>
        <Button onClick={() => setIsAdding(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Platform
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8">Loading platforms...</div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {platforms?.map((platform: any) => (
            <Card key={platform.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {platform.platform_name}
                  <Badge variant={platform.is_active ? "default" : "secondary"}>
                    {platform.is_active ? "Active" : "Inactive"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Payout/1k:</span>
                    <div className="font-medium">
                      ${(platform.base_payout_per_stream * 1000).toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Quality Mult:</span>
                    <div className="font-medium">{platform.quality_multiplier}x</div>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Min Quality:</span>
                    <div className="font-medium">{platform.min_quality_requirement}</div>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="w-full">
                  Edit
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminStreamingPlatforms;
