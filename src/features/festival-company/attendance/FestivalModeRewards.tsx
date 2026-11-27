import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FestivalPlayerAttendance } from "./festivalAttendance";
import { getFestivalPassportProofs, getMemorabiliaForAttendance, rewardSummaryBelongsToAttendance } from "./festivalParticipation";
import { useMyFestivalMemorabilia } from "./useFestivalAttendance";
import { useMyFestivalRewardSummary } from "./useFestivalRewards";

export const FestivalModeRewards = ({ attendance }: { attendance: FestivalPlayerAttendance }) => {
  const { data, isLoading, isError, error, refetch } = useMyFestivalRewardSummary(attendance.id);
  const memorabilia = useMyFestivalMemorabilia();

  if (isLoading) return <div className="rounded-xl border bg-card p-6" role="status">Loading Festival progress…</div>;
  if (isError || !data) return <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-6" role="alert">Festival progress could not be loaded. {error instanceof Error ? error.message.replaceAll("_", " ") : ""} <button type="button" className="underline" onClick={() => void refetch()}>Retry</button></div>;
  if (!rewardSummaryBelongsToAttendance(attendance, data)) return <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-6" role="alert">Festival progress is out of date for this attendance. <button type="button" className="underline" onClick={() => void refetch()}>Retry</button></div>;

  const proofs = getFestivalPassportProofs(attendance, data);
  const issuedKeepsakes = getMemorabiliaForAttendance(memorabilia.data ?? [], attendance);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-gradient-to-br from-violet-950 to-fuchsia-900 p-5 text-white md:p-7">
        <Badge className="bg-white/15 text-white hover:bg-white/15">Rewards & memories</Badge>
        <h1 className="mt-3 text-3xl font-black">Your Festival story</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/75">
          Meaningful participation builds a bounded completion reward. Refreshing or repeating actions cannot increase the same settled reward indefinitely.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader><CardTitle className="text-sm">Skill XP</CardTitle></CardHeader><CardContent><p className="text-3xl font-black">{data.skillXp}</p><p className="text-xs text-muted-foreground">Maximum 600 per attendance</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Attribute Points</CardTitle></CardHeader><CardContent><p className="text-3xl font-black">{data.attributePoints}</p><p className="text-xs text-muted-foreground">Completion-weighted, capped at 2</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Inspiration</CardTitle></CardHeader><CardContent><p className="text-3xl font-black">{data.inspiration}</p><p className="text-xs text-muted-foreground">Festival condition snapshot</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Status</CardTitle></CardHeader><CardContent><Badge variant={data.settled ? "default" : "secondary"}>{data.settled ? "Settled" : "Building"}</Badge><p className="mt-2 text-xs text-muted-foreground">{data.settled ? "Reward locked and replay-safe" : "Final reward settles when attendance ends"}</p></CardContent></Card>
      </section>

      <Card>
        <CardHeader><CardTitle>Festival recap</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div><p className="text-2xl font-bold">{data.completedActivities}</p><p className="text-xs text-muted-foreground">Completed activities</p></div>
          <div><p className="text-2xl font-bold">{data.watchedActs}</p><p className="text-xs text-muted-foreground">Acts watched</p></div>
          <div><p className="text-2xl font-bold">{data.resolvedMoments}</p><p className="text-xs text-muted-foreground">Moments resolved</p></div>
          <div><p className="text-2xl font-bold">{data.distinctActivityTypes}</p><p className="text-xs text-muted-foreground">Different activity types</p></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Festival passport · verified highlights</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Evidence from this edition and attendance only. A highlight is recorded once, not earned again for repeated visits or refreshes. These indicators do not grant extra rewards.</p>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {proofs.map(proof => (
              <li key={proof.key} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{proof.label}</span>
                  <Badge variant={proof.verified ? "default" : "outline"}>{proof.verified ? "Verified" : "Not yet"}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{proof.evidence}</p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Personal participation milestones</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-muted-foreground">Your own progress, derived from server-confirmed activity. These are not festival-wide or community challenges and give no additional rewards.</p>
          <p><Badge variant={data.completedActivities >= 3 ? "default" : "secondary"}>{Math.min(data.completedActivities, 3)}/3</Badge> Complete three planned activities</p>
          <p><Badge variant={data.distinctActivityTypes >= 2 ? "default" : "secondary"}>{Math.min(data.distinctActivityTypes, 2)}/2</Badge> Try two different activity types</p>
          <p><Badge variant={data.watchedActs >= 1 ? "default" : "secondary"}>{Math.min(data.watchedActs, 1)}/1</Badge> Watch an act during its scheduled window</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Issued Festival keepsakes</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">Only memorabilia issued by the Festival server for this admission appears here. Photos, posters and other collectibles are not awarded by this screen.</p>
          {memorabilia.isLoading ? <p role="status">Loading your keepsakes…</p> : memorabilia.isError ? (
            <p role="alert" className="text-destructive">Keepsakes could not be loaded. <button type="button" className="underline" onClick={() => void memorabilia.refetch()}>Retry</button></p>
          ) : issuedKeepsakes.length === 0 ? <p>No keepsakes have been issued for this attendance yet.</p> : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {issuedKeepsakes.map(item => (
                <li className="rounded-lg border p-3" key={item.id}>
                  <div className="flex flex-wrap items-center gap-2"><strong>{item.displayName}</strong><Badge variant="outline" className="capitalize">{item.rarity}</Badge></div>
                  {item.description && <p className="mt-1 text-muted-foreground">{item.description}</p>}
                  <p className="mt-2 text-xs text-muted-foreground">Issued {new Date(item.issuedAt).toLocaleDateString("en-GB")}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>How rewards work</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Only authoritative completed activities, watched timetable acts, resolved Festival moments and the final attendance state count.</p>
          <p>Each category has a contribution cap, and one attendance can create only one reward settlement. Completing the whole Festival earns more than leaving early.</p>
          <p>A completed Festival also creates a permanent recap memory and can unlock the Festival Survivor recognition badge.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default FestivalModeRewards;
