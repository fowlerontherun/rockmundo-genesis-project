import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthContext } from "@/hooks/use-auth-context";
import { useToast } from "@/hooks/use-toast";
import {
  LifestyleProperty,
  LifestylePropertyFeature,
  LifestylePropertyFinancingOption,
} from "@/types/lifestyle";
import { PropertySelectionCard } from "@/components/lifestyle/PropertySelectionCard";
import { PropertyOverview } from "@/components/lifestyle/PropertyOverview";
import { PropertyCustomizationTabs } from "@/components/lifestyle/PropertyCustomizationTabs";
import {
  PropertyFinancingPlanner,
  calculateMonthlyPayment,
} from "@/components/lifestyle/PropertyFinancingPlanner";
import { PropertyPurchaseSummary } from "@/components/lifestyle/PropertyPurchaseSummary";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Home, RefreshCcw } from "lucide-react";

const LifestyleHomesPage = () => {
  const { user } = useContext(AuthContext);
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [properties, setProperties] = useState<LifestyleProperty[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [selectedFeatureIds, setSelectedFeatureIds] = useState<string[]>([]);
  const [selectedFinancingOptionId, setSelectedFinancingOptionId] = useState<string | null>(null);

  const selectedProperty = useMemo(
    () => properties.find((property) => property.id === selectedPropertyId) ?? null,
    [properties, selectedPropertyId]
  );

  const selectedFeatures: LifestylePropertyFeature[] = useMemo(() => {
    if (!selectedProperty?.lifestyle_property_features) return [];
    return selectedProperty.lifestyle_property_features.filter((feature) =>
      selectedFeatureIds.includes(feature.id)
    );
  }, [selectedProperty, selectedFeatureIds]);

  const selectedFinancingOption: LifestylePropertyFinancingOption | null = useMemo(() => {
    if (!selectedProperty?.lifestyle_property_financing_options) return null;
    return (
      selectedProperty.lifestyle_property_financing_options.find(
        (option) => option.id === selectedFinancingOptionId
      ) ?? null
    );
  }, [selectedProperty, selectedFinancingOptionId]);

  const totalUpgradeCost = useMemo(
    () => selectedFeatures.reduce((total, feature) => total + Number(feature.upgrade_cost), 0),
    [selectedFeatures]
  );

  const purchasePrice = selectedProperty
    ? Number(selectedProperty.base_price) + totalUpgradeCost
    : 0;

  const monthlyPayment = selectedFinancingOption
    ? calculateMonthlyPayment(purchasePrice, selectedFinancingOption)
    : null;

  const loadProperties = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("lifestyle_properties")
        .select(`
          *,
          lifestyle_property_features(*),
          lifestyle_property_financing_options(*)
        `)
        .eq("available", true)
        .order("base_price", { ascending: true });

      if (error) {
        console.error("Error loading lifestyle properties", error);
        toast({
          title: "Unable to load properties",
          description: "Please try again later.",
          variant: "destructive",
        });
        return;
      }

      const typedProperties = (data ?? []) as LifestyleProperty[];
      setProperties(typedProperties);

      if (typedProperties.length > 0) {
        const firstProperty = typedProperties[0];
        setSelectedPropertyId(firstProperty.id);
        setSelectedFeatureIds([]);
        const firstFinancingOption = firstProperty.lifestyle_property_financing_options?.[0]?.id ?? null;
        setSelectedFinancingOptionId(firstFinancingOption);
      }
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadProperties();
  }, [loadProperties]);

  useEffect(() => {
    if (!selectedProperty) return;

    if (
      selectedProperty.lifestyle_property_financing_options &&
      selectedProperty.lifestyle_property_financing_options.length > 0
    ) {
      const firstOptionId = selectedProperty.lifestyle_property_financing_options[0].id;
      setSelectedFinancingOptionId((current) => current ?? firstOptionId);
    } else {
      setSelectedFinancingOptionId(null);
    }
  }, [selectedProperty]);

  const handleToggleFeature = (featureId: string) => {
    setSelectedFeatureIds((current) => {
      if (current.includes(featureId)) {
        return current.filter((id) => id !== featureId);
      }
      return [...current, featureId];
    });
  };

  const handlePurchase = async () => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Create an account to reserve this lifestyle property.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedProperty) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from("lifestyle_property_purchases").insert({
        user_id: user.id,
        property_id: selectedProperty.id,
        financing_option_id: selectedFinancingOption?.id ?? null,
        selected_features: selectedFeatures.map((feature) => ({
          id: feature.id,
          name: feature.feature_name,
          type: feature.feature_type,
          cost: Number(feature.upgrade_cost),
        })),
        total_upgrade_cost: totalUpgradeCost,
        purchase_price: purchasePrice,
        status: "pending",
      });

      if (error) {
        console.error("Error creating lifestyle property purchase", error);
        toast({
          title: "Purchase could not be started",
          description: "Please review your selections and try again.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Purchase flow started",
        description: `${selectedProperty.name} has been reserved. Our concierge team will reach out with next steps.`,
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded-full bg-primary/10" />
          <div className="space-y-2">
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
            <div className="h-3 w-48 animate-pulse rounded bg-muted/60" />
          </div>
        </div>
        <Card className="animate-pulse border-dashed">
          <CardContent className="space-y-4 p-6">
            <div className="h-6 w-2/3 rounded bg-muted" />
            <div className="h-4 w-full rounded bg-muted/60" />
            <div className="h-4 w-5/6 rounded bg-muted/60" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <Home className="h-6 w-6" />
            <span className="text-sm font-semibold uppercase tracking-wider">Lifestyle Collection</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Homes & Creative Residences</h1>
          <p className="text-muted-foreground">
            Explore curated properties optimized for touring musicians. Customize your space and launch a concierge-guided purchase flow in minutes.
          </p>
        </div>
        <Button variant="outline" onClick={loadProperties} className="w-full md:w-auto">
          <RefreshCcw className="mr-2 h-4 w-4" />
          Refresh Listings
        </Button>
      </header>

      {properties.length === 0 ? (
        <Alert>
          <AlertTitle>No lifestyle residences available</AlertTitle>
          <AlertDescription>
            Our real estate scouts are preparing the next wave of creative homes. Check back soon for artist-ready properties.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {properties.map((property) => (
            <PropertySelectionCard
              key={property.id}
              property={property}
              selected={selectedPropertyId === property.id}
              onSelect={() => {
                setSelectedPropertyId(property.id);
                setSelectedFeatureIds([]);
                const firstOptionId = property.lifestyle_property_financing_options?.[0]?.id ?? null;
                setSelectedFinancingOptionId(firstOptionId);
              }}
            />
          ))}
        </div>
      )}

      <Separator className="my-6" />

      {selectedProperty && (
        <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
          <div className="space-y-6">
            <PropertyOverview property={selectedProperty} />
            <PropertyCustomizationTabs
              features={selectedProperty.lifestyle_property_features ?? []}
              selectedFeatureIds={selectedFeatureIds}
              onToggleFeature={handleToggleFeature}
            />
          </div>
          <div className="space-y-6">
            <PropertyFinancingPlanner
              purchasePrice={purchasePrice}
              options={selectedProperty.lifestyle_property_financing_options ?? []}
              selectedOptionId={selectedFinancingOptionId}
              onSelectOption={setSelectedFinancingOptionId}
            />
            <PropertyPurchaseSummary
              property={selectedProperty}
              selectedFeatures={selectedFeatures}
              totalUpgradeCost={totalUpgradeCost}
              purchasePrice={purchasePrice}
              selectedFinancingOption={selectedFinancingOption}
              monthlyPayment={monthlyPayment}
              onPurchase={handlePurchase}
              loading={submitting}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default LifestyleHomesPage;
