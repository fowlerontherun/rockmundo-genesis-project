import { useState } from "react";
import { toast } from "sonner";
import { OwnedClubDjRoster } from "@/features/nightclub-dj/OwnedClubDjRoster";
import { OwnedClubThemeNights } from "@/features/nightclub-dj/OwnedClubThemeNights";
import { Building2, Users, DollarSign, Settings, Plus, Trash2, Loader2, ToggleLeft, ToggleRight, TrendingUp, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  useOwnedNightclubs,
  useNightclubStaff,
  useHireStaff,
  useFireStaff,
  useUpdateOwnedClub,
  getStaffTypes,
  getStaffBaseSalary,
  getNightclubStaffCap,
  calculateWeeklyRevenue,
  calculateWeeklyExpenses,
  type OwnedNightclub,
  type NightclubStaff,
} from "@/hooks/useNightclubOwnership";

const QUALITY_LABELS: Record<number, string> = {
  1: "Underground", 2: "Neighborhood", 3: "Boutique", 4: "Premier", 5: "Legendary",
};

const STAFF_LABELS: Record<string, string> = {
  bouncer: "Bouncer", bartender: "Bartender", dj: "DJ", promoter: "Promoter", manager: "Manager",
};

const currencyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const NightclubManagement = () => {
  const { data: clubs = [], isLoading } = useOwnedNightclubs();
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const selectedClub = clubs.find((c) => c.id === selectedClubId) ?? clubs[0] ?? null;

  if (isLoading) {
    return (
      <FMPageScaffold title="My Nightclubs" icon={Building2} backTo="/nightclubs" backLabel="Browse Clubs">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </FMPageScaffold>
    );
  }

  if (clubs.length === 0) {
    return (
      <FMPageScaffold title="My Nightclubs" subtitle="Club Management" icon={Building2} backTo="/nightclubs" backLabel="Browse Clubs">
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">You don't own any nightclubs yet.</p>
            <p className="text-sm text-muted-foreground">Visit the Nightclubs hub to find clubs available for purchase.</p>
            <Button variant="outline" onClick={() => window.location.href = "/nightclubs"}>Browse Clubs</Button>
          </CardContent>
        </Card>
      </FMPageScaffold>
    );
  }

  return (
    <FMPageScaffold title="My Nightclubs" subtitle={`${clubs.length} club${clubs.length !== 1 ? "s" : ""} owned`} icon={Building2} backTo="/nightclubs" backLabel="All Clubs">
      {clubs.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {clubs.map((c) => (
            <Button
              key={c.id}
              variant={selectedClub?.id === c.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedClubId(c.id)}
              className="shrink-0"
            >
              {c.club_name}
            </Button>
          ))}
        </div>
      )}

      {selectedClub && <ClubDashboard key={selectedClub.id} club={selectedClub} />}
    </FMPageScaffold>
  );
};

const ClubDashboard = ({ club }: { club: OwnedNightclub }) => {
  const { data: staff = [] } = useNightclubStaff(club.id);
  const updateClub = useUpdateOwnedClub();
  const [showHire, setShowHire] = useState(false);

  const staffCap = getNightclubStaffCap(club.capacity);
  const projectedRevenue = calculateWeeklyRevenue(club);
  const projectedExpenses = calculateWeeklyExpenses(club, staff);
  const projectedProfit = projectedRevenue - projectedExpenses;

  return (
    <div className="space-y-4">
      {/* Financial Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <DollarSign className="h-5 w-5 text-primary" /> Financial Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-border p-3 text-center">
              <div className="text-lg font-bold text-green-400">{currencyFormatter.format(projectedRevenue)}</div>
              <div className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
                <TrendingUp className="h-3 w-3" /> Weekly Revenue
              </div>
            </div>
            <div className="rounded-lg border border-border p-3 text-center">
              <div className="text-lg font-bold text-red-400">{currencyFormatter.format(projectedExpenses)}</div>
              <div className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
                <TrendingDown className="h-3 w-3" /> Weekly Expenses
              </div>
            </div>
            <div className="rounded-lg border border-border p-3 text-center">
              <div className={`text-lg font-bold ${projectedProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
                {currencyFormatter.format(projectedProfit)}
              </div>
              <div className="text-[10px] text-muted-foreground">Net Profit</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <OwnedClubDjRoster club={club} />
      <OwnedClubThemeNights club={club} />

      {/* Club Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Settings className="h-5 w-5 text-primary" /> Club Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{club.club_name}</p>
              <p className="text-xs text-muted-foreground">
                {QUALITY_LABELS[club.quality_level]} • Capacity {club.capacity} • Rep {club.reputation_score}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {club.verified_purchase_id
                  ? "Verified purchase · eligible for future club-owner DJ controls"
                  : "Legacy ownership record · purchase not yet verified for DJ-owner privileges"}
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => updateClub.mutate({ clubId: club.id, updates: { is_open: !club.is_open } })}
            >
              {club.is_open ? (
                <><ToggleRight className="h-4 w-4 mr-1 text-green-400" /> Open</>
              ) : (
                <><ToggleLeft className="h-4 w-4 mr-1 text-muted-foreground" /> Closed</>
              )}
            </Button>
          </div>

          <NightclubPricingFields club={club} />
        </CardContent>
      </Card>

      {/* Staff */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-primary" /> Staff ({staff.length}/{staffCap})
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => setShowHire(true)} disabled={staff.length >= staffCap}>
              <Plus className="h-3 w-3 mr-1" /> Hire
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {staff.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No staff hired yet. Hire some to boost revenue!</p>
          ) : (
            <div className="space-y-2">
              {staff.map((s) => (
                <StaffRow key={s.id} staff={s} ownedClubId={club.id} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <HireStaffDialog open={showHire} onOpenChange={setShowHire} ownedClubId={club.id} />
      {staff.length >= staffCap && <p className="text-xs text-muted-foreground">This club has reached its staffing limit. Dismiss an employee before hiring another.</p>}
    </div>
  );
};

// Edit drafts locally, then commit on blur: never charge/write on every keystroke.
const NightclubPricingFields = ({ club }: { club: OwnedNightclub }) => {
  const updateClub = useUpdateOwnedClub();
  const [cover, setCover] = useState(String(club.cover_charge));
  const [markup, setMarkup] = useState(String(club.drink_markup_pct));
  const submit = (kind: "cover" | "markup") => {
    const raw = kind === "cover" ? cover : markup;
    const value = Number(raw);
    const min = 0;
    const max = kind === "cover" ? 500 : 200;
    if (!raw.trim() || !Number.isInteger(value) || value < min || value > max) {
      toast.error(kind === "cover" ? "Cover must be a whole dollar amount from 0 to 500" :
        "Drink markup must be a whole percentage from 0 to 200");
      if (kind === "cover") setCover(String(club.cover_charge));
      else setMarkup(String(club.drink_markup_pct));
      return;
    }
    if (value === (kind === "cover" ? club.cover_charge : club.drink_markup_pct)) return;
    updateClub.mutate({ clubId: club.id, updates: kind === "cover"
      ? { cover_charge: value } : { drink_markup_pct: value } });
  };
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label htmlFor={`nightclub-cover-${club.id}`} className="text-xs text-muted-foreground">Cover Charge ($)</label>
        <Input id={`nightclub-cover-${club.id}`} type="number" min={0} max={500} step={1}
          value={cover} onChange={(event) => setCover(event.target.value)}
          onBlur={() => submit("cover")}
          onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
          disabled={updateClub.isPending} className="h-8 text-sm" />
      </div>
      <div>
        <label htmlFor={`nightclub-markup-${club.id}`} className="text-xs text-muted-foreground">Drink Markup (%)</label>
        <Input id={`nightclub-markup-${club.id}`} type="number" min={0} max={200} step={1}
          value={markup} onChange={(event) => setMarkup(event.target.value)}
          onBlur={() => submit("markup")}
          onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
          disabled={updateClub.isPending} className="h-8 text-sm" />
      </div>
      <p className="col-span-2 text-xs text-muted-foreground">
        Changes save when you leave a field; prices and markup are validated by the server.
      </p>
    </div>
  );
};

const StaffRow = ({ staff, ownedClubId }: { staff: NightclubStaff; ownedClubId: string }) => {
  const fireStaff = useFireStaff();

  return (
    <div className="flex items-center justify-between rounded-lg border border-border/60 p-2.5">
      <div className="flex items-center gap-2 min-w-0">
        <Badge variant="outline" className="text-[10px] shrink-0">{STAFF_LABELS[staff.staff_type] ?? staff.staff_type}</Badge>
        <span className="text-sm font-medium truncate">{staff.name}</span>
        <span className="text-xs text-muted-foreground">Skill {staff.skill_level}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">${staff.salary_weekly}/wk</span>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 text-destructive"
          onClick={() => fireStaff.mutate({ ownedClubId, staffId: staff.id })}
          disabled={fireStaff.isPending}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
};

const HireStaffDialog = ({ open, onOpenChange, ownedClubId }: { open: boolean; onOpenChange: (open: boolean) => void; ownedClubId: string }) => {
  const hireStaff = useHireStaff();
  const [staffType, setStaffType] = useState("bartender");
  const [name, setName] = useState("");
  const [skillLevel, setSkillLevel] = useState(1);

  const salary = Math.round(getStaffBaseSalary(staffType) * (1 + (skillLevel - 1) * 0.25));

  const handleHire = () => {
    if (!name.trim()) return;
    hireStaff.mutate(
      { ownedClubId, staffType, name: name.trim(), skillLevel },
      { onSuccess: () => { setName(""); onOpenChange(false); } }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Hire Staff</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Role</label>
            <Select value={staffType} onValueChange={setStaffType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {getStaffTypes().map((t) => (
                  <SelectItem key={t} value={t}>{STAFF_LABELS[t] ?? t} (${getStaffBaseSalary(t)}/wk base)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter staff name" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Skill Level (1-5)</label>
            <Select value={String(skillLevel)} onValueChange={(v) => setSkillLevel(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((l) => (
                  <SelectItem key={l} value={String(l)}>Level {l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="text-sm text-muted-foreground">
            Weekly salary: <span className="font-medium text-foreground">${salary}</span>
          </div>
          <Button className="w-full" onClick={handleHire} disabled={name.trim().length < 2 || hireStaff.isPending}>
            {hireStaff.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Hire {STAFF_LABELS[staffType]}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NightclubManagement;
