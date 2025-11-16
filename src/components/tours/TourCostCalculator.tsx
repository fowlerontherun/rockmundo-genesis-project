import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

const clampToNumber = (value: string, fallback: number) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const TourCostCalculator = () => {
  const [transportCost, setTransportCost] = useState(3500);
  const [travelDays, setTravelDays] = useState(10);
  const [crewSize, setCrewSize] = useState(8);
  const [perDiem, setPerDiem] = useState(55);
  const [lodgingNights, setLodgingNights] = useState(12);
  const [lodgingRate, setLodgingRate] = useState(180);
  const [miscExpenses, setMiscExpenses] = useState(900);

  const totals = useMemo(() => {
    const crewMeals = crewSize * perDiem * travelDays;
    const lodging = lodgingNights * lodgingRate;
    const total = transportCost + crewMeals + lodging + miscExpenses;
    const perPerson = crewSize > 0 ? total / crewSize : total;

    return {
      crewMeals,
      lodging,
      total,
      perPerson,
    };
  }, [crewSize, lodgingNights, lodgingRate, miscExpenses, perDiem, transportCost, travelDays]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cost Calculator</CardTitle>
        <CardDescription>
          Adjust the sliders to estimate core tour logistics costs and per person allocation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="transport-cost">Transport & fuel</Label>
            <Input
              id="transport-cost"
              type="number"
              min={0}
              value={transportCost}
              onChange={(event) => setTransportCost(clampToNumber(event.target.value, transportCost))}
            />
            <p className="text-xs text-muted-foreground">
              Bus or flight block bookings, fuel, tolls, and driver retainers.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="travel-days">Active travel days</Label>
            <Input
              id="travel-days"
              type="number"
              min={1}
              value={travelDays}
              onChange={(event) => setTravelDays(clampToNumber(event.target.value, travelDays))}
            />
            <p className="text-xs text-muted-foreground">Used to calculate total meal per diems.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="crew-size">Crew size</Label>
            <Input
              id="crew-size"
              type="number"
              min={1}
              value={crewSize}
              onChange={(event) => setCrewSize(clampToNumber(event.target.value, crewSize))}
            />
            <p className="text-xs text-muted-foreground">Include band members, drivers, and support staff.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="per-diem">Per diem (USD)</Label>
            <Input
              id="per-diem"
              type="number"
              min={0}
              value={perDiem}
              onChange={(event) => setPerDiem(clampToNumber(event.target.value, perDiem))}
            />
            <p className="text-xs text-muted-foreground">Daily meal allowance per person.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="lodging-nights">Lodging nights</Label>
            <Input
              id="lodging-nights"
              type="number"
              min={0}
              value={lodgingNights}
              onChange={(event) => setLodgingNights(clampToNumber(event.target.value, lodgingNights))}
            />
            <p className="text-xs text-muted-foreground">Includes off-days and travel buffer nights.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="lodging-rate">Average nightly rate</Label>
            <Input
              id="lodging-rate"
              type="number"
              min={0}
              value={lodgingRate}
              onChange={(event) => setLodgingRate(clampToNumber(event.target.value, lodgingRate))}
            />
            <p className="text-xs text-muted-foreground">Bundle for hotels or rentals per night.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="misc-expenses">Miscellaneous buffer</Label>
            <Input
              id="misc-expenses"
              type="number"
              min={0}
              value={miscExpenses}
              onChange={(event) => setMiscExpenses(clampToNumber(event.target.value, miscExpenses))}
            />
            <p className="text-xs text-muted-foreground">Visas, emergency repairs, and hospitality.</p>
          </div>
        </div>

        <div className="grid gap-4 rounded-lg border bg-muted/40 p-4 sm:grid-cols-2">
          <div>
            <p className="text-sm text-muted-foreground">Crew meals & per diems</p>
            <p className="text-xl font-semibold">{formatCurrency(totals.crewMeals)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Lodging total</p>
            <p className="text-xl font-semibold">{formatCurrency(totals.lodging)}</p>
          </div>
          <div className="sm:col-span-2 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total tour logistics</span>
              <Badge className="text-base font-semibold px-3 py-1">
                {formatCurrency(totals.total)}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Includes transport, per diems, lodging, and miscellaneous reserves.
            </p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-sm text-muted-foreground">Cost per person</p>
            <p className="text-lg font-medium">{formatCurrency(totals.perPerson)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TourCostCalculator;
