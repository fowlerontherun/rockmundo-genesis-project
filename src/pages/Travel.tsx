import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const flights = [
  {
    cityFrom: "Los Angeles",
    cityTo: "Seattle",
    cost: "$245",
    duration: "2h 55m",
    healthImpact: "High emissions – offset recommended",
  },
  {
    cityFrom: "Chicago",
    cityTo: "Atlanta",
    cost: "$210",
    duration: "2h 5m",
    healthImpact: "Moderate emissions",
  },
  {
    cityFrom: "New York",
    cityTo: "Austin",
    cost: "$320",
    duration: "3h 50m",
    healthImpact: "High emissions – consider rail when possible",
  },
];

const trains = [
  {
    cityFrom: "San Francisco",
    cityTo: "Los Angeles",
    cost: "$145",
    duration: "8h 20m",
    healthImpact: "Low emissions",
  },
  {
    cityFrom: "Boston",
    cityTo: "Philadelphia",
    cost: "$95",
    duration: "5h 10m",
    healthImpact: "Very low emissions",
  },
  {
    cityFrom: "Portland",
    cityTo: "Vancouver",
    cost: "$130",
    duration: "7h 5m",
    healthImpact: "Low emissions",
  },
];

const taxis = [
  {
    cityFrom: "Downtown Los Angeles",
    cityTo: "LAX",
    cost: "$48",
    duration: "45m",
    healthImpact: "Moderate emissions",
  },
  {
    cityFrom: "Brooklyn",
    cityTo: "JFK",
    cost: "$62",
    duration: "55m",
    healthImpact: "Moderate emissions",
  },
  {
    cityFrom: "Chicago Loop",
    cityTo: "United Center",
    cost: "$22",
    duration: "18m",
    healthImpact: "Moderate emissions",
  },
];

const ferries = [
  {
    cityFrom: "Seattle",
    cityTo: "Bainbridge Island",
    cost: "$18",
    duration: "35m",
    healthImpact: "Low emissions",
  },
  {
    cityFrom: "San Francisco",
    cityTo: "Sausalito",
    cost: "$16",
    duration: "30m",
    healthImpact: "Low emissions",
  },
  {
    cityFrom: "Boston",
    cityTo: "Salem",
    cost: "$28",
    duration: "55m",
    healthImpact: "Moderate emissions",
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
              {flights.map((flight) => (
                <TableRow key={`${flight.cityFrom}-${flight.cityTo}`}>
                  <TableCell className="font-medium">{flight.cityFrom}</TableCell>
                  <TableCell className="text-muted-foreground">{flight.cityTo}</TableCell>
                  <TableCell className="text-right font-medium">{flight.cost}</TableCell>
                  <TableCell>{flight.duration}</TableCell>
                  <TableCell className="text-muted-foreground">{flight.healthImpact}</TableCell>
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
              {trains.map((train) => (
                <TableRow key={`${train.cityFrom}-${train.cityTo}`}>
                  <TableCell className="font-medium">{train.cityFrom}</TableCell>
                  <TableCell className="text-muted-foreground">{train.cityTo}</TableCell>
                  <TableCell className="text-right font-medium">{train.cost}</TableCell>
                  <TableCell>{train.duration}</TableCell>
                  <TableCell className="text-muted-foreground">{train.healthImpact}</TableCell>
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
              {taxis.map((taxi) => (
                <TableRow key={`${taxi.cityFrom}-${taxi.cityTo}`}>
                  <TableCell className="font-medium">{taxi.cityFrom}</TableCell>
                  <TableCell className="text-muted-foreground">{taxi.cityTo}</TableCell>
                  <TableCell className="text-right font-medium">{taxi.cost}</TableCell>
                  <TableCell>{taxi.duration}</TableCell>
                  <TableCell className="text-muted-foreground">{taxi.healthImpact}</TableCell>
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
              {ferries.map((ferry) => (
                <TableRow key={`${ferry.cityFrom}-${ferry.cityTo}`}>
                  <TableCell className="font-medium">{ferry.cityFrom}</TableCell>
                  <TableCell className="text-muted-foreground">{ferry.cityTo}</TableCell>
                  <TableCell className="text-right font-medium">{ferry.cost}</TableCell>
                  <TableCell>{ferry.duration}</TableCell>
                  <TableCell className="text-muted-foreground">{ferry.healthImpact}</TableCell>
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
