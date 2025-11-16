import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import TourCostCalculator from "@/components/tours/TourCostCalculator";
import type { CheckedState } from "@radix-ui/react-checkbox";
import { Bed, Bus, CheckCircle2, Map } from "lucide-react";

interface StepDefinition {
  id: "route" | "transport" | "accommodation";
  title: string;
  description: string;
  icon: typeof Map;
}

const STEPS: StepDefinition[] = [
  {
    id: "route",
    title: "Route",
    description: "Select cities and venues",
    icon: Map,
  },
  {
    id: "transport",
    title: "Transport",
    description: "Plan fleet and cargo",
    icon: Bus,
  },
  {
    id: "accommodation",
    title: "Accommodation",
    description: "Organise rest and recovery",
    icon: Bed,
  },
];

const CITY_OPTIONS = [
  { id: "nyc", name: "New York City", venue: "Madison Square Garden" },
  { id: "chi", name: "Chicago", venue: "United Center" },
  { id: "den", name: "Denver", venue: "Ball Arena" },
  { id: "sea", name: "Seattle", venue: "Climate Pledge Arena" },
  { id: "la", name: "Los Angeles", venue: "The Forum" },
  { id: "atl", name: "Atlanta", venue: "State Farm Arena" },
];

const TRANSPORT_MODES = [
  { value: "tour-bus", label: "Tour bus caravan" },
  { value: "sprinter", label: "Sprinter vans" },
  { value: "fly-date", label: "Fly dates" },
  { value: "hybrid", label: "Hybrid (bus & fly)" },
];

const ACCOMMODATION_TYPES = [
  { value: "hotel", label: "Business hotels" },
  { value: "apartments", label: "Serviced apartments" },
  { value: "boutique", label: "Boutique hotels" },
  { value: "mixed", label: "Mixed (hotel & rentals)" },
];

const PlannerPage = () => {
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [selectedCities, setSelectedCities] = useState<string[]>(["nyc", "chi", "la"]);
  const [transportMode, setTransportMode] = useState(TRANSPORT_MODES[0]!.value);
  const [transportNotes, setTransportNotes] = useState(
    "Night driver rotation with two reserve crew members."
  );
  const [cargoVendor, setCargoVendor] = useState("Backline Express Logistics");
  const [accommodationType, setAccommodationType] = useState(ACCOMMODATION_TYPES[0]!.value);
  const [roomsNeeded, setRoomsNeeded] = useState(12);
  const [nightsPerCity, setNightsPerCity] = useState(2);
  const [wellnessNotes, setWellnessNotes] = useState(
    "Block two recovery suites in every city and coordinate day rooms for early arrivals."
  );

  const progress = useMemo(
    () => Math.round(((activeStepIndex + 1) / STEPS.length) * 100),
    [activeStepIndex]
  );

  const handleToggleCity = (cityId: string, checked: CheckedState) => {
    setSelectedCities((current) => {
      const isChecked = checked === true;
      if (isChecked) {
        return current.includes(cityId) ? current : [...current, cityId];
      }
      return current.filter((city) => city !== cityId);
    });
  };

  const handlePrevious = () => setActiveStepIndex((index) => Math.max(index - 1, 0));

  const handleNext = () => setActiveStepIndex((index) => Math.min(index + 1, STEPS.length - 1));

  const currentStep = STEPS[activeStepIndex];

  const selectedCityDetails = useMemo(
    () => CITY_OPTIONS.filter((city) => selectedCities.includes(city.id)),
    [selectedCities]
  );

  const renderStepContent = () => {
    switch (currentStep.id) {
      case "route":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold">Route blueprint</h3>
              <p className="text-sm text-muted-foreground">
                Choose the anchor cities for this leg. These selections cascade into routing, travel days, and promotional
                pushes.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {CITY_OPTIONS.map((city) => (
                <label
                  key={city.id}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 hover:bg-muted/50"
                >
                  <Checkbox
                    checked={selectedCities.includes(city.id)}
                    onCheckedChange={(checked) => handleToggleCity(city.id, checked)}
                  />
                  <span>
                    <span className="font-medium leading-none">{city.name}</span>
                    <p className="text-xs text-muted-foreground">Headline venue: {city.venue}</p>
                  </span>
                </label>
              ))}
            </div>
            <div className="rounded-lg border bg-muted/30 p-4 text-sm">
              <p className="font-medium">Selected route</p>
              <p className="text-muted-foreground">
                {selectedCityDetails.length > 0
                  ? selectedCityDetails.map((city) => city.name).join(" → ")
                  : "Choose at least one city to begin building the routing matrix."}
              </p>
            </div>
          </div>
        );
      case "transport":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold">Transport logistics</h3>
              <p className="text-sm text-muted-foreground">
                Align crew movement, backline freight, and contingency planning so production never misses a load-in.
              </p>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="transport-mode">Primary mode</Label>
                <Select value={transportMode} onValueChange={setTransportMode}>
                  <SelectTrigger id="transport-mode">
                    <SelectValue placeholder="Select transport" />
                  </SelectTrigger>
                  <SelectContent>
                    {TRANSPORT_MODES.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cargo-vendor">Cargo & freight vendor</Label>
                <Input
                  id="cargo-vendor"
                  value={cargoVendor}
                  onChange={(event) => setCargoVendor(event.target.value)}
                  placeholder="Freight partner"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="transport-notes">Operational notes</Label>
              <Textarea
                id="transport-notes"
                value={transportNotes}
                onChange={(event) => setTransportNotes(event.target.value)}
                rows={4}
                placeholder="Include driver schedules, airport cut-offs, or gear split plans."
              />
            </div>
            <div className="rounded-lg border bg-muted/30 p-4 text-sm">
              <p className="font-medium">Snapshot</p>
              <p className="text-muted-foreground">
                {TRANSPORT_MODES.find((mode) => mode.value === transportMode)?.label ?? "Custom transport"} with freight
                managed by {cargoVendor || "TBD"}. {transportNotes || "Add notes to outline day-to-day execution."}
              </p>
            </div>
          </div>
        );
      case "accommodation":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold">Accommodation matrix</h3>
              <p className="text-sm text-muted-foreground">
                Balance recovery and budget by planning lodging and wellbeing touchpoints city by city.
              </p>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              <div className="space-y-2 md:col-span-1">
                <Label htmlFor="accommodation-type">Preferred style</Label>
                <Select value={accommodationType} onValueChange={setAccommodationType}>
                  <SelectTrigger id="accommodation-type">
                    <SelectValue placeholder="Select accommodation" />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCOMMODATION_TYPES.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rooms-needed">Rooms per stop</Label>
                <Input
                  id="rooms-needed"
                  type="number"
                  min={1}
                  value={roomsNeeded}
                  onChange={(event) => {
                    const value = Number.parseInt(event.target.value, 10);
                    setRoomsNeeded(Number.isNaN(value) ? roomsNeeded : Math.max(1, value));
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nights-per-city">Nights per city</Label>
                <Input
                  id="nights-per-city"
                  type="number"
                  min={1}
                  value={nightsPerCity}
                  onChange={(event) => {
                    const value = Number.parseInt(event.target.value, 10);
                    setNightsPerCity(Number.isNaN(value) ? nightsPerCity : Math.max(1, value));
                  }}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="wellness-notes">Wellness programming</Label>
              <Textarea
                id="wellness-notes"
                value={wellnessNotes}
                onChange={(event) => setWellnessNotes(event.target.value)}
                rows={4}
                placeholder="Detail warm-up spaces, physio rotations, and off-day culture activations."
              />
            </div>
            <div className="rounded-lg border bg-muted/30 p-4 text-sm">
              <p className="font-medium">Lodging outlook</p>
              <p className="text-muted-foreground">
                {ACCOMMODATION_TYPES.find((option) => option.value === accommodationType)?.label ?? "Custom stays"} with
                {" "}
                {roomsNeeded} rooms locked per stop across {selectedCityDetails.length} cities, averaging {nightsPerCity}{" "}
                nights each. {wellnessNotes || "Add wellness notes to coordinate crew care."}
              </p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto space-y-8 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Tour Planner</h1>
        <p className="text-muted-foreground">
          Orchestrate routing, transport, and accommodation logistics for your next tour leg.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Planning stepper</CardTitle>
          <CardDescription>Move through each stage to define your tour operations playbook.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <Progress value={progress} />
            <ol className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              {STEPS.map((step, index) => {
                const status =
                  index === activeStepIndex ? "current" : index < activeStepIndex ? "completed" : "upcoming";
                const Icon = step.icon;

                return (
                  <li key={step.id} className="flex items-start gap-3">
                    <span
                      className={cn(
                        "flex h-12 w-12 items-center justify-center rounded-full border-2 text-lg transition",
                        status === "current" && "border-primary bg-primary text-primary-foreground",
                        status === "completed" && "border-primary bg-primary/10 text-primary",
                        status === "upcoming" && "border-muted text-muted-foreground"
                      )}
                    >
                      {status === "completed" ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <Icon className="h-5 w-5" />
                      )}
                    </span>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold">{step.title}</p>
                      <p className="text-xs text-muted-foreground">{step.description}</p>
                      <Badge variant={status === "upcoming" ? "outline" : status === "current" ? "default" : "secondary"}>
                        {status === "current" ? "In progress" : status === "completed" ? "Completed" : "Next"}
                      </Badge>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="rounded-xl border bg-background p-6 shadow-sm">{renderStepContent()}</div>

          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={handlePrevious} disabled={activeStepIndex === 0}>
              Previous
            </Button>
            <Button onClick={handleNext} disabled={activeStepIndex === STEPS.length - 1}>
              {activeStepIndex === STEPS.length - 1 ? "Complete" : "Continue"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <TourCostCalculator />
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Operations summary</CardTitle>
            <CardDescription>Keep leadership aligned with the latest plan snapshot.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-semibold">Route</p>
              <p className="text-sm text-muted-foreground">
                {selectedCityDetails.length > 0
                  ? selectedCityDetails.map((city) => city.name).join(", ")
                  : "No cities locked yet."}
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold">Transport</p>
              <p className="text-sm text-muted-foreground">
                {TRANSPORT_MODES.find((mode) => mode.value === transportMode)?.label ?? "Custom"} · Cargo: {cargoVendor ||
                  "TBD"}
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold">Accommodation</p>
              <p className="text-sm text-muted-foreground">
                {ACCOMMODATION_TYPES.find((option) => option.value === accommodationType)?.label ?? "Custom"} · Rooms per
                stop: {roomsNeeded} · Nights per city: {nightsPerCity}
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold">Wellness</p>
              <p className="text-sm text-muted-foreground">
                {wellnessNotes.length > 0 ? wellnessNotes : "Log care rotations and cultural touchpoints."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PlannerPage;
