import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Settings } from "lucide-react";

interface BandSettingsProps {
  bandId: string;
  currentMaxMembers: number;
  currentAllowApplications: boolean;
  isLeader: boolean;
}

export const BandSettings = ({
  bandId,
  currentMaxMembers,
  currentAllowApplications,
  isLeader,
}: BandSettingsProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [maxMembers, setMaxMembers] = useState(currentMaxMembers || 4);
  const [allowApplications, setAllowApplications] = useState(currentAllowApplications ?? true);

  const updateSettingsMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("bands")
        .update({
          max_members: maxMembers,
          allow_applications: allowApplications,
        })
        .eq("id", bandId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Settings Updated",
        description: "Band settings have been successfully updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["band", bandId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!isLeader) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Band Settings
        </CardTitle>
        <CardDescription>Configure your band's membership settings</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="max-members">Maximum Band Members</Label>
          <Input
            id="max-members"
            type="number"
            min={1}
            max={10}
            value={maxMembers}
            onChange={(e) => setMaxMembers(parseInt(e.target.value) || 4)}
          />
          <p className="text-xs text-muted-foreground">
            Set the maximum number of members allowed in your band (1-10)
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="allow-applications">Allow Applications</Label>
            <p className="text-xs text-muted-foreground">
              Let players apply to join your band without an invitation
            </p>
          </div>
          <Switch
            id="allow-applications"
            checked={allowApplications}
            onCheckedChange={setAllowApplications}
          />
        </div>

        <Button
          onClick={() => updateSettingsMutation.mutate()}
          disabled={updateSettingsMutation.isPending}
          className="w-full"
        >
          Save Settings
        </Button>
      </CardContent>
    </Card>
  );
};
