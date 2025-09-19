import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const flights = [
  {
    destination: "Los Angeles",
    departure: "09:10",
    arrival: "12:45",
    duration: "3h 35m",
    economy: "$285",
    business: "$540",
    first: "$890",
  },
  {
    destination: "New York",
    departure: "13:20",
    arrival: "17:55",
    duration: "4h 35m",
    economy: "$320",
    business: "$610",
    first: "$975",
  },
  {
    destination: "Austin",
    departure: "18:05",
    arrival: "20:10",
    duration: "2h 5m",
    economy: "$210",
    business: "$420",
    first: "$760",
  },
];

const trains = [
  {
    destination: "Chicago",
    schedule: "Daily 07:30 departure",
    duration: "5h 20m",
    fare: "$135 (reserved coach) / $220 (sleeper)",
  },
  {
    destination: "Seattle",
    schedule: "Mon, Wed, Fri 11:45 departure",
    duration: "8h 15m",
    fare: "$180 (business) / $260 (first class dome)",
  },
  {
    destination: "Portland",
    schedule: "Daily 16:10 departure",
    duration: "3h 45m",
    fare: "$98 (coach) / $155 (business)",
  },
];

const rideshares = [
  {
    category: "UberX",
    capacity: "4 passengers",
    estimate: "$22 - $28",
  },
  {
    category: "UberXL",
    capacity: "6 passengers",
    estimate: "$34 - $42",
  },
  {
    category: "Uber Black",
    capacity: "4 passengers",
    estimate: "$58 - $72",
  },
];

const Travel = () => {
  return (
    <div className="max-w-7xl mx-auto space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Travel Planner</h1>
        <p className="text-muted-foreground">
          Placeholder logistics hub for coordinating regional travel and transport around upcoming shows.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Flights</CardTitle>
          <CardDescription>Sample itineraries for quick hops between major tour cities.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Destination</TableHead>
                <TableHead className="hidden sm:table-cell">Departure</TableHead>
                <TableHead className="hidden sm:table-cell">Arrival</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead className="text-right">Economy</TableHead>
                <TableHead className="text-right">Business</TableHead>
                <TableHead className="text-right">First Class</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flights.map((flight) => (
                <TableRow key={flight.destination}>
                  <TableCell className="font-medium">{flight.destination}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">{flight.departure}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">{flight.arrival}</TableCell>
                  <TableCell>{flight.duration}</TableCell>
                  <TableCell className="text-right font-medium">{flight.economy}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{flight.business}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{flight.first}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Trains</CardTitle>
          <CardDescription>Regional rail options for lower-carbon travel between key markets.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Destination</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead className="text-right">Fare</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trains.map((train) => (
                <TableRow key={train.destination}>
                  <TableCell className="font-medium">{train.destination}</TableCell>
                  <TableCell className="text-muted-foreground">{train.schedule}</TableCell>
                  <TableCell>{train.duration}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{train.fare}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rideshare</CardTitle>
          <CardDescription>Local transport estimates for venue transfers and airport pickups.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vehicle</TableHead>
                <TableHead className="hidden sm:table-cell">Capacity</TableHead>
                <TableHead className="text-right">Estimated Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rideshares.map((ride) => (
                <TableRow key={ride.category}>
                  <TableCell className="font-medium">{ride.category}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">{ride.capacity}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{ride.estimate}</TableCell>
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
