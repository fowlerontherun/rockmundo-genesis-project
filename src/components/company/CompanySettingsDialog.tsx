import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings, Loader2, DollarSign, Bell, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Company, CompanySettings } from "@/types/company";

interface CompanySettingsDialogProps {
  company: Company;
  trigger?: React.ReactNode;
}

export const CompanySettingsDialog = ({
  company,
  trigger,
}: CompanySettingsDialogProps) => {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Local state for form
  const [autoPay, setAutoPay] = useState(true);
  const [dividendPercent, setDividendPercent] = useState(0);
  const [allowSubsidiaries, setAllowSubsidiaries] = useState(true);
  const [maxSubsidiaries, setMaxSubsidiaries] = useState(10);
  const [lowThreshold, setLowThreshold] = useState(10000);
  const [criticalThreshold, setCriticalThreshold] = useState(1000);

  // Fetch settings
  const { data: settings, isLoading } = useQuery<CompanySettings | null>({
    queryKey: ["company-settings", company.id],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_settings")
        .select("*")
        .eq("company_id", company.id)
        .maybeSingle();

      if (error) throw error;
      return data as CompanySettings | null;
    },
  });

  // Update local state when settings load
  useEffect(() => {
    if (settings) {
      setAutoPay(settings.auto_pay_salaries);
      setDividendPercent(settings.dividend_payout_percent);
      setAllowSubsidiaries(settings.allow_subsidiary_creation);
      setMaxSubsidiaries(settings.max_subsidiaries);
      setLowThreshold(settings.notification_threshold_low);
      setCriticalThreshold(settings.notification_threshold_critical);
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<CompanySettings>) => {
      const { error } = await supabase
        .from("company_settings")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("company_id", company.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-settings", company.id] });
      toast({
        title: "Settings Updated",
        description: "Company settings have been saved.",
      });
      setOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      auto_pay_salaries: autoPay,
      dividend_payout_percent: dividendPercent,
      allow_subsidiary_creation: allowSubsidiaries,
      max_subsidiaries: maxSubsidiaries,
      notification_threshold_low: lowThreshold,
      notification_threshold_critical: criticalThreshold,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {company.name} Settings
          </DialogTitle>
          <DialogDescription>
            Configure company policies and notifications
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Payroll Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Users className="h-4 w-4 text-muted-foreground" />
                Payroll
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-pay Salaries</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically pay employee salaries weekly
                  </p>
                </div>
                <Switch
                  checked={autoPay}
                  onCheckedChange={setAutoPay}
                />
              </div>
            </div>

            <Separator />

            {/* Dividend Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                Dividends
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Dividend Payout</Label>
                  <span className="text-sm font-mono">{dividendPercent}%</span>
                </div>
                <Slider
                  value={[dividendPercent]}
                  onValueChange={([v]) => setDividendPercent(v)}
                  max={100}
                  step={5}
                />
                <p className="text-xs text-muted-foreground">
                  Percentage of profits paid out as dividends (rest is reinvested)
                </p>
              </div>
            </div>

            {company.company_type === 'holding' && (
              <>
                <Separator />

                {/* Subsidiaries Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Allow Subsidiary Creation</Label>
                      <p className="text-xs text-muted-foreground">
                        Allow creating new subsidiaries under this company
                      </p>
                    </div>
                    <Switch
                      checked={allowSubsidiaries}
                      onCheckedChange={setAllowSubsidiaries}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Subsidiaries</Label>
                    <Input
                      type="number"
                      value={maxSubsidiaries}
                      onChange={(e) => setMaxSubsidiaries(parseInt(e.target.value) || 0)}
                      min={1}
                      max={50}
                    />
                  </div>
                </div>
              </>
            )}

            <Separator />

            {/* Notification Thresholds */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Bell className="h-4 w-4 text-muted-foreground" />
                Notification Thresholds
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Low Balance Warning</Label>
                  <Input
                    type="number"
                    value={lowThreshold}
                    onChange={(e) => setLowThreshold(parseFloat(e.target.value) || 0)}
                    min={0}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Critical Balance</Label>
                  <Input
                    type="number"
                    value={criticalThreshold}
                    onChange={(e) => setCriticalThreshold(parseFloat(e.target.value) || 0)}
                    min={0}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleSave}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Settings"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
