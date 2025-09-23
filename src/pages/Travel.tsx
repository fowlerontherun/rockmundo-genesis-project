import { useEffect, useMemo, useState } from "react";
import type { PostgrestError } from "@supabase/supabase-js";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type TravelRecord = {
  id: string;
  city_from: string | null;
  city_to: string | null;
  cost: string | number | null;
  duration: string | number | null;
  health_impact: string | number | null;
};

type TravelDataset = {
  flights: TravelRecord[];
  trains: TravelRecord[];
  taxis: TravelRecord[];
  ferries: TravelRecord[];
};

const defaultDataset: TravelDataset = {
  flights: [],
  trains: [],
  taxis: [],
  ferries: [],
};

const FALLBACK_TRAVEL_DATA: TravelDataset = {
  flights: [
    {
      id: "fallback-flight-neo-aster",
      city_from: "Neo Tokyo",
      city_to: "Asterhaven",
      cost: 880,
      duration: 720,
      health_impact: -12,
    },
    {
      id: "fallback-flight-solace-vela",
      city_from: "Solace City",
      city_to: "Vela Horizonte",
      cost: 540,
      duration: 420,
      health_impact: -8,
    },
    {
      id: "fallback-flight-aster-portsmouth",
      city_from: "Asterhaven",
      city_to: "Portsmouth",
      cost: 210,
      duration: 110,
      health_impact: -4,
    },
  ],
  trains: [
    {
      id: "fallback-train-portsmouth-aster",
      city_from: "Portsmouth",
      city_to: "Asterhaven",
      cost: 95,
      duration: 180,
      health_impact: -2,
    },
    {
      id: "fallback-train-aster-solace",
      city_from: "Asterhaven",
      city_to: "Solace City",
      cost: 135,
      duration: 240,
      health_impact: -3,
    },
    {
      id: "fallback-train-solace-portsmouth",
      city_from: "Solace City",
      city_to: "Portsmouth",
      cost: 115,
      duration: 210,
      health_impact: -1,
    },
  ],
  taxis: [
    {
      id: "fallback-taxi-portsmouth",
      city_from: "Portsmouth",
      city_to: "Portsmouth",
      cost: 24,
      duration: 18,
      health_impact: 3,
    },
    {
      id: "fallback-taxi-solace",
      city_from: "Solace City",
      city_to: "Solace City",
      cost: 32,
      duration: 22,
      health_impact: 4,
    },
    {
      id: "fallback-taxi-aster",
      city_from: "Asterhaven",
      city_to: "Asterhaven",
      cost: 38,
      duration: 25,
      health_impact: 2,
    },
  ],
  ferries: [
    {
      id: "fallback-ferry-solace-portsmouth",
      city_from: "Solace City",
      city_to: "Portsmouth",
      cost: 68,
      duration: 95,
      health_impact: 5,
    },
    {
      id: "fallback-ferry-portsmouth-vela",
      city_from: "Portsmouth",
      city_to: "Vela Horizonte",
      cost: 145,
      duration: 260,
      health_impact: 1,
    },
    {
      id: "fallback-ferry-vela-solace",
      city_from: "Vela Horizonte",
      city_to: "Solace City",
      cost: 142,
      duration: 255,
      health_impact: 2,
    },
  ],
};

const cloneDataset = (dataset: TravelDataset): TravelDataset => ({
  flights: dataset.flights.map((record) => ({ ...record })),
  trains: dataset.trains.map((record) => ({ ...record })),
  taxis: dataset.taxis.map((record) => ({ ...record })),
  ferries: dataset.ferries.map((record) => ({ ...record })),
});

type TravelTableName = "travel_flights" | "travel_trains" | "travel_taxis" | "travel_ferries";
type TravelTableKey = keyof TravelDataset;

const TRAVEL_TABLES: Array<{ key: TravelTableKey; table: TravelTableName }> = [
  { key: "flights", table: "travel_flights" },
  { key: "trains", table: "travel_trains" },
  { key: "taxis", table: "travel_taxis" },
  { key: "ferries", table: "travel_ferries" },
];

type RawTravelRow = {
  id?: string | null;
  city_from?: string | null;
  city_to?: string | null;
  cost?: number | string | null;
  duration_minutes?: number | string | null;
  health_impact?: number | string | null;
};

const parseNumeric = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
};

const formatValue = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) {
    return "—";
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return `$${value.toLocaleString()}`;
  }

  return value;
};

const formatDuration = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) {
    return "—";
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return `${value} min`;
  }

  return value;
};

const Travel = () => {
  const [data, setData] = useState<TravelDataset>(defaultDataset);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchTravelData = async () => {
      setLoading(true);
      setError(null);

      try {
        const { supabase } = await import("@/integrations/supabase/client");

        const responses = await Promise.all(
          TRAVEL_TABLES.map(async (config) => {
            try {
              const response = await supabase
                .from(config.table)
                .select("id, city_from, city_to, cost, duration_minutes, health_impact");

              if (response.error) {
                return {
                  ...config,
                  rows: [] as RawTravelRow[],
                  error: response.error as PostgrestError,
                };
              }

              return {
                ...config,
                rows: Array.isArray(response.data) ? (response.data as RawTravelRow[]) : [],
                error: null,
              };
            } catch (unknownError) {
              const error = unknownError as PostgrestError | Error;

              if (error && typeof (error as PostgrestError).code === "string") {
                return {
                  ...config,
                  rows: [] as RawTravelRow[],
                  error: error as PostgrestError,
                };
              }

              throw unknownError;
            }
          }),
        );

        if (!isMounted) {
          return;
        }

        const fallbackTables = new Set<TravelTableKey>();
        const missingTables = new Set<TravelTableKey>();
        const fatalErrors: PostgrestError[] = [];

        responses.forEach(({ key, error }) => {
          if (!error) {
            return;
          }

          fallbackTables.add(key);

          if (error.code === "42P01") {
            missingTables.add(key);
          } else {
            fatalErrors.push(error);
          }
        });

        const cityIds = new Set<string>();

        responses.forEach(({ rows, error }) => {
          if (error) {
            return;
          }

          rows.forEach((row) => {
            if (typeof row.city_from === "string" && row.city_from.trim().length > 0) {
              cityIds.add(row.city_from);
            }
            if (typeof row.city_to === "string" && row.city_to.trim().length > 0) {
              cityIds.add(row.city_to);
            }
          });
        });

        let cityLookup = new Map<string, string>();

        if (cityIds.size > 0) {
          try {
            const cityResponse = await supabase
              .from("cities")
              .select("id, name")
              .in("id", Array.from(cityIds));

            if (!cityResponse.error && Array.isArray(cityResponse.data)) {
              const entries = cityResponse.data
                .filter((entry): entry is { id: string; name: string | null } =>
                  Boolean(entry && typeof entry.id === "string"),
                )
                .map((entry) => [entry.id, entry.name ?? "Confirmed destination"] as const);

              cityLookup = new Map(entries);
            }
          } catch (cityLookupError) {
            console.warn("Failed to load city names for travel data", cityLookupError);
          }
        }

        const nextDataset: TravelDataset = {
          flights: [],
          trains: [],
          taxis: [],
          ferries: [],
        };

        responses.forEach(({ key, rows }) => {
          if (fallbackTables.has(key)) {
            nextDataset[key] = FALLBACK_TRAVEL_DATA[key].map((record) => ({ ...record }));
            return;
          }

          nextDataset[key] = rows.map((row, index) => {
            const id =
              typeof row.id === "string" && row.id.trim().length > 0
                ? row.id
                : `${key}-${index}`;

            const cityFromId =
              typeof row.city_from === "string" && row.city_from.trim().length > 0
                ? row.city_from
                : null;
            const cityToId =
              typeof row.city_to === "string" && row.city_to.trim().length > 0
                ? row.city_to
                : null;

            const cityFrom = cityFromId ? cityLookup.get(cityFromId) ?? "Origin city" : null;
            const cityTo = cityToId ? cityLookup.get(cityToId) ?? "Confirmed destination" : null;

            const cost = parseNumeric(row.cost);
            const duration = parseNumeric(row.duration_minutes);
            const healthImpact = parseNumeric(row.health_impact);

            return {
              id,
              city_from: cityFrom,
              city_to: cityTo,
              cost: cost ?? (typeof row.cost === "string" || typeof row.cost === "number" ? row.cost : null),
              duration:
                duration ??
                (typeof row.duration_minutes === "string" || typeof row.duration_minutes === "number"
                  ? row.duration_minutes
                  : null),
              health_impact:
                healthImpact ??
                (typeof row.health_impact === "string" || typeof row.health_impact === "number"
                  ? row.health_impact
                  : null),
            };
          });
        });

        const errorMessages: string[] = [];

        if (missingTables.size > 0) {
          errorMessages.push(
            "Travel tables are still being provisioned. Showing sample itineraries until the database is ready.",
          );
        }

        if (fatalErrors.length > 0) {
          console.warn("Encountered unexpected travel data errors", fatalErrors);
          errorMessages.push(
            "We couldn't load live travel data right now. Displaying sample itineraries while we recover travel data.",
          );
        }

        setError(errorMessages.length > 0 ? errorMessages.join(" \u2022 ") : null);
        setData(nextDataset);
      } catch (fetchError) {
        if (!isMounted) {
          return;
        }

        const message = fetchError instanceof Error ? fetchError.message : "Failed to load travel data.";
        setError(`${message} \u2022 Showing sample itineraries while the travel database initializes.`);
        setData(cloneDataset(FALLBACK_TRAVEL_DATA));
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchTravelData();

    return () => {
      isMounted = false;
    };
  }, []);

  const hasNoData = useMemo(
    () =>
      !loading &&
      data.flights.length === 0 &&
      data.trains.length === 0 &&
      data.taxis.length === 0 &&
      data.ferries.length === 0,
    [data, loading],
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Travel Planner</h1>
        <p className="text-muted-foreground">
          Placeholder logistics hub for coordinating regional travel and transport around upcoming shows.
        </p>
      </header>

      {loading && <p className="text-sm text-muted-foreground">Loading travel itineraries...</p>}
      {error && !loading && (
        <p className="text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      )}
      {hasNoData && (
        <p className="text-sm text-muted-foreground">No travel data available right now. Check back soon for updated routes.</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Flights</CardTitle>
          <CardDescription>Sample itineraries between tour cities including cost, travel time, and sustainability notes.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>City From</TableHead>
                <TableHead>City To</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Health Impact</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.flights.map((flight) => (
                <TableRow
                  key={`${flight.id}-${flight.city_from ?? "unknown"}-${flight.city_to ?? "unknown"}`}
                >
                  <TableCell className="font-medium">{flight.city_from ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{flight.city_to ?? "—"}</TableCell>
                  <TableCell className="text-right font-medium">{formatValue(flight.cost)}</TableCell>
                  <TableCell>{formatDuration(flight.duration)}</TableCell>
                  <TableCell className="text-muted-foreground">{flight.health_impact ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Trains</CardTitle>
          <CardDescription>Regional rail routes providing pricing, timing, and health impact guidance.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>City From</TableHead>
                <TableHead>City To</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Health Impact</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.trains.map((train) => (
                <TableRow
                  key={`${train.id}-${train.city_from ?? "unknown"}-${train.city_to ?? "unknown"}`}
                >
                  <TableCell className="font-medium">{train.city_from ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{train.city_to ?? "—"}</TableCell>
                  <TableCell className="text-right font-medium">{formatValue(train.cost)}</TableCell>
                  <TableCell>{formatDuration(train.duration)}</TableCell>
                  <TableCell className="text-muted-foreground">{train.health_impact ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Taxis</CardTitle>
          <CardDescription>Ground transfers for airport runs and venue hops with health impact context.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>City From</TableHead>
                <TableHead>City To</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Health Impact</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.taxis.map((taxi) => (
                <TableRow
                  key={`${taxi.id}-${taxi.city_from ?? "unknown"}-${taxi.city_to ?? "unknown"}`}
                >
                  <TableCell className="font-medium">{taxi.city_from ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{taxi.city_to ?? "—"}</TableCell>
                  <TableCell className="text-right font-medium">{formatValue(taxi.cost)}</TableCell>
                  <TableCell>{formatDuration(taxi.duration)}</TableCell>
                  <TableCell className="text-muted-foreground">{taxi.health_impact ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ferries</CardTitle>
          <CardDescription>Coastal shuttle options highlighting cost, duration, and overall health considerations.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>City From</TableHead>
                <TableHead>City To</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Health Impact</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.ferries.map((ferry) => (
                <TableRow
                  key={`${ferry.id}-${ferry.city_from ?? "unknown"}-${ferry.city_to ?? "unknown"}`}
                >
                  <TableCell className="font-medium">{ferry.city_from ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{ferry.city_to ?? "—"}</TableCell>
                  <TableCell className="text-right font-medium">{formatValue(ferry.cost)}</TableCell>
                  <TableCell>{formatDuration(ferry.duration)}</TableCell>
                  <TableCell className="text-muted-foreground">{ferry.health_impact ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Private Jet</CardTitle>
            <CardDescription>Availability snapshot for premium routing and last-minute bookings.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              Charter partner indicates a midsize Citation Latitude available with 12 hours notice. Includes onboard Wi-Fi,
              light catering, and two checked instrument cases. Additional fuel stop required on coast-to-coast legs.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground/80">Base Rate</p>
                <p className="text-lg font-semibold text-foreground">$6,500 / hr</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground/80">Crew Fees</p>
                <p className="text-lg font-semibold text-foreground">$1,200 (per leg)</p>
              </div>
            </div>
            <p>
              Ground concierge can align hangar access with tour gear logistics. Pending confirmation on weekend runway
              maintenance at LAX; consider Van Nuys as alternate.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Band Vehicle</CardTitle>
            <CardDescription>Mini-bus configuration for regional runouts and day-trip promo stops.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              12-passenger Sprinter with custom band wrap, reclining seats, rear gear bay, and onboard power for mobile
              production. Driver rostered for up to 10 hours daily with mandated rest windows tracked via tour manager app.
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Daily rental: $580 including insurance and mileage up to 250mi.</li>
              <li>Optional trailer for additional backline adds $120 per day.</li>
              <li>Coordinate load-in times with venue ops to reserve curbside staging.</li>
            </ul>
            <p>
              Placeholder telemetry dashboard will surface fuel efficiency, maintenance reminders, and crew seating charts in
              future iterations.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Travel;
