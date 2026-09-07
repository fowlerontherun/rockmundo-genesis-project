import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, MapPin, Sparkles, Tent } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { festivalRoutes } from "@/features/festivals/routes";
import {
  useFestivalConfiguration,
  useSaveFestivalConfiguration,
} from "../application/useFestivalConfiguration";
import type {
  FestivalConfigurationDraft,
  FestivalEnvironmentalPolicy,
  FestivalSiteType,
  FestivalVibe,
} from "../domain/festivalConfiguration";
import { festivalConfigurationErrorMessage } from "../domain/festivalConfigurationErrors";

const addDays = (startDate: string, days: number) => {
  const date = new Date(`${startDate}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return startDate;
  date.setUTCDate(date.getUTCDate() + Math.max(0, days - 1));
  return date.toISOString().slice(0, 10);
};

export function FestivalConfigurationWizard({
  festivalCompanyId,
}: {
  festivalCompanyId: string;
}) {
  const navigate = useNavigate();
  const query = useFestivalConfiguration(festivalCompanyId);
  const save = useSaveFestivalConfiguration();
  const [publicName, setPublicName] = useState("");
  const [homeCityId, setHomeCityId] = useState("");
  const [festivalScale, setFestivalScale] = useState("");
  const [startDate, setStartDate] = useState("");

  const configuration = query.data;
  const initialName = configuration?.publicName || configuration?.legalCompanyName || "";
  const name = publicName || initialName;
  const cityId = homeCityId || configuration?.homeCity?.id || "";
  const scaleKey = festivalScale || configuration?.festivalScale || "";
  const date = startDate || configuration?.plannedStartDate || "";
  const selectedScale = configuration?.scales.find((scale) => scale.key === scaleKey);
  const selectedCity = configuration?.cities.find((city) => city.id === cityId);

  const preview = useMemo(() => {
    if (!selectedScale) return null;
    return `${selectedScale.displayName} · ${selectedScale.minimumCapacity.toLocaleString("en-GB")}–${selectedScale.maximumCapacity.toLocaleString("en-GB")} potential capacity`;
  }, [selectedScale]);

  if (query.isLoading) return <p role="status">Loading Festival company…</p>;

  if (query.isError || !configuration) {
    return (
      <Alert variant="destructive">
        <AlertDescription className="space-y-3">
          <p>{festivalConfigurationErrorMessage(query.error)}</p>
          <Button type="button" variant="outline" onClick={() => void query.refetch()}>
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const canSubmit =
    configuration.canWrite &&
    name.trim().length >= 3 &&
    Boolean(cityId) &&
    Boolean(scaleKey) &&
    Boolean(date) &&
    !save.isPending;

  const createFestival = () => {
    if (!canSubmit || !selectedScale) return;

    const selectedDate = new Date(`${date}T12:00:00.000Z`);
    const annualMonth = selectedDate.getUTCMonth() + 1;
    const durationDays = Math.min(1, selectedScale.maximumDurationDays);
    const draft: FestivalConfigurationDraft = {
      publicName: name.trim(),
      shortName: (configuration.shortName || name.trim()).slice(0, 24),
      tagline: configuration.tagline || "",
      description: configuration.description || "",
      homeCityId: cityId,
      festivalScale: selectedScale.key,
      annualMonth,
      vibe: (configuration.vibe ?? "community") as FestivalVibe,
      siteType: (configuration.siteType ?? "outdoor") as FestivalSiteType,
      environmentalPolicy: (configuration.environmentalPolicy ??
        "standard") as FestivalEnvironmentalPolicy,
      plannedStartDate: date,
      plannedEndDate: addDays(date, durationDays),
      currentStep: 6,
      complete: true,
    };

    save.mutate(
      {
        festivalCompanyId,
        expectedVersion: configuration.configurationVersion,
        configuration: draft,
        idempotencyKey: crypto.randomUUID(),
      },
      {
        onSuccess: (canonical) => {
          if (canonical.festivalEditionId) {
            navigate(
              festivalRoutes.edition(
                festivalCompanyId,
                canonical.festivalEditionId,
              ),
            );
          }
        },
      },
    );
  };

  return (
    <section className="space-y-5" aria-labelledby="festival-founding-heading">
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle id="festival-founding-heading" className="flex items-center gap-2">
            <Tent className="h-5 w-5" /> Create your Festival
          </CardTitle>
          <CardDescription>
            Start the Festival company with four decisions. Detailed annual choices can be changed later without repeating company setup.
          </CardDescription>
        </CardHeader>
      </Card>

      {!configuration.canWrite ? (
        <Alert>
          <AlertDescription>
            This company is read-only for your active character.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardContent className="grid gap-5 pt-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="festival-name">Festival name</Label>
            <Input
              id="festival-name"
              value={name}
              maxLength={80}
              disabled={!configuration.canWrite}
              onChange={(event) => setPublicName(event.target.value)}
              placeholder="Shock Festival"
            />
            <p className="text-xs text-muted-foreground">
              This becomes the permanent Festival brand.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="festival-home-city">Home city</Label>
            <select
              id="festival-home-city"
              className="min-h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={cityId}
              disabled={!configuration.canWrite}
              onChange={(event) => setHomeCityId(event.target.value)}
            >
              <option value="">Choose a city</option>
              {configuration.cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}, {city.country}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="festival-starting-scale">Starting size</Label>
            <select
              id="festival-starting-scale"
              className="min-h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={scaleKey}
              disabled={!configuration.canWrite}
              onChange={(event) => setFestivalScale(event.target.value)}
            >
              <option value="">Choose a starting size</option>
              {configuration.scales.map((scale) => (
                <option key={scale.key} value={scale.key}>
                  {scale.displayName}
                </option>
              ))}
            </select>
            {preview ? <p className="text-xs text-muted-foreground">{preview}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="festival-first-date">First Festival date</Label>
            <Input
              id="festival-first-date"
              type="date"
              min={new Date().toISOString().slice(0, 10)}
              value={date}
              disabled={!configuration.canWrite}
              onChange={(event) => setStartDate(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              You can change the annual plan before tickets go on sale.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" /> First Festival preview
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
          <p>
            <MapPin className="mr-1 inline h-4 w-4" />
            <strong>{selectedCity ? `${selectedCity.name}, ${selectedCity.country}` : "Choose a city"}</strong>
          </p>
          <p>
            <Tent className="mr-1 inline h-4 w-4" />
            <strong>{selectedScale?.displayName ?? "Choose a size"}</strong>
          </p>
          <p>
            <CalendarDays className="mr-1 inline h-4 w-4" />
            <strong>{date || "Choose a date"}</strong>
          </p>
        </CardContent>
      </Card>

      {save.isError ? (
        <Alert variant="destructive">
          <AlertDescription>{festivalConfigurationErrorMessage(save.error)}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex justify-end">
        <Button type="button" size="lg" disabled={!canSubmit} onClick={createFestival}>
          {save.isPending ? "Creating Festival…" : "Create Festival & start planning"}
        </Button>
      </div>
    </section>
  );
}
