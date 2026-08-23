import { useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useFestivalCheckIn,
  useLeaveFestivalEarly,
  useMyFestivalAttendance,
  useMyFestivalCheckInEligibility,
} from "../attendance/useFestivalAttendance";
import type { FestivalCheckInEligibility } from "../attendance/festivalAttendeeExtras";
import type { FestivalPlayerAttendance } from "../attendance/festivalAttendance";
import { usePublicFestival, usePurchaseFestivalTickets } from "../application/useFestivalLaunch";
import { formatFestivalLaunchMoney } from "../domain/festivalLaunch";

const Countdown = ({ target }: { target: string }) => {
  const remaining = Math.max(0, Date.parse(target) - Date.now());
  if (!remaining) return <p className="font-semibold">Festival opening is scheduled now.</p>;
  const minutes = Math.floor(remaining / 60000);
  return (
    <p aria-label="Festival countdown" className="text-xl font-bold">
      {Math.floor(minutes / 1440)} days {Math.floor((minutes % 1440) / 60)} hours {minutes % 60} minutes
    </p>
  );
};

const checkInMessage = (eligibility: FestivalCheckInEligibility) => {
  if (eligibility.canCheckIn) {
    return `You are in ${eligibility.cityName || "the festival city"} and eligible to check in.`;
  }

  switch (eligibility.blockReason) {
    case "festival_not_started":
      return eligibility.startsOn
        ? `Check-in opens when the festival starts on ${new Date(`${eligibility.startsOn}T12:00:00`).toLocaleDateString("en-GB")}.`
        : "Festival check-in has not opened yet.";
    case "wrong_city":
      return `Travel to ${eligibility.cityName || "the festival city"} before checking in.`;
    case "character_traveling":
      return "Finish your current journey before checking in.";
    case "ticket_invalid":
      return "Your admission ticket is no longer valid for check-in.";
    case "festival_cancelled":
      return "This festival has been cancelled, so check-in is unavailable.";
    case "festival_finished":
      return "This festival has finished and check-in is closed.";
    case "festival_dates_unavailable":
    case "festival_city_unavailable":
      return "Festival check-in information is not complete yet.";
    case "already_attending":
      return "You are checked in and currently attending this festival.";
    case "attendance_closed":
      return "This festival attendance has already ended.";
    default:
      return "Festival check-in is not available yet.";
  }
};

const attendanceLabel = (attendance: FestivalPlayerAttendance) => {
  switch (attendance.status) {
    case "attending":
      return "Checked in";
    case "left_early":
      return "Left festival";
    case "completed":
      return "Festival completed";
    default:
      return "You’re attending";
  }
};

const mutationErrorMessage = (message: string) => {
  if (message.includes("festival_wrong_city")) return "Travel to the festival city before checking in.";
  if (message.includes("festival_character_traveling")) return "Finish your current journey before checking in.";
  if (message.includes("festival_not_started")) return "Festival check-in has not opened yet.";
  if (message.includes("festival_finished")) return "This festival has finished and check-in is closed.";
  if (message.includes("festival_ticket_invalid")) return "Your admission ticket is no longer valid.";
  if (message.includes("festival_cancelled")) return "This festival has been cancelled.";
  return message.replaceAll("_", " ");
};

export default function PublicFestivalPage() {
  const { festivalCompanyIdentifier } = useParams();
  const { user } = useAuth();
  const { data: f, isLoading, isError } = usePublicFestival(festivalCompanyIdentifier);
  const { data: attendance = [] } = useMyFestivalAttendance(Boolean(user));
  const { data: checkInEligibility = [] } = useMyFestivalCheckInEligibility(Boolean(user));
  const buy = usePurchaseFestivalTickets();
  const checkIn = useFestivalCheckIn();
  const leaveEarly = useLeaveFestivalEarly();
  const [quantity, setQuantity] = useState(1);

  if (isLoading) return <main className="p-8" role="status">Loading Festival…</main>;
  if (isError || !f) return <main className="p-8" role="alert">Festival not found.</main>;

  const myAttendance = attendance.find(
    (item) => item.festivalLaunchId === f.id && item.status !== "cancelled" && item.status !== "refunded",
  );
  const myCheckInEligibility = myAttendance
    ? checkInEligibility.find((item) => item.attendanceId === myAttendance.id)
    : undefined;

  return (
    <main>
      <header className="bg-gradient-to-br from-violet-950 to-fuchsia-900 p-6 text-white md:p-12">
        <div className="mx-auto max-w-6xl">
          <Badge>{f.launchStatus.replaceAll("_", " ")}</Badge>
          <h1 className="mt-4 text-4xl font-black md:text-7xl">{f.name}</h1>
          <p className="mt-3 max-w-3xl text-lg">{f.tagline}</p>
          <p className="mt-5">
            {f.city}, {f.country} · {new Date(f.startsAt).toLocaleDateString("en-GB")}–
            {new Date(f.endsAt).toLocaleDateString("en-GB")}
          </p>
          <div className="mt-5">
            <Countdown target={f.countdownTarget} />
            <span className="text-xs">Festival local time: {f.timezone}</span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl p-4 md:p-8">
        {myAttendance && (
          <Card className="mb-4 border-emerald-500/40 bg-emerald-500/5">
            <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{attendanceLabel(myAttendance)}</Badge>
                  <span className="text-sm capitalize text-muted-foreground">
                    {myAttendance.status.replaceAll("_", " ")}
                  </span>
                  {myCheckInEligibility?.canCheckIn && (
                    <Badge className="bg-emerald-600">Ready to check in</Badge>
                  )}
                  {myCheckInEligibility?.wristbandIssued && (
                    <Badge variant="outline">Wristband collected</Badge>
                  )}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Admission ticket {myAttendance.ticketReference}
                  {myAttendance.includesCamping ? " · Camping included" : ""}
                  {myAttendance.includesVipArea ? " · VIP access" : ""}
                </p>
                {myCheckInEligibility && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {checkInMessage(myCheckInEligibility)}
                  </p>
                )}
                {checkIn.isError && (
                  <p className="mt-2 text-sm text-destructive" role="alert">
                    {mutationErrorMessage(checkIn.error.message)}
                  </p>
                )}
                {leaveEarly.isError && (
                  <p className="mt-2 text-sm text-destructive" role="alert">
                    {mutationErrorMessage(leaveEarly.error.message)}
                  </p>
                )}
                {checkIn.isSuccess && (
                  <p className="mt-2 text-sm text-emerald-700" role="status">
                    Checked in. Your admission ticket was used and your festival wristband was collected.
                  </p>
                )}
                {leaveEarly.isSuccess && (
                  <p className="mt-2 text-sm text-muted-foreground" role="status">
                    You have left the festival early. Your wristband remains in your keepsakes.
                  </p>
                )}
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                {myCheckInEligibility?.canCheckIn && myAttendance.status !== "attending" && (
                  <Button
                    disabled={checkIn.isPending}
                    onClick={() => checkIn.mutate(myAttendance.id)}
                  >
                    {checkIn.isPending ? "Checking in…" : "Check in to festival"}
                  </Button>
                )}
                {myAttendance.status === "attending" && (
                  <Button
                    variant="outline"
                    disabled={leaveEarly.isPending}
                    onClick={() => leaveEarly.mutate(myAttendance.id)}
                  >
                    {leaveEarly.isPending ? "Leaving…" : "Leave festival early"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="overview">
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="lineup">Line-up</TabsTrigger>
            <TabsTrigger value="timetable">Timetable</TabsTrigger>
            <TabsTrigger value="tickets">Tickets</TabsTrigger>
            <TabsTrigger value="information">Information</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <Card>
              <CardContent className="pt-6">
                <p>{f.description}</p>
                <h2 className="mt-6 text-2xl font-bold">Sponsors</h2>
                <div className="mt-3 flex flex-wrap gap-3">
                  {f.sponsors.map((s) => (
                    <Badge key={s.id} variant="outline">{s.name} · {s.relationshipLabel}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="lineup">
            <section className="grid gap-3 sm:grid-cols-2">
              {f.timetable.map((x) => (
                <Card key={x.id}>
                  <CardHeader>
                    <CardTitle>{x.artistName} {x.headline && <Badge>Headliner</Badge>}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {x.stageName} · {new Date(x.startsAt).toLocaleString("en-GB", { timeZone: f.timezone })}
                  </CardContent>
                </Card>
              ))}
            </section>
          </TabsContent>

          <TabsContent value="timetable">
            <div className="space-y-2">
              {f.timetable.map((x) => (
                <article key={x.id} className="grid grid-cols-[5rem_1fr] rounded-lg border p-3">
                  <time>
                    {new Date(x.startsAt).toLocaleTimeString("en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: f.timezone,
                    })}
                  </time>
                  <div>
                    <strong>{x.artistName}</strong>
                    <p className="text-sm text-muted-foreground">{x.stageName}</p>
                  </div>
                </article>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="tickets">
            <section className="grid gap-4 md:grid-cols-2">
              {f.ticketProducts.map((p) => (
                <Card key={p.id}>
                  <CardHeader><CardTitle>{p.name}</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-2xl font-bold">{formatFestivalLaunchMoney(p.totalMinor, p.currency)}</p>
                    <p>{p.accessStartDate}–{p.accessEndDate} · {p.availableQuantity} available</p>
                    {p.productClass !== "admission" && (
                      <p className="text-sm text-amber-600">
                        This is an add-on or upgrade and does not grant Festival admission.
                      </p>
                    )}
                    <label className="block">
                      Quantity
                      <input
                        aria-label={`Quantity for ${p.name}`}
                        className="ml-2 w-16 rounded border bg-background p-2"
                        type="number"
                        min={1}
                        max={p.purchaseLimit}
                        value={quantity}
                        onChange={(e) => setQuantity(Number(e.target.value))}
                      />
                    </label>
                    <Button
                      disabled={buy.isPending || p.availableQuantity === 0 || f.launchStatus !== "tickets_on_sale"}
                      onClick={() => buy.mutate({
                        festivalLaunchId: f.id,
                        ticketProductId: p.id,
                        quantity,
                        idempotencyKey: crypto.randomUUID(),
                      })}
                    >
                      {buy.isPending ? "Completing purchase…" : p.availableQuantity === 0 ? "Sold out" : "Confirm purchase"}
                    </Button>
                    {buy.isError && <p role="alert">{buy.error.message.replaceAll("_", " ")}</p>}
                    {buy.isSuccess && (
                      <p role="status">Purchase complete. {buy.data.tickets.length} ticket(s) issued.</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </section>
          </TabsContent>

          <TabsContent value="information">
            <dl className="grid gap-5 md:grid-cols-2">
              {Object.entries(f.information).map(([k, v]) => (
                <div key={k}>
                  <dt className="font-bold capitalize">{k.replace(/([A-Z])/g, " $1")}</dt>
                  <dd>{v || "Information coming soon."}</dd>
                </div>
              ))}
            </dl>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
