import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Loader2,
  DollarSign,
  ShieldCheck,
  Users,
  FileText,
  TrendingUp,
  Ticket,
  Megaphone,
  Trophy,
  Store,
} from "lucide-react";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { listFestivalEditionsForOwner } from "@/features/festivals/service";
import {
  getFestivalEditionStatusLabel,
  selectManagedFestivalEdition,
} from "@/features/festivals/lifecycle";

const money = (cents: number | null | undefined) => {
  const c = Number(cents ?? 0);
  return `$${(c / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
};

const STAFF_ROLES = [
  { value: "promoter", label: "Promoter", wage: 250000 },
  { value: "booker", label: "Talent Booker", wage: 320000 },
  { value: "safety_officer", label: "Safety Officer", wage: 180000 },
  { value: "medic", label: "Medic", wage: 220000 },
  { value: "sound_engineer", label: "Sound Engineer", wage: 280000 },
  { value: "stage_manager", label: "Stage Manager", wage: 260000 },
  { value: "marketing_lead", label: "Marketing Lead", wage: 300000 },
];

export default function FestivalOwnerConsole() {
  const { festivalId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { profileId } = useActiveProfile();
  const [tab, setTab] = useState("overview");

  const { data: festival, isLoading } = useQuery({
    queryKey: ["festival-owner", festivalId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("festivals")
        .select("*, city:cities(id,name,country)")
        .eq("id", festivalId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!festivalId,
  });

  const isOwner =
    festival && profileId && festival.owner_profile_id === profileId;

  const { data: editions = [] } = useQuery({
    queryKey: ["festival-editions", festivalId],
    queryFn: () => listFestivalEditionsForOwner(festivalId!),
    enabled: !!festivalId,
  });
  const currentEdition = selectManagedFestivalEdition(editions);

  const { data: staff = [] } = useQuery({
    queryKey: ["festival-staff", festivalId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("festival_staff")
        .select("*")
        .eq("festival_id", festivalId)
        .is("terminated_at", null);
      return data || [];
    },
    enabled: !!festivalId,
  });

  const { data: permits = [] } = useQuery({
    queryKey: ["festival-permits", festivalId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("festival_permits")
        .select("*")
        .eq("festival_id", festivalId);
      return data || [];
    },
    enabled: !!festivalId,
  });

  const { data: insurance = [] } = useQuery({
    queryKey: ["festival-insurance", festivalId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("festival_insurance_policies")
        .select("*")
        .eq("festival_id", festivalId)
        .eq("active", true);
      return data || [];
    },
    enabled: !!festivalId,
  });

  const { data: ledger = [] } = useQuery({
    queryKey: ["festival-ledger", festivalId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("festival_expense_ledger")
        .select("*")
        .eq("festival_id", festivalId)
        .order("posted_at", { ascending: false })
        .limit(100);
      return data || [];
    },
    enabled: !!festivalId,
  });

  const { data: stages = [] } = useQuery({
    queryKey: ["festival-stages", festivalId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("festival_stages")
        .select(
          "*, slots:festival_stage_slots(id, day_number, slot_number, band_id, status, payout_amount)",
        )
        .eq("festival_id", festivalId);
      return data || [];
    },
    enabled: !!festivalId,
  });

  const hireStaff = useMutation({
    mutationFn: async (role: string) => {
      const cfg = STAFF_ROLES.find((r) => r.value === role)!;
      const { error } = await (supabase as any).from("festival_staff").insert({
        festival_id: festivalId,
        role,
        name: `${cfg.label} ${Math.floor(Math.random() * 900 + 100)}`,
        skill_level: 50 + Math.floor(Math.random() * 30),
        weekly_wage_cents: cfg.wage,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Staff hired");
      qc.invalidateQueries({ queryKey: ["festival-staff", festivalId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const fireStaff = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("festival_staff")
        .update({ terminated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Staff terminated");
      qc.invalidateQueries({ queryKey: ["festival-staff", festivalId] });
    },
  });

  const buyInsurance = useMutation({
    mutationFn: async (coverage: string) => {
      const premiums: Record<string, number> = {
        basic: 500000,
        standard: 1200000,
        premium: 3000000,
        all_risk: 6000000,
      };
      const ceilings: Record<string, number> = {
        basic: 2000000,
        standard: 8000000,
        premium: 25000000,
        all_risk: 100000000,
      };
      const { error } = await (supabase as any)
        .from("festival_insurance_policies")
        .insert({
          festival_id: festivalId,
          coverage_type: coverage,
          premium_cents: premiums[coverage],
          payout_ceiling_cents: ceilings[coverage],
          weather_rider: coverage === "premium" || coverage === "all_risk",
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Insurance policy activated");
      qc.invalidateQueries({ queryKey: ["festival-insurance", festivalId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const applyPermit = useMutation({
    mutationFn: async (permit_type: string) => {
      const fees: Record<string, number> = {
        event: 150000,
        noise: 40000,
        alcohol: 90000,
        safety: 60000,
      };
      const { error } = await (supabase as any)
        .from("festival_permits")
        .insert({
          festival_id: festivalId,
          city_id: festival?.city_id,
          permit_type,
          permit_fee_cents: fees[permit_type],
          status: "pending",
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Permit application filed");
      qc.invalidateQueries({ queryKey: ["festival-permits", festivalId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const [listPrice, setListPrice] = useState("");
  const [listNotes, setListNotes] = useState("");
  const listForSale = useMutation({
    mutationFn: async () => {
      const cents = Math.round(parseFloat(listPrice || "0") * 100);
      if (cents <= 0) throw new Error("Enter a valid price");
      const { error } = await (supabase as any).rpc("list_festival_for_sale", {
        p_festival_id: festivalId,
        p_price_cents: cents,
        p_notes: listNotes,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Festival listed for sale");
      setListPrice("");
      setListNotes("");
      qc.invalidateQueries({ queryKey: ["festival-owner", festivalId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!festival) {
    return (
      <div className="p-8 text-center">
        Festival not found.{" "}
        <Button variant="link" onClick={() => navigate("/festivals")}>
          Back to browser
        </Button>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <FMPageScaffold title={festival.name} subtitle="Owner-only console">
        <Card>
          <CardContent className="pt-6 text-center space-y-4">
            <p>
              You are not the owner of this festival. Only the owner (or an
              admin) can manage operations.
            </p>
            <Button asChild variant="outline">
              <Link to={`/festivals/${festivalId}`}>View public page</Link>
            </Button>
          </CardContent>
        </Card>
      </FMPageScaffold>
    );
  }

  const totalIncome = ledger
    .filter((l: any) => l.direction === "income")
    .reduce((s: number, l: any) => s + Number(l.amount_cents), 0);
  const totalExpense = ledger
    .filter((l: any) => l.direction === "expense")
    .reduce((s: number, l: any) => s + Number(l.amount_cents), 0);
  const netEdition = totalIncome - totalExpense;
  const totalStaffWages = staff.reduce(
    (s: number, m: any) => s + Number(m.weekly_wage_cents || 0),
    0,
  );
  const activeInsurance = insurance[0];
  const approvedPermits = permits.filter(
    (p: any) => p.status === "approved",
  ).length;

  return (
    <FMPageScaffold
      title={festival.name}
      subtitle={`${festival.city?.name ?? ""} · Prestige ${festival.prestige_tier}/5 · Brand edition seed #${festival.edition_number}`}
      headerActions={
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/festivals/${festivalId}`)}
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Public page
        </Button>
      }
    >
      <Card className="mb-4 border-primary/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Canonical edition</CardTitle>
          <CardDescription>
            Lifecycle is edition-scoped; marketplace ownership remains attached
            to the festival brand.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3 text-sm">
          {currentEdition ? (
            <>
              <Badge variant="outline">
                Edition #{currentEdition.edition_number}
              </Badge>
              <span>{currentEdition.title ?? festival.name}</span>
              <Badge>
                {getFestivalEditionStatusLabel(currentEdition.status)}
              </Badge>
              {currentEdition.start_at && (
                <span className="text-muted-foreground">
                  Starts{" "}
                  {new Date(currentEdition.start_at).toLocaleDateString()}
                </span>
              )}
            </>
          ) : (
            <>
              <span className="text-amber-500">
                No canonical edition found for this brand yet.
              </span>
              <Button size="sm" variant="outline" asChild>
                <Link to={`/festivals/${festivalId}/run`}>
                  Create or resolve edition
                </Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatCard
          icon={<DollarSign className="h-4 w-4" />}
          label="Treasury"
          value={money(festival.treasury_cents)}
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Edition Net"
          value={money(netEdition)}
          tone={netEdition >= 0 ? "positive" : "negative"}
        />
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label="Staff"
          value={String(staff.length)}
          sub={`${money(totalStaffWages)}/wk`}
        />
        <StatCard
          icon={<ShieldCheck className="h-4 w-4" />}
          label="Coverage"
          value={activeInsurance?.coverage_type ?? "None"}
          sub={`${approvedPermits} permits`}
        />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="booking">Booking</TabsTrigger>
          <TabsTrigger value="stages">Stages</TabsTrigger>
          <TabsTrigger value="tickets">Tickets</TabsTrigger>
          <TabsTrigger value="sponsors">Sponsors</TabsTrigger>
          <TabsTrigger value="staff">Staff</TabsTrigger>
          <TabsTrigger value="insurance">Insurance & Permits</TabsTrigger>
          <TabsTrigger value="finances">Finances</TabsTrigger>
          <TabsTrigger value="marketing">Marketing</TabsTrigger>
          <TabsTrigger value="sell">Sell</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>Edition Checklist</CardTitle>
              <CardDescription>
                Temporary compatibility checks still read brand-level staff,
                permits and insurance until those tables are re-keyed to
                editions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <ChecklistRow
                ok={approvedPermits > 0}
                label="At least one approved permit"
              />
              <ChecklistRow
                ok={!!activeInsurance}
                label="Active insurance policy"
              />
              <ChecklistRow
                ok={staff.length >= 3}
                label="Minimum 3 crew hired"
              />
              <ChecklistRow
                ok={stages.length > 0}
                label="At least one stage configured"
              />
              <ChecklistRow
                ok={stages.some((s: any) =>
                  (s.slots || []).some((sl: any) => sl.band_id),
                )}
                label="At least one band booked"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="booking">
          <Card>
            <CardHeader>
              <CardTitle>Slot Bookings</CardTitle>
              <CardDescription>Manage stage slots and offers</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {stages.length === 0
                ? "Configure a stage first, then invite bands or open slots to applications."
                : stages.map((s: any) => (
                    <div key={s.id} className="mb-3 p-3 border rounded">
                      <div className="font-semibold">{s.stage_name}</div>
                      <div className="text-xs">
                        {(s.slots || []).length} slots ·{" "}
                        {(s.slots || []).filter((sl: any) => sl.band_id).length}{" "}
                        booked
                      </div>
                    </div>
                  ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stages">
          <Card>
            <CardHeader>
              <CardTitle>Stages & Production</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {stages.length === 0 ? (
                <p className="text-muted-foreground">
                  No stages yet. Add one from the admin panel.
                </p>
              ) : (
                <ul className="space-y-2">
                  {stages.map((s: any) => (
                    <li
                      key={s.id}
                      className="flex justify-between border-b pb-1"
                    >
                      <span>{s.stage_name}</span>
                      <span className="text-muted-foreground">
                        Cap {s.capacity} · {s.genre_focus ?? "mixed"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tickets">
          <Card>
            <CardHeader>
              <CardTitle>Ticket Pricing</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <Label>Low tier</Label>
                <div>{money(currentEdition?.minimum_ticket_price_cents)}</div>
              </div>
              <div>
                <Label>High tier / VIP</Label>
                <div>{money(currentEdition?.maximum_ticket_price_cents)}</div>
              </div>
              <div>
                <Label>Expected attendance</Label>
                <div>
                  {(
                    currentEdition?.expected_attendance ??
                    currentEdition?.capacity
                  )?.toLocaleString()}
                </div>
              </div>
              <div>
                <Label>Runs</Label>
                <div>
                  {festival.start_date} → {festival.end_date}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sponsors">
          <Card>
            <CardHeader>
              <CardTitle>Sponsorship Deals</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Solicit sponsor offers from brand partners. Approach the
              sponsorship marketplace to send RFPs and negotiate placement
              tiers.
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="staff">
          <Card>
            <CardHeader>
              <CardTitle>Crew Roster</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-3">
                {STAFF_ROLES.map((r) => (
                  <Button
                    key={r.value}
                    size="sm"
                    variant="outline"
                    disabled={hireStaff.isPending}
                    onClick={() => hireStaff.mutate(r.value)}
                  >
                    + {r.label} ({money(r.wage)}/wk)
                  </Button>
                ))}
              </div>
              <ul className="text-sm divide-y">
                {staff.map((m: any) => (
                  <li
                    key={m.id}
                    className="py-2 flex justify-between items-center"
                  >
                    <div>
                      <div className="font-semibold">{m.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {m.role} · skill {m.skill_level} · morale {m.morale}%
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>{money(m.weekly_wage_cents)}/wk</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => fireStaff.mutate(m.id)}
                      >
                        Fire
                      </Button>
                    </div>
                  </li>
                ))}
                {staff.length === 0 && (
                  <li className="py-4 text-muted-foreground text-center">
                    No staff hired yet.
                  </li>
                )}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insurance">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Insurance</CardTitle>
              </CardHeader>
              <CardContent>
                {activeInsurance ? (
                  <div className="text-sm space-y-1">
                    <Badge>{activeInsurance.coverage_type}</Badge>
                    <div>Premium: {money(activeInsurance.premium_cents)}</div>
                    <div>
                      Ceiling: {money(activeInsurance.payout_ceiling_cents)}
                    </div>
                    <div>
                      Weather rider:{" "}
                      {activeInsurance.weather_rider ? "Yes" : "No"}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {["basic", "standard", "premium", "all_risk"].map((c) => (
                      <Button
                        key={c}
                        variant="outline"
                        size="sm"
                        className="mr-2"
                        onClick={() => buyInsurance.mutate(c)}
                      >
                        Buy {c}
                      </Button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Permits</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 mb-3">
                  {["event", "noise", "alcohol", "safety"].map((t) => (
                    <Button
                      key={t}
                      size="sm"
                      variant="outline"
                      onClick={() => applyPermit.mutate(t)}
                    >
                      Apply {t}
                    </Button>
                  ))}
                </div>
                <ul className="text-sm">
                  {permits.map((p: any) => (
                    <li key={p.id} className="flex justify-between py-1">
                      <span>{p.permit_type}</span>
                      <Badge
                        variant={
                          p.status === "approved" ? "default" : "secondary"
                        }
                      >
                        {p.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="finances">
          <Card>
            <CardHeader>
              <CardTitle>
                Ledger —{" "}
                {currentEdition
                  ? `Canonical edition #${currentEdition.edition_number}`
                  : `Legacy edition #${festival.edition_number}`}
              </CardTitle>
              <CardDescription>
                Income {money(totalIncome)} · Expense {money(totalExpense)} ·
                Net {money(netEdition)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-y-auto text-xs divide-y">
                {ledger.map((l: any) => (
                  <div key={l.id} className="py-1.5 flex justify-between">
                    <div>
                      <span className="text-muted-foreground mr-2">
                        {new Date(l.posted_at).toLocaleDateString()}
                      </span>
                      {l.category}
                      {l.description ? ` — ${l.description}` : ""}
                    </div>
                    <div
                      className={
                        l.direction === "income"
                          ? "text-emerald-500"
                          : "text-red-500"
                      }
                    >
                      {l.direction === "income" ? "+" : "-"}
                      {money(l.amount_cents)}
                    </div>
                  </div>
                ))}
                {ledger.length === 0 && (
                  <div className="py-4 text-center text-muted-foreground">
                    No entries yet.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="marketing">
          <Card>
            <CardHeader>
              <CardTitle>Marketing Campaigns</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Buy radio, press and social campaigns to raise attendance
              forecasts. Head over to{" "}
              <Link to="/media/pr" className="underline">
                PR Hub
              </Link>{" "}
              to launch a festival-tagged campaign.
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sell">
          <Card>
            <CardHeader>
              <CardTitle>List Festival For Sale</CardTitle>
              <CardDescription>
                Cash out to another player. Current status:{" "}
                <Badge>{festival.sale_status}</Badge>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 max-w-md">
              <div>
                <Label>Asking price ($)</Label>
                <Input
                  type="number"
                  value={listPrice}
                  onChange={(e) => setListPrice(e.target.value)}
                />
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea
                  value={listNotes}
                  onChange={(e) => setListNotes(e.target.value)}
                />
              </div>
              <Button
                onClick={() => listForSale.mutate()}
                disabled={listForSale.isPending}
              >
                List for sale
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </FMPageScaffold>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: "positive" | "negative";
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
        <div
          className={`text-lg font-bold ${tone === "positive" ? "text-emerald-500" : tone === "negative" ? "text-red-500" : ""}`}
        >
          {value}
        </div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function ChecklistRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div
      className={`flex items-center gap-2 ${ok ? "text-emerald-500" : "text-amber-500"}`}
    >
      <span>{ok ? "✓" : "○"}</span>
      <span className="text-foreground">{label}</span>
    </div>
  );
}
