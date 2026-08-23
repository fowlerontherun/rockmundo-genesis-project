import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FestivalPlayerAttendance } from "./festivalAttendance";

const formatDate = (value: string | null) =>
  value ? new Date(`${value}T12:00:00`).toLocaleDateString("en-GB", { dateStyle: "medium" }) : "TBC";

export const FestivalModeHome = ({ attendance }: { attendance: FestivalPlayerAttendance }) => (
  <div className="space-y-4">
    <section className="rounded-2xl bg-gradient-to-br from-violet-950 to-fuchsia-900 p-5 text-white md:p-8">
      <Badge className="bg-white/15 text-white hover:bg-white/15">Checked in</Badge>
      <h1 className="mt-3 text-3xl font-black md:text-5xl">{attendance.festivalName}</h1>
      <p className="mt-2 text-white/80">
        {formatDate(attendance.startsOn)} – {formatDate(attendance.endsOn)}
      </p>
      <p className="mt-4 max-w-2xl text-sm text-white/80">
        You are inside the festival. Your normal RockMundo schedule is reserved for the remaining festival window, so incompatible activities cannot be booked until you leave or the festival completes.
      </p>
    </section>

    <section className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader><CardTitle className="text-base">Admission</CardTitle></CardHeader>
        <CardContent>
          <p className="font-medium capitalize">{attendance.ticketType.replaceAll("_", " ")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{attendance.ticketReference}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Access</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Badge variant="secondary">Festival grounds</Badge>
          {attendance.includesCamping && <Badge variant="secondary">Camping</Badge>}
          {attendance.includesVipArea && <Badge variant="secondary">VIP</Badge>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Wristband</CardTitle></CardHeader>
        <CardContent>
          <p className="font-medium">Collected</p>
          <p className="mt-1 text-xs text-muted-foreground">Your keepsake remains in Inventory after the event.</p>
        </CardContent>
      </Card>
    </section>

    <Card>
      <CardHeader>
        <CardTitle>Festival gameplay is opening up</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p>This first Festival Mode shell deliberately keeps the experience small and authoritative.</p>
        <p>My Day, stages, food and drink, activities, social, campsite and the Festival map will be enabled progressively as their gameplay systems are implemented.</p>
      </CardContent>
    </Card>
  </div>
);

export default FestivalModeHome;
