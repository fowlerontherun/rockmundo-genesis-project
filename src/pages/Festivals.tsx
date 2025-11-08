import {
  apiEndpoints,
  backgroundJobs,
  calculators,
  dataModelTables,
  defaultFestivalSimulationInput,
  demandFactors,
  festivalCostProfiles,
  festivalLicenseDetails,
  festivalSizeTiers,
  festivalTracks,
  getFestivalCostProfileByTier,
  getFestivalLicenseByTier,
  getFestivalSizeTierById,
  lifecycleBeats,
  pricingTiers,
  profitStreams,
  simulateFestival,
  systemsInterplay,
  weatherOptions,
} from "@/data/festivals";
import type {
  FestivalPricingPolicy,
  FestivalPricingTier,
  FestivalSimulationInput,
  FestivalWeatherCondition,
} from "@/data/festivals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  CloudLightning,
  CloudRain,
  CloudSun,
  Handshake,
  LineChart,
  Network,
  PiggyBank,
  ShieldAlert,
  Sparkles,
  Sun,
  Ticket,
  TrendingUp,
  Users,
} from "lucide-react";
import type React from "react";
import { useCallback, useMemo, useState } from "react";

const currencyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

const percentageFormatter = new Intl.NumberFormat("en-GB", {
  style: "percent",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("en-GB");

function formatPriceRange([low, high]: [number, number]) {
  return `${currencyFormatter.format(low)}–${currencyFormatter.format(high)}`;
}

function formatDayRange([min, max]: [number, number]) {
  return min === max ? `${min} day` : `${min}-${max} days`;
}

const formatSignedPercent = (value: number) => {
  const percentage = value * 100;
  return `${percentage > 0 ? "+" : ""}${percentage.toFixed(0)}%`;
};

const formatSignedDecimal = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;

const clampNumber = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const derivePricingPolicy = (
  value: number,
  [low, high]: [number, number],
): FestivalPricingPolicy => {
  if (value <= low) {
    return "cheap";
  }
  if (value >= high) {
    return "pricey";
  }
  return "standard";
};

const weatherIconMap: Record<FestivalWeatherCondition, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  sun: Sun,
  cloud: CloudSun,
  rain: CloudRain,
  storm: CloudLightning,
};

type PricingCategory = FestivalPricingTier["category"];
export default function Festivals() {
  const pricingByCategory = useMemo(() => {
    return pricingTiers.reduce<Record<PricingCategory, FestivalPricingTier[]>>(
      (acc, tier) => {
        acc[tier.category] = [...acc[tier.category], tier];
        return acc;
      },
      { food: [], drink: [], merch: [] },
    );
  }, []);

  const [simulationInput, setSimulationInput] = useState<FestivalSimulationInput>(() => ({
    ...defaultFestivalSimulationInput,
    daysConfig: [...defaultFestivalSimulationInput.daysConfig],
  }));

  const selectedTier = useMemo(
    () => getFestivalSizeTierById(simulationInput.sizeTierId),
    [simulationInput.sizeTierId],
  );

  const weatherLookup = useMemo(
    () => Object.fromEntries(weatherOptions.map((option) => [option.value, option])),
    [],
  );

  const ticketRange = useMemo(() => {
    const [low, high] = selectedTier.recommendedTicketPrice;
    return {
      min: Math.round(Math.max(5, low * 0.6)),
      max: Math.round(high * 1.4),
    };
  }, [selectedTier]);

  const simulation = useMemo(() => simulateFestival(simulationInput), [simulationInput]);

  const operationsComponents = useMemo(() => {
    const dayCount = simulation.demand.length || 1;
    const costProfile = getFestivalCostProfileByTier(selectedTier.id);
    return [
      { label: "One-off staffing", value: costProfile.oneOffStaffing },
      { label: "Security", value: costProfile.securityPerDay * dayCount },
      { label: "Insurance", value: costProfile.insuranceFlat },
      { label: "Stage & tech", value: costProfile.stagePerDay * dayCount },
      { label: "Waste & permits", value: costProfile.wastePermits },
      { label: "Marketing", value: costProfile.marketingFlat },
    ];
  }, [selectedTier.id, simulation.demand.length]);

  const operationsRawTotal = useMemo(
    () => operationsComponents.reduce((sum, entry) => sum + entry.value, 0),
    [operationsComponents],
  );

  const scoreBreakdownRows = useMemo(
    () => [
      {
        key: "profitMargin",
        label: "Profit margin",
        display: percentageFormatter.format(simulation.scoreBreakdown.profitMargin.value),
        z: simulation.scoreBreakdown.profitMargin.z,
      },
      {
        key: "attendanceRate",
        label: "Attendance rate",
        display: percentageFormatter.format(simulation.scoreBreakdown.attendanceRate.value),
        z: simulation.scoreBreakdown.attendanceRate.z,
      },
      {
        key: "artistSatisfaction",
        label: "Artist satisfaction",
        display: percentageFormatter.format(simulation.scoreBreakdown.artistSatisfaction.value),
        z: simulation.scoreBreakdown.artistSatisfaction.z,
      },
      {
        key: "visitorSentiment",
        label: "Visitor sentiment",
        display: percentageFormatter.format(simulation.scoreBreakdown.visitorSentiment.value),
        z: simulation.scoreBreakdown.visitorSentiment.z,
      },
    ],
    [simulation.scoreBreakdown],
  );

  const licenseForDisplay = useMemo(
    () =>
      simulationInput.ownerType === "player"
        ? simulation.license ?? getFestivalLicenseByTier(selectedTier.id)
        : null,
    [simulationInput.ownerType, simulation.license, selectedTier.id],
  );

  const handleOwnerChange = useCallback(
    (value: FestivalSimulationInput["ownerType"]) => {
      setSimulationInput((prev) => ({ ...prev, ownerType: value }));
    },
    [],
  );

  const handleSizeTierChange = useCallback((value: FestivalSimulationInput["sizeTierId"]) => {
    const targetTier = getFestivalSizeTierById(value);
    const [minDays, maxDays] = targetTier.dayRange;
    const recommendedMid = Math.round(
      (targetTier.recommendedTicketPrice[0] + targetTier.recommendedTicketPrice[1]) / 2,
    );
    setSimulationInput((prev) => {
      const nextDays = clampNumber(prev.days, minDays, maxDays);
      const fallbackWeather = prev.daysConfig[prev.daysConfig.length - 1]?.weather ?? "cloud";
      const nextDaysConfig = Array.from({ length: nextDays }, (_, index) =>
        prev.daysConfig[index] ?? { weather: fallbackWeather },
      );
      return {
        ...prev,
        sizeTierId: value,
        days: nextDays,
        actsPerDay: Math.max(targetTier.baseActsPerDay, Math.min(prev.actsPerDay, targetTier.baseActsPerDay + 4)),
        ticketPrice: recommendedMid,
        pricingPolicy: "standard",
        daysConfig: nextDaysConfig,
      };
    });
  }, []);

  const handleDaysChange = useCallback(
    (value: number) => {
      setSimulationInput((prev) => {
        const [minDays, maxDays] = selectedTier.dayRange;
        const nextDays = clampNumber(value, minDays, maxDays);
        const fallbackWeather = prev.daysConfig[prev.daysConfig.length - 1]?.weather ?? "cloud";
        const nextDaysConfig = Array.from({ length: nextDays }, (_, index) =>
          prev.daysConfig[index] ?? { weather: fallbackWeather },
        );
        return {
          ...prev,
          days: nextDays,
          daysConfig: nextDaysConfig,
        };
      });
    },
    [selectedTier.dayRange],
  );

  const handleActsPerDayChange = useCallback(
    (value: number) => {
      setSimulationInput((prev) => ({
        ...prev,
        actsPerDay: clampNumber(
          value,
          Math.max(3, selectedTier.baseActsPerDay - 2),
          selectedTier.baseActsPerDay + 4,
        ),
      }));
    },
    [selectedTier.baseActsPerDay],
  );

  const handleTicketPriceChange = useCallback(
    (value: number) => {
      const clampedValue = clampNumber(value, ticketRange.min, ticketRange.max);
      setSimulationInput((prev) => ({
        ...prev,
        ticketPrice: clampedValue,
        pricingPolicy: derivePricingPolicy(clampedValue, selectedTier.recommendedTicketPrice),
      }));
    },
    [selectedTier.recommendedTicketPrice, ticketRange],
  );

  const handlePricingPolicyShortcut = useCallback(
    (policy: FestivalPricingPolicy) => {
      const [low, high] = selectedTier.recommendedTicketPrice;
      const target =
        policy === "cheap"
          ? low
          : policy === "pricey"
            ? high
            : Math.round((low + high) / 2);
      handleTicketPriceChange(target);
    },
    [handleTicketPriceChange, selectedTier.recommendedTicketPrice],
  );

  const handleWeatherChange = useCallback((index: number, weather: FestivalWeatherCondition) => {
    setSimulationInput((prev) => {
      const nextDaysConfig = prev.daysConfig.map((config, idx) =>
        idx === index ? { weather } : config,
      );
      return { ...prev, daysConfig: nextDaysConfig };
    });
  }, []);

  const handleFoodTierChange = useCallback((tier: FestivalSimulationInput["foodTier"]) => {
    setSimulationInput((prev) => ({ ...prev, foodTier: tier }));
  }, []);

  const handleDrinkTierChange = useCallback((tier: FestivalSimulationInput["drinkTier"]) => {
    setSimulationInput((prev) => ({ ...prev, drinkTier: tier }));
  }, []);

  const handleMerchTierChange = useCallback((tier: FestivalSimulationInput["merchTier"]) => {
    setSimulationInput((prev) => ({ ...prev, merchTier: tier }));
  }, []);

  const handleExclusiveSponsorChange = useCallback((checked: boolean) => {
    setSimulationInput((prev) => ({ ...prev, exclusiveSponsor: checked }));
  }, []);

  const handleWeatherMitigationChange = useCallback((checked: boolean) => {
    setSimulationInput((prev) => ({ ...prev, weatherMitigation: checked }));
  }, []);

  const currentPricingPolicy = derivePricingPolicy(
    simulationInput.ticketPrice,
    selectedTier.recommendedTicketPrice,
  );
  return (
    <div className="container mx-auto space-y-12 px-4 py-10">
      <header className="space-y-4 text-center md:text-left">
        <Badge variant="secondary" className="text-sm uppercase tracking-wide">
          Festival Systems Launchpad
        </Badge>
        <div className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Festival Operations & Simulation Hub
          </h1>
          <p className="mx-auto max-w-4xl text-muted-foreground md:mx-0 md:text-base">
            Craft the next era of RockMundo festivals with an interactive forecast, ownership tracks, and a
            fully-instrumented data model. Tweak pricing, sentiment, weather, and sponsor strategy to watch the P&amp;L,
            Festival Score, and next-year guidance update in real time, then explore the systems that keep each edition
            humming.
          </p>
        </div>
      </header>

      <section className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">Festival planner & forecast</h2>
            <p className="text-sm text-muted-foreground">
              Dial in ownership, tier, pricing, sentiment, and weather to simulate attendance, revenue mix, and Festival
              Score. Use the quick presets or fine-grained sliders to see how every lever interacts.
            </p>
          </div>
          <Badge variant="outline" className="flex items-center gap-2 text-xs uppercase">
            <Sparkles className="h-3.5 w-3.5" /> Live economics sandbox
          </Badge>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_1fr]">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Scenario inputs</CardTitle>
              <CardDescription>
                Configure the festival profile, then tune hype, sentiment, and weather to see the downstream impact on demand,
                profitability, and score.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Ownership track
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { id: "player", label: "Player license" },
                      { id: "admin", label: "Admin catalogue" },
                    ] as const
                  ).map((option) => (
                    <Button
                      key={option.id}
                      type="button"
                      variant={simulationInput.ownerType === option.id ? "default" : "outline"}
                      className="justify-start"
                      onClick={() => handleOwnerChange(option.id)}
                    >
                      <span className="flex items-center gap-2 text-sm">
                        {option.id === "player" ? <Users className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
                        {option.label}
                      </span>
                    </Button>
                  ))}
                </div>
                {licenseForDisplay ? (
                  <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3 text-xs text-left">
                    <p className="text-sm font-semibold text-foreground">License outlook</p>
                    <p className="text-muted-foreground">
                      Unlock fee {currencyFormatter.format(licenseForDisplay.unlockCost)} · Annual renewal{' '}
                      {currencyFormatter.format(licenseForDisplay.annualRenewal)} · One-off staffing{' '}
                      {currencyFormatter.format(licenseForDisplay.oneOffStaffingCost)}
                    </p>
                    <p className="mt-1 text-muted-foreground">{licenseForDisplay.notes}</p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Admin-run festivals lean on canonical recurrence, prestige sponsors, and override tooling.
                  </p>
                )}
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="size-tier">Festival size tier</Label>
                    <Select
                      value={simulationInput.sizeTierId}
                      onValueChange={(value) => handleSizeTierChange(value as FestivalSimulationInput["sizeTierId"])}
                    >
                      <SelectTrigger id="size-tier">
                        <SelectValue placeholder="Select size tier" />
                      </SelectTrigger>
                      <SelectContent>
                        {festivalSizeTiers.map((tier) => (
                          <SelectItem key={tier.id} value={tier.id}>
                            {tier.label} · cap {tier.capacityCap.toLocaleString()} · {formatDayRange(tier.dayRange)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">{selectedTier.description}</p>
                  </div>

                  <div className="grid gap-2">
                    <Label>Schedule</Label>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Select
                          value={simulationInput.days.toString()}
                          onValueChange={(value) => handleDaysChange(Number(value))}
                        >
                          <SelectTrigger className="w-[120px]">
                            <SelectValue placeholder="Days" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from(
                              { length: selectedTier.dayRange[1] - selectedTier.dayRange[0] + 1 },
                              (_, index) => selectedTier.dayRange[0] + index,
                            ).map((daysOption) => (
                              <SelectItem key={daysOption} value={daysOption.toString()}>
                                {daysOption} {daysOption === 1 ? "day" : "days"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span className="text-xs text-muted-foreground">within tier allowance</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          id="acts-per-day"
                          type="number"
                          min={1}
                          value={simulationInput.actsPerDay}
                          onChange={(event) => handleActsPerDayChange(parseInt(event.target.value, 10) || 0)}
                          className="w-[110px]"
                        />
                        <span className="text-xs text-muted-foreground">acts per day</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="ticket-price">Ticket price</Label>
                  <Badge variant="outline" className="text-xs">
                    Recommended {formatPriceRange(selectedTier.recommendedTicketPrice)}
                  </Badge>
                </div>
                <div className="space-y-3">
                  <Slider
                    value={[simulationInput.ticketPrice]}
                    min={ticketRange.min}
                    max={ticketRange.max}
                    step={1}
                    onValueChange={([value]) => handleTicketPriceChange(value)}
                  />
                  <div className="flex items-center justify-between text-sm">
                    <Input
                      id="ticket-price"
                      type="number"
                      min={ticketRange.min}
                      max={ticketRange.max}
                      value={simulationInput.ticketPrice}
                      onChange={(event) => {
                        const parsed = parseFloat(event.target.value);
                        if (!Number.isNaN(parsed)) {
                          handleTicketPriceChange(parsed);
                        }
                      }}
                      className="w-[140px]"
                    />
                    <div className="flex items-center gap-2">
                      {([
                        { id: "cheap", label: "Cheap" },
                        { id: "standard", label: "Standard" },
                        { id: "pricey", label: "Pricey" },
                      ] as const).map((option) => (
                        <Button
                          key={option.id}
                          type="button"
                          size="sm"
                          variant={currentPricingPolicy === option.id ? "default" : "outline"}
                          onClick={() => handlePricingPolicyShortcut(option.id)}
                          className="text-xs"
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="grid gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Food pricing</Label>
                      <span className="text-xs text-muted-foreground">
                        Avg spend{' '}
                        {currencyFormatter.format(
                          pricingByCategory.food.find((tier) => tier.tier === simulationInput.foodTier)?.spendPerHead ?? 0,
                        )}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {pricingByCategory.food.map((tier) => (
                        <Button
                          key={`food-${tier.tier}`}
                          type="button"
                          variant={simulationInput.foodTier === tier.tier ? "default" : "outline"}
                          onClick={() => handleFoodTierChange(tier.tier)}
                          className="flex flex-col items-start gap-1 px-3 py-2 text-left"
                        >
                          <span className="text-sm font-semibold capitalize">{tier.tier}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatSignedPercent(tier.attachRateModifier - 1)} attach
                          </span>
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Drink pricing</Label>
                      <span className="text-xs text-muted-foreground">
                        Avg spend{' '}
                        {currencyFormatter.format(
                          pricingByCategory.drink.find((tier) => tier.tier === simulationInput.drinkTier)?.spendPerHead ?? 0,
                        )}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {pricingByCategory.drink.map((tier) => (
                        <Button
                          key={`drink-${tier.tier}`}
                          type="button"
                          variant={simulationInput.drinkTier === tier.tier ? "default" : "outline"}
                          onClick={() => handleDrinkTierChange(tier.tier)}
                          className="flex flex-col items-start gap-1 px-3 py-2 text-left"
                        >
                          <span className="text-sm font-semibold capitalize">{tier.tier}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatSignedPercent(tier.attachRateModifier - 1)} attach
                          </span>
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Merch pricing</Label>
                      <span className="text-xs text-muted-foreground">
                        Avg spend{' '}
                        {currencyFormatter.format(
                          pricingByCategory.merch.find((tier) => tier.tier === simulationInput.merchTier)?.spendPerHead ?? 0,
                        )}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {pricingByCategory.merch.map((tier) => (
                        <Button
                          key={`merch-${tier.tier}`}
                          type="button"
                          variant={simulationInput.merchTier === tier.tier ? "default" : "outline"}
                          onClick={() => handleMerchTierChange(tier.tier)}
                          className="flex flex-col items-start gap-1 px-3 py-2 text-left"
                        >
                          <span className="text-sm font-semibold capitalize">{tier.tier}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatSignedPercent(tier.attachRateModifier - 1)} attach
                          </span>
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Hype & lineup</Label>
                  <span className="text-xs text-muted-foreground">
                    Hype {percentageFormatter.format(simulationInput.hype)} · Lineup{' '}
                    {percentageFormatter.format(simulationInput.lineupQuality)}
                  </span>
                </div>
                <div className="space-y-3">
                  <Slider
                    value={[Math.round(simulationInput.hype * 100)]}
                    min={0}
                    max={100}
                    onValueChange={([value]) =>
                      setSimulationInput((prev) => ({ ...prev, hype: value / 100 }))
                    }
                  />
                  <Slider
                    value={[Math.round(simulationInput.lineupQuality * 100)]}
                    min={0}
                    max={100}
                    onValueChange={([value]) =>
                      setSimulationInput((prev) => ({ ...prev, lineupQuality: value / 100 }))
                    }
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Sentiment inputs</Label>
                  <span className="text-xs text-muted-foreground">
                    Visitor {percentageFormatter.format(simulation.sentiments.visitor)} · Artist{' '}
                    {percentageFormatter.format(simulation.sentiments.artist)}
                  </span>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Price sentiment</span>
                      <span>{formatSignedPercent(simulationInput.priceSentiment)}</span>
                    </div>
                    <Slider
                      value={[Math.round(simulationInput.priceSentiment * 100)]}
                      min={-25}
                      max={25}
                      onValueChange={([value]) =>
                        setSimulationInput((prev) => ({ ...prev, priceSentiment: value / 100 }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Sponsor sentiment</span>
                      <span>{formatSignedPercent(simulationInput.sponsorSentiment)}</span>
                    </div>
                    <Slider
                      value={[Math.round(simulationInput.sponsorSentiment * 100)]}
                      min={-15}
                      max={15}
                      onValueChange={([value]) =>
                        setSimulationInput((prev) => ({ ...prev, sponsorSentiment: value / 100 }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Performance sentiment</span>
                      <span>{formatSignedPercent(simulationInput.performanceSentiment)}</span>
                    </div>
                    <Slider
                      value={[Math.round(simulationInput.performanceSentiment * 100)]}
                      min={-12}
                      max={12}
                      onValueChange={([value]) =>
                        setSimulationInput((prev) => ({ ...prev, performanceSentiment: value / 100 }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Sponsor fit</span>
                      <span>{simulationInput.sponsorFit > 0 ? "+" : ""}{simulationInput.sponsorFit}</span>
                    </div>
                    <Slider
                      value={[simulationInput.sponsorFit]}
                      min={-100}
                      max={100}
                      onValueChange={([value]) =>
                        setSimulationInput((prev) => ({ ...prev, sponsorFit: value }))
                      }
                    />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Switch
                          id="exclusive-sponsor"
                          checked={simulationInput.exclusiveSponsor}
                          onCheckedChange={handleExclusiveSponsorChange}
                        />
                        <Label htmlFor="exclusive-sponsor" className="text-xs">
                          Exclusive headline sponsor
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          id="weather-mitigation"
                          checked={simulationInput.weatherMitigation}
                          onCheckedChange={handleWeatherMitigationChange}
                        />
                        <Label htmlFor="weather-mitigation" className="text-xs">
                          Weather mitigation
                        </Label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Weather forecast by day
                </Label>
                <div className="grid gap-3">
                  {simulationInput.daysConfig.map((dayConfig, index) => {
                    const WeatherIcon = weatherIconMap[dayConfig.weather];
                    const option = weatherLookup[dayConfig.weather];
                    return (
                      <div
                        key={`day-${index}`}
                        className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <WeatherIcon className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">Day {index + 1}</p>
                            <p className="text-xs text-muted-foreground">{option.description}</p>
                          </div>
                        </div>
                        <Select
                          value={dayConfig.weather}
                          onValueChange={(value) =>
                            handleWeatherChange(index, value as FestivalWeatherCondition)
                          }
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Weather" />
                          </SelectTrigger>
                          <SelectContent>
                            {weatherOptions.map((weather) => (
                              <SelectItem key={`${index}-${weather.value}`} value={weather.value}>
                                {weather.label} ({formatSignedPercent(weather.impact)})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Forecast summary</CardTitle>
                <CardDescription>
                  Key metrics update automatically as you adjust the configuration. Aim for a healthy margin and score while
                  keeping sentiment balanced.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-xs uppercase">
                    Tier · {selectedTier.label}
                  </Badge>
                  <Badge variant="outline" className="text-xs uppercase">
                    Pricing · {simulation.pricingPolicy}
                  </Badge>
                  {licenseForDisplay ? (
                    <Badge variant="outline" className="text-xs uppercase">
                      License ready · {currencyFormatter.format(licenseForDisplay.unlockCost)} unlock
                    </Badge>
                  ) : null}
                  <Badge variant="secondary" className="flex items-center gap-1 text-xs uppercase">
                    <Sparkles className="h-3.5 w-3.5" /> Festival Score {simulation.festivalScore.toFixed(1)}
                  </Badge>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {(
                    [
                      {
                        id: "attendance",
                        label: "Total attendance",
                        value: numberFormatter.format(simulation.totals.attendance),
                        sub: `${percentageFormatter.format(simulation.totals.attendanceRate)} capacity`,
                        icon: Users,
                      },
                      {
                        id: "tickets",
                        label: "Tickets gross",
                        value: currencyFormatter.format(simulation.totals.revenue.tickets),
                        sub: `${simulation.demand.length} day run`,
                        icon: Ticket,
                      },
                      {
                        id: "sponsors",
                        label: "Sponsors",
                        value: currencyFormatter.format(simulation.sponsor.income),
                        sub: simulation.sponsor.exclusive ? "Exclusive partner active" : "Shared roster",
                        icon: Handshake,
                      },
                      {
                        id: "profit",
                        label: "Profit",
                        value: currencyFormatter.format(simulation.totals.profit),
                        sub: `Margin ${percentageFormatter.format(simulation.totals.margin)}`,
                        icon: PiggyBank,
                        emphasize: simulation.totals.profit >= 0,
                      },
                      {
                        id: "fnb",
                        label: "F&B gross",
                        value: currencyFormatter.format(
                          simulation.totals.revenue.food + simulation.totals.revenue.drink,
                        ),
                        sub: `Merch ${currencyFormatter.format(simulation.totals.revenue.merch)}`,
                        icon: LineChart,
                      },
                      {
                        id: "headliner",
                        label: "Fee guidance",
                        value: `${currencyFormatter.format(simulation.feeGuidance.low)} – ${currencyFormatter.format(
                          simulation.feeGuidance.high,
                        )}`,
                        sub: `${percentageFormatter.format(simulation.feeGuidance.attribution)} ticket attribution`,
                        icon: TrendingUp,
                      },
                    ] as const
                  ).map((metric) => {
                    const Icon = metric.icon;
                    return (
                      <div
                        key={metric.id}
                        className="rounded-lg border border-border/60 bg-muted/10 p-4"
                      >
                        <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
                          <Icon className="h-3.5 w-3.5 text-primary" />
                          {metric.label}
                        </div>
                        <p
                          className={cn("mt-2 text-2xl font-semibold", {
                            "text-emerald-600": metric.id === "profit" && metric.emphasize,
                            "text-destructive": metric.id === "profit" && !metric.emphasize,
                          })}
                        >
                          {metric.value}
                        </p>
                        <p className="text-xs text-muted-foreground">{metric.sub}</p>
                      </div>
                    );
                  })}
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4">
                    <p className="flex items-center gap-2 text-sm font-semibold text-primary">
                      <Ticket className="h-4 w-4" /> Headliner economics
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {numberFormatter.format(simulation.lineup.counts.headline)} headliner ·{' '}
                      {numberFormatter.format(simulation.lineup.counts.major)} major ·{' '}
                      {numberFormatter.format(simulation.lineup.counts.support)} support ·{' '}
                      {numberFormatter.format(simulation.lineup.counts.opener)} opener slots per day.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Day artist fees {currencyFormatter.format(simulation.lineup.perDay)} · Total{' '}
                      {currencyFormatter.format(simulation.lineup.total)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
                    <p className="text-sm font-semibold text-foreground">Sentiment snapshot</p>
                    <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                      <div className="flex items-center justify-between">
                        <span>Price sentiment</span>
                        <span>{formatSignedPercent(simulation.sentiments.price)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Sponsor sentiment</span>
                        <span>{formatSignedPercent(simulation.sentiments.sponsor)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Performance sentiment</span>
                        <span>{formatSignedPercent(simulation.sentiments.performance)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Visitor sentiment</span>
                        <span>{percentageFormatter.format(simulation.sentiments.visitor)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Artist satisfaction</span>
                        <span>{percentageFormatter.format(simulation.sentiments.artist)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Operational deep dive</CardTitle>
                <CardDescription>
                  Inspect the revenue mix, expense stack, demand curve, and score profile powering the current scenario.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="revenue" className="space-y-4">
                  <TabsList className="flex w-full flex-wrap gap-2">
                    <TabsTrigger value="revenue" className="flex-1">Revenue</TabsTrigger>
                    <TabsTrigger value="expenses" className="flex-1">Expenses</TabsTrigger>
                    <TabsTrigger value="demand" className="flex-1">Demand</TabsTrigger>
                    <TabsTrigger value="score" className="flex-1">Score & preview</TabsTrigger>
                  </TabsList>

                  <TabsContent value="revenue" className="space-y-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Stream</TableHead>
                          <TableHead className="text-right">Gross</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell>Tickets</TableCell>
                          <TableCell className="text-right">
                            {currencyFormatter.format(simulation.totals.revenue.tickets)}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Food</TableCell>
                          <TableCell className="text-right">
                            {currencyFormatter.format(simulation.totals.revenue.food)}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Drink</TableCell>
                          <TableCell className="text-right">
                            {currencyFormatter.format(simulation.totals.revenue.drink)}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Merch</TableCell>
                          <TableCell className="text-right">
                            {currencyFormatter.format(simulation.totals.revenue.merch)}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Sponsors</TableCell>
                          <TableCell className="text-right">
                            {currencyFormatter.format(simulation.totals.revenue.sponsors)}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-semibold">Total</TableCell>
                          <TableCell className="text-right font-semibold">
                            {currencyFormatter.format(simulation.totals.revenue.total)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TabsContent>

                  <TabsContent value="expenses" className="space-y-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Expense</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell>Artist fees</TableCell>
                          <TableCell className="text-right">
                            {currencyFormatter.format(simulation.totals.expenses.artistFees)}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Operations (net)</TableCell>
                          <TableCell className="text-right">
                            {currencyFormatter.format(simulation.totals.expenses.operations)}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>F&amp;B cost of goods</TableCell>
                          <TableCell className="text-right">
                            {currencyFormatter.format(simulation.totals.expenses.fnbCogs)}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Merch cost of goods</TableCell>
                          <TableCell className="text-right">
                            {currencyFormatter.format(simulation.totals.expenses.merchCogs)}
                          </TableCell>
                        </TableRow>
                        {simulation.totals.expenses.misc > 0 ? (
                          <TableRow>
                            <TableCell>License renewal</TableCell>
                            <TableCell className="text-right">
                              {currencyFormatter.format(simulation.totals.expenses.misc)}
                            </TableCell>
                          </TableRow>
                        ) : null}
                        <TableRow>
                          <TableCell className="font-semibold">Total expenses</TableCell>
                          <TableCell className="text-right font-semibold">
                            {currencyFormatter.format(simulation.totals.expenses.total)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                    <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
                      <p className="font-semibold text-foreground">Operations breakdown</p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {operationsComponents.map((entry) => (
                          <div key={entry.label} className="flex items-center justify-between text-xs">
                            <span>{entry.label}</span>
                            <span>{currencyFormatter.format(entry.value)}</span>
                          </div>
                        ))}
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Base ops {currencyFormatter.format(operationsRawTotal)} · Sponsor contra offset{' '}
                        {currencyFormatter.format(simulation.totals.expenses.sponsorContra)}
                      </p>
                    </div>
                  </TabsContent>
                  <TabsContent value="demand" className="space-y-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Day</TableHead>
                          <TableHead>Weather</TableHead>
                          <TableHead>Demand index</TableHead>
                          <TableHead>Attendance</TableHead>
                          <TableHead>Utilisation</TableHead>
                          <TableHead className="text-right">Ticket revenue</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {simulation.demand.map((day) => {
                          const WeatherIcon = weatherIconMap[day.weather];
                          return (
                            <TableRow key={`demand-${day.dayIndex}`}>
                              <TableCell>{day.dayIndex}</TableCell>
                              <TableCell>
                                <span className="inline-flex items-center gap-1 text-sm">
                                  <WeatherIcon className="h-4 w-4 text-primary" />
                                  {weatherLookup[day.weather].label}
                                </span>
                                <p className="text-xs text-muted-foreground">
                                  {formatSignedPercent(weatherLookup[day.weather].impact)} weather impact
                                </p>
                              </TableCell>
                              <TableCell>
                                {day.demandIndex.toFixed(2)}
                                <p className="text-xs text-muted-foreground">
                                  Base {formatSignedDecimal(day.demandBreakdown.base)} · Hype{' '}
                                  {formatSignedDecimal(day.demandBreakdown.hype)} · Lineup{' '}
                                  {formatSignedDecimal(day.demandBreakdown.lineup)} · Sentiment{' '}
                                  {formatSignedDecimal(day.demandBreakdown.sentiment)} · Price{' '}
                                  {formatSignedDecimal(day.demandBreakdown.price)}
                                </p>
                              </TableCell>
                              <TableCell>{numberFormatter.format(day.attendees)}</TableCell>
                              <TableCell>{percentageFormatter.format(day.capacityUtilisation)}</TableCell>
                              <TableCell className="text-right">
                                {currencyFormatter.format(day.ticketRevenue)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TabsContent>

                  <TabsContent value="score" className="space-y-6">
                    <div className="grid gap-6 lg:grid-cols-2">
                      <div className="space-y-4">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Score component</TableHead>
                              <TableHead className="text-right">Value</TableHead>
                              <TableHead className="text-right">z-score</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {scoreBreakdownRows.map((row) => (
                              <TableRow key={row.key}>
                                <TableCell>{row.label}</TableCell>
                                <TableCell className="text-right">{row.display}</TableCell>
                                <TableCell className="text-right">{row.z.toFixed(2)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        <div className="rounded-lg border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
                          <p className="font-semibold text-foreground">Festival Score</p>
                          <p>
                            Current score {simulation.festivalScore.toFixed(1)} balances profitability, attendance, artist
                            delight, and visitor sentiment. Push above 75 to unlock premium sponsor pools and prestige rewards.
                          </p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4 text-sm text-muted-foreground">
                          <p className="font-semibold text-primary">Next year preview</p>
                          <p className="mt-1">
                            Suggested ticket price {currencyFormatter.format(simulation.nextYearPreview.suggestedTicketPrice)} ·
                            Target lineup quality {percentageFormatter.format(simulation.nextYearPreview.suggestedLineupQuality)}
                          </p>
                          <p className="mt-1">{simulation.nextYearPreview.focus}</p>
                          <p className="mt-1">{simulation.nextYearPreview.attendanceNote}</p>
                          <p className="mt-1">{simulation.nextYearPreview.sponsorStrategy}</p>
                        </div>
                        <div className="rounded-lg border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
                          <p className="font-semibold text-foreground">Sponsor stance</p>
                          <p>
                            Fit index {formatSignedPercent(simulation.sponsor.fit)} · Contra offset{' '}
                            {currencyFormatter.format(simulation.sponsor.contra)}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Exclusive partners increase cash but amplify negative sentiment. Balance fit and hype cadence to stay
                            ahead of demand swings.
                          </p>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
      <section className="grid gap-6 lg:grid-cols-2">
        {festivalTracks.map((track) => (
          <Card key={track.id} className="h-full">
            <CardHeader className="space-y-3">
              <div className="flex items-center gap-2 text-sm uppercase tracking-wide text-primary">
                {track.ownerType === "admin" ? <ShieldAlert className="h-4 w-4" /> : <Network className="h-4 w-4" />}
                <span>{track.ownerType === "admin" ? "National programme" : "Licensed entrepreneurship"}</span>
              </div>
              <CardTitle className="text-2xl">{track.title}</CardTitle>
              <CardDescription>{track.summary}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Core beats</p>
                <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                  {track.coreBeats.map((beat) => (
                    <li key={beat} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
                      <span>{beat}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Automation highlights</p>
                <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                  {track.automationHighlights.map((note) => (
                    <li key={note} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary/80" aria-hidden />
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Unique systems</p>
                <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                  {track.uniqueSystems.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary/40" aria-hidden />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>
      <section className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">Size tiers, licensing & cost framework</h2>
            <p className="text-sm text-muted-foreground">
              Tier caps, staffing expectations, and recommended price bands anchor balancing. Licensing unlocks progression while
              cost coefficients scale operations in line with footprint.
            </p>
          </div>
          <Badge variant="outline" className="flex items-center gap-2 text-xs uppercase">
            <Ticket className="h-3.5 w-3.5" /> Tier balancing ready
          </Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Tier overview</CardTitle>
            <CardDescription>Capacity, day range, staffing, and pricing guardrails per festival tier.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Tier</TableHead>
                  <TableHead>Capacity cap</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Staffing</TableHead>
                  <TableHead>Recommended ticket</TableHead>
                  <TableHead>Base acts/day</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {festivalSizeTiers.map((tier) => (
                  <TableRow key={tier.id}>
                    <TableCell className="font-semibold">{tier.label}</TableCell>
                    <TableCell>{tier.capacityCap.toLocaleString()}</TableCell>
                    <TableCell>{formatDayRange(tier.dayRange)}</TableCell>
                    <TableCell className="capitalize">{tier.staffLevel}</TableCell>
                    <TableCell>{formatPriceRange(tier.recommendedTicketPrice)}</TableCell>
                    <TableCell>{tier.baseActsPerDay}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{tier.description}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Licensing milestones</CardTitle>
              <CardDescription>Unlock fees, renewals, and staffing outlay per tier for player-owned festivals.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {festivalLicenseDetails.map((license) => (
                <div key={license.sizeTier} className="rounded-lg border border-border/60 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">
                      {festivalSizeTiers.find((tier) => tier.id === license.sizeTier)?.label} license
                    </p>
                    <Badge variant="outline" className="text-xs uppercase">
                      {currencyFormatter.format(license.unlockCost)} unlock
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Renewal {currencyFormatter.format(license.annualRenewal)} · Staffing reserve{' '}
                    {currencyFormatter.format(license.oneOffStaffingCost)}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">{license.notes}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cost coefficients</CardTitle>
              <CardDescription>Ops spend scales with day count and tier scope; sponsor contra offsets bring relief.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {festivalCostProfiles.map((profile) => (
                <div key={profile.sizeTier} className="rounded-lg border border-border/60 p-4 text-sm text-muted-foreground">
                  <p className="text-sm font-semibold text-foreground">
                    {festivalSizeTiers.find((tier) => tier.id === profile.sizeTier)?.label}
                  </p>
                  <div className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
                    <span>One-off staffing · {currencyFormatter.format(profile.oneOffStaffing)}</span>
                    <span>Security/day · {currencyFormatter.format(profile.securityPerDay)}</span>
                    <span>Insurance · {currencyFormatter.format(profile.insuranceFlat)}</span>
                    <span>Stage/day · {currencyFormatter.format(profile.stagePerDay)}</span>
                    <span>Waste & permits · {currencyFormatter.format(profile.wastePermits)}</span>
                    <span>Marketing · {currencyFormatter.format(profile.marketingFlat)}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>
      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>P&amp;L streams</CardTitle>
            <CardDescription>Every lever feeding the festival profit and loss statement.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {profitStreams.map((stream) => (
              <div key={stream.id} className="rounded-lg border border-border/60 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">{stream.title}</p>
                  <Badge variant="outline" className="text-xs uppercase">{stream.id}</Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{stream.description}</p>
                <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                  {stream.levers.map((lever) => (
                    <li key={lever} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary/50" aria-hidden />
                      <span>{lever}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader>
            <CardTitle>Demand factors</CardTitle>
            <CardDescription>Coefficients feeding the daily demand index and attendance ceiling.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {demandFactors.map((factor) => (
              <div key={factor.id} className="rounded-lg border border-border/60 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">{factor.label}</p>
                  <Badge variant="outline" className="text-xs uppercase">Weight {factor.weight.toFixed(2)}</Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{factor.description}</p>
                {factor.notes ? <p className="mt-2 text-xs text-muted-foreground">{factor.notes}</p> : null}
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold">Systems interplay</h2>
        <p className="text-sm text-muted-foreground">
          Weather, performance quality, sponsor alignment, and hype loops feed one another. Use this matrix to anticipate how
          decisions cascade into Festival Score, attendance, and sentiment.
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          {systemsInterplay.map((item) => (
            <Card key={item.id} className="h-full">
              <CardHeader>
                <CardTitle className="text-lg">{item.title}</CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{item.impact}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold">Lifecycle beats</h2>
        <p className="text-sm text-muted-foreground">
          From licensing to post-event reporting, each stage flips status flags, triggers jobs, and emits Twaater beats.
          Understand the flow to time pricing, lineup locks, and sponsor announcements.
        </p>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {lifecycleBeats.map((beat) => (
            <Card key={beat.id} className="h-full">
              <CardHeader className="space-y-1">
                <Badge variant="outline" className="w-fit text-xs uppercase">
                  {beat.id.replace(/-/g, ' ')}
                </Badge>
                <CardTitle className="text-lg">{beat.title}</CardTitle>
                <CardDescription>{beat.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-xs text-muted-foreground">
                  {beat.outcomes.map((outcome) => (
                    <li key={outcome} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary/60" aria-hidden />
                      <span>{outcome}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold">Data architecture & services</h2>
        <p className="text-sm text-muted-foreground">
          SQLite-first tables, FastAPI endpoints, and background jobs keep festivals authoritative across editions and
          reports. Calculators expose deterministic outcomes for invites, demand, and next-year previews.
        </p>
        <Card>
          <CardHeader>
            <CardTitle>Reference</CardTitle>
            <CardDescription>Switch between schema, APIs, jobs, and calculators powering the system.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="data" className="space-y-4">
              <TabsList className="flex w-full flex-wrap gap-2">
                <TabsTrigger value="data" className="flex-1">Data model</TabsTrigger>
                <TabsTrigger value="api" className="flex-1">API endpoints</TabsTrigger>
                <TabsTrigger value="jobs" className="flex-1">Background jobs</TabsTrigger>
                <TabsTrigger value="calculators" className="flex-1">Calculators</TabsTrigger>
              </TabsList>

              <TabsContent value="data">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Table</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Key fields</TableHead>
                      <TableHead>Scope</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dataModelTables.map((table) => (
                      <TableRow key={table.name}>
                        <TableCell className="font-semibold">{table.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{table.description}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{table.keyFields.join(', ')}</TableCell>
                        <TableCell className="capitalize">{table.scope}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>

              <TabsContent value="api">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Method</TableHead>
                      <TableHead>Path</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Focus</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apiEndpoints.map((endpoint) => (
                      <TableRow key={`${endpoint.method}-${endpoint.path}`}>
                        <TableCell>{endpoint.method}</TableCell>
                        <TableCell className="font-mono text-xs">{endpoint.path}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{endpoint.description}</TableCell>
                        <TableCell className="capitalize">{endpoint.focus}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>

              <TabsContent value="jobs" className="space-y-3">
                {backgroundJobs.map((job) => (
                  <div key={job.id} className="rounded-lg border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
                    <p className="text-sm font-semibold text-foreground">
                      {job.id.replace(/-/g, ' ')} · {job.cadence}
                    </p>
                    <p className="mt-1">{job.description}</p>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="calculators" className="space-y-3">
                {calculators.map((calculator) => (
                  <div key={calculator.id} className="rounded-lg border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
                    <p className="text-sm font-semibold text-foreground">{calculator.title}</p>
                    <p className="mt-1">{calculator.summary}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Inputs: {calculator.keyInputs.join(', ')}
                    </p>
                  </div>
                ))}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
