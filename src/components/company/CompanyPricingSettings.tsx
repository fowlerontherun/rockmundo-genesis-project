import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { DollarSign, Save, Percent, Clock, Truck } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PricingField {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: 'currency' | 'percent' | 'multiplier' | 'hours';
  description?: string;
}

interface CompanyPricingSettingsProps {
  companyType: 'recording_studio' | 'rehearsal' | 'venue' | 'security' | 'logistics' | 'merch_factory';
  entityId: string;
  tableName: string;
  currentValues: Record<string, number>;
  onSaved?: () => void;
}

const PRICING_CONFIGS: Record<string, PricingField[]> = {
  recording_studio: [
    { key: 'hourly_rate', label: 'Hourly Rate', min: 50, max: 500, step: 10, unit: 'currency', description: 'Base rate for recording sessions' },
    { key: 'mixing_hourly_rate', label: 'Mixing Rate', min: 50, max: 400, step: 10, unit: 'currency', description: 'Rate for mixing-only sessions' },
    { key: 'mastering_hourly_rate', label: 'Mastering Rate', min: 100, max: 500, step: 10, unit: 'currency', description: 'Rate for mastering services' },
    { key: 'rush_fee_multiplier', label: 'Rush Fee Multiplier', min: 1.0, max: 3.0, step: 0.1, unit: 'multiplier', description: 'Extra charge for same-day bookings' },
    { key: 'minimum_booking_hours', label: 'Minimum Booking', min: 1, max: 8, step: 1, unit: 'hours', description: 'Minimum hours per session' },
  ],
  rehearsal: [
    { key: 'hourly_rate', label: 'Hourly Rate', min: 10, max: 100, step: 5, unit: 'currency', description: 'Base rate for rehearsal time' },
    { key: 'after_hours_multiplier', label: 'After Hours Rate', min: 1.0, max: 2.0, step: 0.1, unit: 'multiplier', description: 'Multiplier for late-night bookings' },
  ],
  venue: [
    { key: 'venue_cut_percent', label: 'Venue Cut', min: 10, max: 50, step: 1, unit: 'percent', description: 'Percentage of ticket revenue' },
    { key: 'bar_revenue_share_percent', label: 'Bar Revenue Share', min: 10, max: 50, step: 1, unit: 'percent', description: 'Share of bar/drink sales' },
    { key: 'private_event_rate', label: 'Private Event Rate', min: 1000, max: 100000, step: 1000, unit: 'currency', description: 'Flat rate for venue rental' },
    { key: 'minimum_guarantee', label: 'Minimum Guarantee', min: 0, max: 10000, step: 100, unit: 'currency', description: 'Minimum payment required' },
  ],
  security: [
    { key: 'guard_rate_per_event', label: 'Guard Rate (per event)', min: 50, max: 500, step: 10, unit: 'currency', description: 'Rate per guard per event' },
    { key: 'weekly_discount_percent', label: 'Weekly Contract Discount', min: 0, max: 25, step: 1, unit: 'percent', description: 'Discount for weekly contracts' },
    { key: 'vip_premium_multiplier', label: 'VIP Premium', min: 1.0, max: 3.0, step: 0.1, unit: 'multiplier', description: 'Multiplier for VIP protection' },
  ],
  logistics: [
    { key: 'per_km_rate', label: 'Per-KM Rate', min: 0.5, max: 5.0, step: 0.1, unit: 'currency', description: 'Rate per kilometer traveled' },
    { key: 'per_day_rate', label: 'Daily Rate', min: 100, max: 2000, step: 50, unit: 'currency', description: 'Flat daily charge' },
    { key: 'insurance_percent', label: 'Insurance %', min: 0.1, max: 1.0, step: 0.05, unit: 'percent', description: 'Insurance as % of cargo value' },
  ],
  merch_factory: [
    { key: 'markup_percent', label: 'Markup %', min: 5, max: 50, step: 1, unit: 'percent', description: 'Markup over base production cost' },
    { key: 'rush_fee_percent', label: 'Rush Order Fee', min: 10, max: 100, step: 5, unit: 'percent', description: 'Extra charge for expedited orders' },
    { key: 'bulk_discount_100', label: 'Bulk Discount (100+)', min: 0, max: 20, step: 1, unit: 'percent', description: 'Discount for 100+ units' },
    { key: 'bulk_discount_500', label: 'Bulk Discount (500+)', min: 0, max: 25, step: 1, unit: 'percent', description: 'Discount for 500+ units' },
    { key: 'bulk_discount_1000', label: 'Bulk Discount (1000+)', min: 0, max: 30, step: 1, unit: 'percent', description: 'Discount for 1000+ units' },
  ],
};

const getUnitIcon = (unit: string) => {
  switch (unit) {
    case 'currency': return <DollarSign className="h-4 w-4" />;
    case 'percent': return <Percent className="h-4 w-4" />;
    case 'multiplier': return <span className="text-xs font-bold">×</span>;
    case 'hours': return <Clock className="h-4 w-4" />;
    default: return null;
  }
};

const formatValue = (value: number, unit: string) => {
  switch (unit) {
    case 'currency': return `$${value.toLocaleString()}`;
    case 'percent': return `${value}%`;
    case 'multiplier': return `${value.toFixed(1)}×`;
    case 'hours': return `${value}h`;
    default: return value.toString();
  }
};

export function CompanyPricingSettings({ 
  companyType, 
  entityId, 
  tableName, 
  currentValues,
  onSaved 
}: CompanyPricingSettingsProps) {
  const [values, setValues] = useState<Record<string, number>>(currentValues);
  const [hasChanges, setHasChanges] = useState(false);
  const queryClient = useQueryClient();

  const fields = PRICING_CONFIGS[companyType] || [];

  useEffect(() => {
    setValues(currentValues);
    setHasChanges(false);
  }, [currentValues]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from(tableName as any)
        .update(values)
        .eq('id', entityId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pricing settings saved");
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: [tableName, entityId] });
      onSaved?.();
    },
    onError: (error: Error) => {
      toast.error(`Failed to save: ${error.message}`);
    },
  });

  const handleValueChange = (key: string, newValue: number[]) => {
    setValues(prev => ({ ...prev, [key]: newValue[0] }));
    setHasChanges(true);
  };

  if (fields.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Pricing Settings
        </CardTitle>
        <CardDescription>
          Set your rates and fees. These affect how attractive your services are to customers.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {fields.map((field) => (
          <div key={field.key} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getUnitIcon(field.unit)}
                <Label>{field.label}</Label>
              </div>
              <span className="font-bold text-lg">
                {formatValue(values[field.key] ?? field.min, field.unit)}
              </span>
            </div>
            {field.description && (
              <p className="text-xs text-muted-foreground">{field.description}</p>
            )}
            <Slider
              value={[values[field.key] ?? field.min]}
              onValueChange={(v) => handleValueChange(field.key, v)}
              min={field.min}
              max={field.max}
              step={field.step}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatValue(field.min, field.unit)}</span>
              <span>{formatValue(field.max, field.unit)}</span>
            </div>
          </div>
        ))}

        <Button 
          onClick={() => saveMutation.mutate()} 
          disabled={!hasChanges || saveMutation.isPending}
          className="w-full"
        >
          <Save className="h-4 w-4 mr-2" />
          {saveMutation.isPending ? 'Saving...' : 'Save Pricing Settings'}
        </Button>
      </CardContent>
    </Card>
  );
}
