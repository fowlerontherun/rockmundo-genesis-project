import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Mode = "bus" | "train" | "plane" | "ship" | "private_jet";
type City = {
  id: string;
  name: string;
  country: string;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  is_coastal: boolean | null;
};

const MODE = {
  bus: { speed: 56, perKm: 0.05, min: 0, max: 600, base: 10, buffer: 0.22 },
  train: { speed: 200, perKm: 0.12, min: 30, max: 1500, base: 25, buffer: 0.45 },
  plane: { speed: 944, perKm: 0.12, min: 100, max: 20000, base: 150, buffer: 2.7 },
  ship: { speed: 39, perKm: 0.06, min: 50, max: 2000, base: 80, buffer: 0.9 },
  private_jet: { speed: 900, perKm: 0, min: 0, max: 99999, base: 75000, buffer: 0 },
} as const;

const RAIL: Record<string, string[]> = {
  "United Kingdom": ["France", "Belgium", "Netherlands", "Ireland"],
  France: ["United Kingdom", "Belgium", "Germany", "Spain", "Italy", "Switzerland", "Netherlands", "Luxembourg"],
  Germany: ["France", "Netherlands", "Belgium", "Austria", "Switzerland", "Poland", "Czech Republic", "Denmark", "Luxembourg"],
  Spain: ["France", "Portugal"], Italy: ["France", "Switzerland", "Austria", "Germany", "Slovenia"],
  Netherlands: ["Germany", "Belgium", "France", "United Kingdom"], Belgium: ["France", "Netherlands", "Germany", "United Kingdom", "Luxembourg"],
  Austria: ["Germany", "Italy", "Switzerland", "Czech Republic", "Hungary", "Slovakia", "Slovenia"], Switzerland: ["France", "Germany", "Italy", "Austria"],
  Portugal: ["Spain"], Ireland: ["United Kingdom"], Luxembourg: ["France", "Germany", "Belgium"],
  Sweden: ["Norway", "Denmark", "Finland"], Norway: ["Sweden"], Denmark: ["Germany", "Sweden"], Finland: ["Sweden", "Estonia", "Russia"],
  Estonia: ["Latvia", "Finland"], Latvia: ["Estonia", "Lithuania", "Belarus"], Lithuania: ["Latvia", "Poland", "Belarus"],
  Poland: ["Germany", "Czech Republic", "Slovakia", "Lithuania", "Ukraine", "Belarus"],
  "Czech Republic": ["Germany", "Austria", "Poland", "Slovakia"], Slovakia: ["Czech Republic", "Poland", "Austria", "Hungary"],
  Hungary: ["Austria", "Slovakia", "Romania", "Serbia", "Croatia", "Slovenia", "Ukraine"], Romania: ["Hungary", "Bulgaria", "Serbia", "Moldova", "Ukraine"],
  Bulgaria: ["Romania", "Serbia", "Greece", "North Macedonia"], Serbia: ["Hungary", "Romania", "Bulgaria", "Croatia", "Bosnia and Herzegovina", "North Macedonia"],
  Croatia: ["Slovenia", "Hungary", "Serbia", "Bosnia and Herzegovina"], Slovenia: ["Italy", "Austria", "Hungary", "Croatia"],
  Greece: ["Bulgaria", "Turkey", "Albania", "North Macedonia"], Ukraine: ["Poland", "Romania", "Hungary", "Moldova", "Belarus"],
  Belarus: ["Poland", "Lithuania", "Latvia", "Russia", "Ukraine"], Moldova: ["Ukraine", "Romania"],
  "Bosnia and Herzegovina": ["Croatia", "Serbia"], Albania: ["Greece", "North Macedonia"], "North Macedonia": ["Serbia", "Bulgaria", "Greece", "Albania"],
  Georgia: ["Turkey", "Armenia"], Armenia: ["Georgia", "Turkey"], Russia: ["China", "Finland", "Belarus", "Kazakhstan"], Kazakhstan: ["Russia", "China"],
  Turkey: ["Greece", "Georgia", "Armenia", "Lebanon"], Lebanon: ["Turkey", "Jordan"], Jordan: ["Saudi Arabia", "Lebanon"],
  "Saudi Arabia": ["Jordan", "United Arab Emirates"], Qatar: ["Saudi Arabia"], "United Arab Emirates": ["Saudi Arabia"],
  China: ["Russia", "Mongolia", "Vietnam", "Pakistan", "Kazakhstan"], India: ["Pakistan", "Bangladesh", "Nepal"], Pakistan: ["India", "China"],
  Bangladesh: ["India"], Japan: [], "South Korea": [], Thailand: ["Malaysia", "Cambodia", "Vietnam", "Myanmar"], Malaysia: ["Thailand", "Singapore"],
  Singapore: ["Malaysia"], Vietnam: ["China", "Cambodia", "Thailand"], Indonesia: [], Philippines: [], "Sri Lanka": [],
  Morocco: ["Spain", "Algeria"], Algeria: ["Tunisia", "Morocco"], Tunisia: ["Algeria"], Egypt: [], Nigeria: [],
  "South Africa": ["Mozambique"], Kenya: ["Uganda", "Tanzania"], Uganda: ["Kenya", "Tanzania"], Tanzania: ["Kenya", "Uganda", "Mozambique"], Mozambique: ["Tanzania", "South Africa"],
  "United States": ["Canada", "Mexico"], Canada: ["United States"], Mexico: ["United States", "Guatemala"], Guatemala: ["Honduras", "Mexico"], Honduras: ["Guatemala"],
  "Costa Rica": ["Panama"], Panama: ["Costa Rica", "Colombia"], Colombia: ["Panama", "Venezuela", "Ecuador"], Venezuela: ["Colombia", "Brazil"],
  Ecuador: ["Colombia", "Peru"], Peru: ["Ecuador", "Bolivia"], Brazil: ["Argentina", "Paraguay", "Uruguay", "Venezuela", "Bolivia"],
  Argentina: ["Brazil", "Chile", "Uruguay", "Paraguay", "Bolivia"], Bolivia: ["Peru", "Brazil", "Argentina", "Paraguay"], Paraguay: ["Brazil", "Argentina", "Bolivia"],
  Australia: [], "New Zealand": [], "Dominican Republic": [], "Puerto Rico": [], Haiti: [], Senegal: [], "DR Congo": [], Angola: [],
};

const SHIP_ROUTES = new Set([
  "Europe|Europe", "Europe|Africa", "Asia|Asia", "Asia|Oceania", "North America|North America", "Oceania|Oceania",
  "Caribbean|North America", "Caribbean|South America", "Caribbean|Caribbean", "Central America|North America",
  "Central America|South America", "Central America|Central America", "Middle East|Africa", "Middle East|Asia",
  "Middle East|Middle East", "South America|South America", "Africa|Africa",
]);

const COASTAL = new Set([
  "London","Liverpool","Bristol","Glasgow","Edinburgh","Brighton","Cardiff","Belfast","Newcastle","Portsmouth",
  "Sydney","Melbourne","Brisbane","Perth","Gold Coast","Auckland","Wellington","Tokyo","Osaka","Yokohama","Fukuoka","Nagoya",
  "Miami","San Francisco","Seattle","Los Angeles","San Diego","Boston","New York","Houston","Honolulu","Vancouver","Toronto",
  "Hong Kong","Singapore","Mumbai","Chennai","Kolkata","Colombo","Karachi","Rio de Janeiro","São Paulo","Buenos Aires","Lima","Montevideo","Caracas",
  "Barcelona","Marseille","Naples","Venice","Lisbon","Porto","Malaga","Nice","Bordeaux","Seville","Athens","Istanbul","Dubai","Tel Aviv","Beirut","Doha",
  "Cape Town","Lagos","Cairo","Casablanca","Accra","Dakar","Dar es Salaam","Luanda","Maputo","Tunis","Algiers","Copenhagen","Stockholm","Oslo","Helsinki",
  "Amsterdam","Rotterdam","Hamburg","Gdansk","Gothenburg","Antwerp","Tallinn","Riga","Shanghai","Shenzhen","Guangzhou","Busan","Taipei","Bangkok",
  "Ho Chi Minh City","Jakarta","Manila","Kuala Lumpur","Hanoi","Panama City","San Juan","Santo Domingo","Port-au-Prince","Tirana",
]);

function distanceKm(a: City, b: City) {
  if (a.latitude == null || a.longitude == null || b.latitude == null || b.longitude == null) throw new Error("travel_city_coordinates_missing");
  const rad = (n: number) => n * Math.PI / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function railConnected(a: string, b: string) {
  return a === b || (RAIL[a] ?? []).includes(b);
}
function shipConnected(a: string | null, b: string | null) {
  if (!a || !b) return false;
  return SHIP_ROUTES.has(`${a}|${b}`) || SHIP_ROUTES.has(`${b}|${a}`);
}
function coastal(city: City) { return city.is_coastal ?? COASTAL.has(city.name); }

function quoteMode(mode: Mode, distance: number, from: City, to: City) {
  const cfg = MODE[mode];
  if (!cfg || distance < cfg.min || distance > cfg.max) throw new Error("travel_mode_unavailable_for_distance");
  if (mode === "bus") {
    const same = from.country === to.country;
    const shortEuropean = !same && from.region === "Europe" && to.region === "Europe" && distance <= 250;
    if (!same && !shortEuropean) throw new Error("travel_bus_route_unavailable");
  }
  if (mode === "train") {
    const networkRegions = ["Europe", "Asia"];
    const bothNetwork = networkRegions.includes(from.region ?? "") && networkRegions.includes(to.region ?? "");
    if (!bothNetwork && from.country !== to.country) throw new Error("travel_train_network_unavailable");
    if (bothNetwork && !railConnected(from.country, to.country)) throw new Error("travel_train_connection_unavailable");
  }
  if (mode === "ship") {
    if (!coastal(from) || !coastal(to) || !shipConnected(from.region, to.region)) throw new Error("travel_ship_route_unavailable");
  }

  let fare = cfg.base + distance * cfg.perKm;
  if (mode === "private_jet") fare = cfg.base;
  if (mode === "plane") {
    if (distance > 5000) fare = cfg.base + 5000 * cfg.perKm + (distance - 5000) * cfg.perKm * 1.5;
    if (distance > 10000) fare += (distance - 10000) * cfg.perKm * 0.5;
  }
  const duration = mode === "private_jet" ? 2.7 : Math.round((distance / cfg.speed + cfg.buffer) * 10) / 10;
  return { rawFare: Math.round(fare), rawDurationHours: duration };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Authorization required" }, 401);
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return json({ error: "Travel service unavailable" }, 503);
    const service = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: authData, error: authError } = await service.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const destinationCityId = String(body.destinationCityId ?? "");
    const mode = String(body.transportType ?? "").toLowerCase() as Mode;
    if (!destinationCityId || !(mode in MODE)) return json({ error: "Invalid destination or transport mode" }, 400);
    if (!body.idempotencyKey || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.idempotencyKey)) {
      return json({ error: "A valid idempotency key is required" }, 400);
    }

    const { data: profile, error: profileError } = await service
      .from("profiles")
      .select("id,current_city_id")
      .eq("user_id", authData.user.id)
      .eq("is_active", true)
      .is("died_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (profileError || !profile?.current_city_id) return json({ error: "travel_profile_or_city_not_found" }, 409);

    const { data: cities, error: cityError } = await service
      .from("cities")
      .select("id,name,country,region,latitude,longitude,is_coastal")
      .in("id", [profile.current_city_id, destinationCityId]);
    if (cityError || !cities || cities.length !== 2) return json({ error: "travel_city_not_found" }, 409);
    const from = cities.find((c: City) => c.id === profile.current_city_id) as City | undefined;
    const to = cities.find((c: City) => c.id === destinationCityId) as City | undefined;
    if (!from || !to || from.id === to.id) return json({ error: "travel_invalid_city_pair" }, 409);

    const distance = distanceKm(from, to);
    const raw = quoteMode(mode, distance, from, to);
    const departure = mode === "private_jet" ? new Date().toISOString() : String(body.scheduledDepartureTime ?? "");
    if (!departure || Number.isNaN(new Date(departure).getTime())) return json({ error: "travel_departure_required" }, 400);

    const quoteSnapshot = {
      formulaVersion: "authoritative-travel-v1",
      fromCityId: from.id,
      toCityId: to.id,
      transportType: mode,
      distanceKm: Math.round(distance),
      rawFare: raw.rawFare,
      rawDurationHours: raw.rawDurationHours,
    };

    const { data: result, error: bookingError } = await service.rpc("book_authoritative_travel", {
      p_user_id: authData.user.id,
      p_destination_city_id: to.id,
      p_transport_type: mode,
      p_departure_time: departure,
      p_raw_fare: raw.rawFare,
      p_raw_duration_hours: raw.rawDurationHours,
      p_idempotency_key: body.idempotencyKey,
      p_quote_snapshot: quoteSnapshot,
    });
    if (bookingError) {
      console.error("[travel-booking] booking failed", bookingError);
      const message = bookingError.message || "Unable to book travel";
      const status = message.includes("insufficient") ? 402 : 409;
      return json({ error: message }, status);
    }
    return json({ success: true, result });
  } catch (error) {
    console.error("[travel-booking] unhandled error", error);
    return json({ error: error instanceof Error ? error.message : "Unexpected travel error" }, 500);
  }
});
