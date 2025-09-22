import { useEffect, useMemo, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type TravelRecord = {
  id: string;
  city_from: string | null;
  city_to: string | null;
  cost: string | number | null;
  duration: string | number | null;
  health_impact: string | null;
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

        const [flightsResponse, trainsResponse, taxisResponse, ferriesResponse] = await Promise.all([
          supabase.from("travel_flights" as any).select("*"),
          supabase.from("travel_trains" as any).select("*"),
          supabase.from("travel_taxis" as any).select("*"),
          supabase.from("travel_ferries" as any).select("*"),
        ]);

        if (!isMounted) {
          return;
        }

        const errors = [
          flightsResponse.error,
          trainsResponse.error,
          taxisResponse.error,
          ferriesResponse.error,
        ].filter(Boolean);

        if (errors.length > 0) {
          setError(errors.map((entry) => entry!.message).join(" \u2022 "));
        }

        setData({
          flights: (flightsResponse.data ?? []) as TravelRecord[],
          trains: (trainsResponse.data ?? []) as TravelRecord[],
          taxis: (taxisResponse.data ?? []) as TravelRecord[],
          ferries: (ferriesResponse.data ?? []) as TravelRecord[],
        });
      } catch (fetchError) {
        if (!isMounted) {
          return;
        }

        const message = fetchError instanceof Error ? fetchError.message : "Failed to load travel data.";
        setError(message);
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
