import { useMemo, useState } from "react";
import { LifestylePropertyFeature } from "@/types/lifestyle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Sparkles } from "lucide-react";

interface PropertyCustomizationTabsProps {
  features: LifestylePropertyFeature[];
  selectedFeatureIds: string[];
  onToggleFeature: (featureId: string) => void;
}

const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const formatCategoryLabel = (category: string) => {
  if (!category) return "Custom";
  return category
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

export function PropertyCustomizationTabs({
  features,
  selectedFeatureIds,
  onToggleFeature,
}: PropertyCustomizationTabsProps) {
  const [activeTab, setActiveTab] = useState<string | undefined>(
    features[0]?.feature_type
  );

  const featuresByCategory = useMemo(() => {
    return features.reduce<Record<string, LifestylePropertyFeature[]>>((acc, feature) => {
      const key = feature.feature_type || "custom";
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(feature);
      return acc;
    }, {});
  }, [features]);

  const categories = Object.keys(featuresByCategory);

  if (features.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Customization Options</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This property does not have additional upgrade paths yet. Check back soon as designers add lifestyle-curated packages.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <CardTitle>Customization Packages</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          Tailor the space to your creative lifestyle. Toggle enhancements to see how they shape your final investment.
        </p>
      </CardHeader>
      <CardContent>
        <Tabs
          value={activeTab ?? categories[0]}
          onValueChange={setActiveTab}
          className="space-y-4"
        >
          <TabsList className="flex w-full flex-wrap justify-start gap-2 bg-muted/50 p-1">
            {categories.map((category) => (
              <TabsTrigger key={category} value={category} className="capitalize">
                {formatCategoryLabel(category)}
              </TabsTrigger>
            ))}
          </TabsList>

          {categories.map((category) => (
            <TabsContent key={category} value={category}>
              <div className="space-y-3">
                {featuresByCategory[category].map((feature) => {
                  const selected = selectedFeatureIds.includes(feature.id);
                  const impactEntries = feature.impact
                    ? Object.entries(feature.impact)
                    : [];

                  return (
                    <Card
                      key={feature.id}
                      className={selected ? "border-primary/60" : "border-muted"}
                    >
                      <CardContent className="space-y-3 p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <h3 className="text-lg font-semibold">{feature.feature_name}</h3>
                              <Badge variant={selected ? "default" : "outline"}>
                                {selected ? "Selected" : "Optional"}
                              </Badge>
                            </div>
                            {feature.description && (
                              <p className="text-sm text-muted-foreground">
                                {feature.description}
                              </p>
                            )}
                            {impactEntries.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {impactEntries.map(([key, value]) => (
                                  <Badge key={key} variant="secondary" className="text-xs">
                                    {formatCategoryLabel(key)}: {value}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-3 self-stretch md:self-auto">
                            <div className="text-right">
                              <p className="text-sm text-muted-foreground">Upgrade Cost</p>
                              <p className="text-lg font-semibold text-primary">
                                {currencyFormatter.format(feature.upgrade_cost)}
                              </p>
                            </div>
                            <Separator orientation="vertical" className="hidden h-12 md:block" />
                            <Switch
                              checked={selected}
                              onCheckedChange={() => onToggleFeature(feature.id)}
                              aria-label={`Toggle ${feature.feature_name}`}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
