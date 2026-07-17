import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle, ExternalLink, XCircle } from "lucide-react";
import { AdminFestivalCatalogue } from "@/features/festivals/admin/components/AdminFestivalCatalogue";
import { FestivalStageManagement } from "@/features/festivals/admin/components/FestivalStageManagement";
import { FestivalStaffManagement } from "@/features/festivals/admin/components/FestivalStaffManagement";
import { FestivalPermitManagement } from "@/features/festivals/admin/components/FestivalPermitManagement";
import { FestivalInsuranceManagement } from "@/features/festivals/admin/components/FestivalInsuranceManagement";
import { FestivalOutcomesManagement } from "@/features/festivals/admin/components/FestivalOutcomesManagement";
import { FestivalSettlementManagement } from "@/features/festivals/admin/components/FestivalSettlementManagement";
import { FestivalDataHealthManagement } from "@/features/festivals/admin/components/FestivalDataHealthManagement";
import { FestivalLegacyRecordsManagement } from "@/features/festivals/admin/components/FestivalLegacyRecordsManagement";
import { FestivalAuditLog } from "@/features/festivals/admin/components/FestivalAuditLog";
import { useAdminFestivalCatalogue, useOwnerFestivalEditions } from "@/features/festivals/admin/hooks";
import type { AdminFestivalCatalogueRow, OwnerEditionOption } from "@/features/festivals/admin/types";
import { useFestivalSlotApplications } from "@/hooks/useFestivalSlotApplications";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

export function selectPreferredFestivalEdition(editions: OwnerEditionOption[]) {
  const ranked = [
    (e: OwnerEditionOption) => e.status === "live",
    (e: OwnerEditionOption) => ["applications_open", "booking", "announced", "on_sale", "setup", "planning", "concept"].includes(e.status),
    (e: OwnerEditionOption) => e.status === "completed",
    () => true,
  ];
  for (const match of ranked) {
    const candidates = editions.filter(match).sort((a, b) => String(b.endAt ?? b.startAt ?? "").localeCompare(String(a.endAt ?? a.startAt ?? "")));
    if (candidates[0]) return candidates[0];
  }
  return undefined;
}

function EditionRequired({ editionId, children }: { editionId?: string; children: React.ReactNode }) {
  if (editionId) return <>{children}</>;
  return <Card><CardHeader><CardTitle>Festival operations are unavailable until an edition is selected.</CardTitle></CardHeader><CardContent className="space-y-3 text-sm text-muted-foreground"><p>Select a festival edition above before loading edition-specific tools.</p><Button disabled>Create first edition</Button></CardContent></Card>;
}

function FestivalEditionSelector({ rows, selectedFestivalId, setSelectedFestivalId, selectedEditionId, setSelectedEditionId }: { rows: AdminFestivalCatalogueRow[]; selectedFestivalId?: string; setSelectedFestivalId: (id: string) => void; selectedEditionId?: string; setSelectedEditionId: (id: string) => void }) {
  const editionsQuery = useOwnerFestivalEditions(selectedFestivalId);
  const editions = editionsQuery.data ?? [];
  useEffect(() => {
    if (!selectedFestivalId && rows[0]) setSelectedFestivalId(rows[0].festivalId);
  }, [rows, selectedFestivalId, setSelectedFestivalId]);
  useEffect(() => {
    if (!selectedFestivalId) return;
    if (editions.length === 0) { setSelectedEditionId(""); return; }
    if (!editions.some((edition) => edition.id === selectedEditionId)) setSelectedEditionId(selectPreferredFestivalEdition(editions)?.id ?? "");
  }, [editions, selectedFestivalId, selectedEditionId, setSelectedEditionId]);

  return <Card><CardHeader><CardTitle>Festival and edition selection</CardTitle><CardDescription>Choose the festival workspace. The most relevant edition is selected automatically when possible.</CardDescription></CardHeader><CardContent className="grid gap-4 md:grid-cols-2"><div><Label>Festival</Label><Select value={selectedFestivalId} onValueChange={setSelectedFestivalId}><SelectTrigger><SelectValue placeholder="Select a festival" /></SelectTrigger><SelectContent>{rows.map((row) => <SelectItem key={row.festivalId} value={row.festivalId}>{row.brandName}</SelectItem>)}</SelectContent></Select></div><div><Label>Festival edition</Label><Select value={selectedEditionId} onValueChange={setSelectedEditionId} disabled={editionsQuery.isLoading || editions.length === 0}><SelectTrigger><SelectValue placeholder={editions.length ? "Select an edition" : "No edition available"} /></SelectTrigger><SelectContent>{editions.map((edition) => <SelectItem key={edition.id} value={edition.id}>{edition.title} · {edition.status}</SelectItem>)}</SelectContent></Select>{editionsQuery.isLoading && <p className="mt-2 text-sm text-muted-foreground">Loading festival editions…</p>}{editionsQuery.error && <p className="mt-2 text-sm text-destructive">Festival editions could not be loaded.</p>}{!editionsQuery.isLoading && editions.length === 0 && <p className="mt-2 text-sm text-muted-foreground">No edition has been created for this festival.</p>}</div></CardContent></Card>;
}

function Overview({ selectedFestival, selectedEdition }: { selectedFestival?: AdminFestivalCatalogueRow; selectedEdition?: OwnerEditionOption }) {
  if (!selectedFestival) return <Card><CardContent className="p-6 text-muted-foreground">No festivals have been created yet.</CardContent></Card>;
  return <div className="space-y-4"><AdminFestivalCatalogue /><Card><CardHeader><CardTitle>Selected festival summary</CardTitle><CardDescription>Lifecycle controls are shown after a valid festival edition is selected.</CardDescription></CardHeader><CardContent className="grid gap-3 md:grid-cols-4"><p><span className="text-muted-foreground">Festival</span><br /><b>{selectedFestival.brandName}</b></p><p><span className="text-muted-foreground">City</span><br /><b>{selectedFestival.cityName ?? "Not set"}</b></p><p><span className="text-muted-foreground">Lifecycle</span><br /><b>{selectedEdition?.status ?? selectedFestival.lifecycleState ?? "No edition"}</b></p><p><span className="text-muted-foreground">Dates</span><br /><b>{selectedEdition?.startAt ?? "Not scheduled"} → {selectedEdition?.endAt ?? "Not scheduled"}</b></p><p><span className="text-muted-foreground">Stages</span><br /><b>{selectedFestival.stageCount}</b></p><p><span className="text-muted-foreground">Confirmed bands</span><br /><b>{selectedFestival.activeContractCount}</b></p><p><span className="text-muted-foreground">System check warnings</span><br /><b>{selectedFestival.dataHealthWarnings.length}</b></p><p><span className="text-muted-foreground">Edition</span><br /><b>{selectedEdition?.title ?? "No edition has been created for this festival."}</b></p></CardContent></Card></div>;
}

function Applications({ festivalId }: { festivalId?: string }) {
  const [selectedApplication, setSelectedApplication] = useState<any>(null); const [adminNotes, setAdminNotes] = useState(""); const [offeredPayment, setOfferedPayment] = useState("");
  const { applications, isLoading, reviewApplication, isReviewing } = useFestivalSlotApplications(festivalId);
  const pending = applications?.filter((a) => a.status === "pending") ?? []; const reviewed = applications?.filter((a) => a.status !== "pending") ?? [];
  const submit = (status: "accepted" | "rejected") => { if (!selectedApplication) return; reviewApplication({ applicationId: selectedApplication.id, status, adminNotes: adminNotes || undefined, offeredPayment: offeredPayment ? Number(offeredPayment) : undefined }); setSelectedApplication(null); setAdminNotes(""); setOfferedPayment(""); };
  if (!festivalId) return <Card><CardContent className="p-6 text-muted-foreground">Select a festival before reviewing applications.</CardContent></Card>;
  if (isLoading) return <Card><CardContent className="p-6">Loading festival applications…</CardContent></Card>;
  return <div className="space-y-4"><Card><CardHeader><CardTitle>Pending applications</CardTitle><CardDescription>Review offered payment and add admin notes before accepting or rejecting.</CardDescription></CardHeader><CardContent className="space-y-3">{pending.length === 0 ? <p className="text-muted-foreground">No pending applications.</p> : pending.map((app) => <div key={app.id} className="flex flex-wrap items-center justify-between gap-3 rounded border p-3"><div><b>{app.band?.name ?? "Unknown band"}</b><p className="text-sm text-muted-foreground">{app.festival?.name ?? "Selected festival"} · {app.slot_type}</p></div><Button size="sm" onClick={() => setSelectedApplication(app)}>Review</Button></div>)}</CardContent></Card><Card><CardHeader><CardTitle>Reviewed application history</CardTitle></CardHeader><CardContent>{reviewed.length === 0 ? <p className="text-muted-foreground">No reviewed applications.</p> : reviewed.map((app) => <p key={app.id} className="flex justify-between border-b py-2"><span>{app.band?.name ?? "Unknown band"}</span><Badge>{app.status}</Badge></p>)}</CardContent></Card><Dialog open={!!selectedApplication} onOpenChange={(open) => !open && setSelectedApplication(null)}><DialogContent><DialogHeader><DialogTitle>Review application</DialogTitle></DialogHeader><Label>Offered payment<Input type="number" value={offeredPayment} onChange={(e) => setOfferedPayment(e.target.value)} /></Label><Label>Admin notes<Textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} /></Label><div className="flex gap-2"><Button disabled={isReviewing} onClick={() => submit("accepted")}><CheckCircle className="mr-2 h-4 w-4" />Accept</Button><Button disabled={isReviewing} variant="destructive" onClick={() => submit("rejected")}><XCircle className="mr-2 h-4 w-4" />Reject</Button></div></DialogContent></Dialog></div>;
}

export default function FestivalsAdminPage() {
  const catalogue = useAdminFestivalCatalogue(); const rows = catalogue.data ?? [];
  const [selectedFestivalId, setSelectedFestivalId] = useState(""); const [selectedEditionId, setSelectedEditionId] = useState("");
  const editionsQuery = useOwnerFestivalEditions(selectedFestivalId); const selectedFestival = rows.find((row) => row.festivalId === selectedFestivalId); const selectedEdition = editionsQuery.data?.find((edition) => edition.id === selectedEditionId);
  return <div className="space-y-6"><div><h1 className="text-3xl font-oswald">Festivals Administration</h1><p className="text-muted-foreground">Manage festivals, applications, operations, results and technical support tools from one workspace.</p></div>{catalogue.isLoading && <Card><CardContent className="p-6">Loading festivals…</CardContent></Card>}{catalogue.error && <Card><CardContent className="p-6 text-destructive">Festivals could not be loaded. You may not have permission to manage festivals.</CardContent></Card>}{!catalogue.isLoading && !catalogue.error && <FestivalEditionSelector rows={rows} selectedFestivalId={selectedFestivalId} setSelectedFestivalId={setSelectedFestivalId} selectedEditionId={selectedEditionId} setSelectedEditionId={setSelectedEditionId} />}<Tabs defaultValue="overview" className="space-y-4"><TabsList className="flex h-auto flex-wrap"><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="applications">Applications</TabsTrigger><TabsTrigger value="operations">Operations</TabsTrigger><TabsTrigger value="results">Results</TabsTrigger><TabsTrigger value="advanced">Advanced</TabsTrigger></TabsList><TabsContent value="overview"><Overview selectedFestival={selectedFestival} selectedEdition={selectedEdition} /></TabsContent><TabsContent value="applications"><Applications festivalId={selectedFestivalId} /></TabsContent><TabsContent value="operations"><EditionRequired editionId={selectedEditionId}><Tabs defaultValue="stages"><TabsList className="flex h-auto flex-wrap"><TabsTrigger value="stages">Stages</TabsTrigger><TabsTrigger value="staff">Staff</TabsTrigger><TabsTrigger value="permits">Permits</TabsTrigger><TabsTrigger value="insurance">Insurance</TabsTrigger><TabsTrigger value="live">Live event</TabsTrigger></TabsList><TabsContent value="stages"><FestivalStageManagement editionId={selectedEditionId} scope="admin" /></TabsContent><TabsContent value="staff"><FestivalStaffManagement editionId={selectedEditionId} scope="admin" /></TabsContent><TabsContent value="permits"><FestivalPermitManagement editionId={selectedEditionId} scope="admin" /></TabsContent><TabsContent value="insurance"><FestivalInsuranceManagement editionId={selectedEditionId} scope="admin" /></TabsContent><TabsContent value="live"><FestivalOutcomesManagement editionId={selectedEditionId} scope="admin" /></TabsContent></Tabs></EditionRequired></TabsContent><TabsContent value="results"><EditionRequired editionId={selectedEditionId}><FestivalOutcomesManagement editionId={selectedEditionId} scope="admin" /><FestivalSettlementManagement editionId={selectedEditionId} /></EditionRequired></TabsContent><TabsContent value="advanced"><Card><CardHeader><CardTitle>Advanced technical support tools</CardTitle><CardDescription>These tools are for migration support, system checks and audit review. They are not required for normal festival management.</CardDescription></CardHeader><CardContent><Button asChild variant="outline"><Link to="/admin/festivals#system-checks"><ExternalLink className="mr-2 h-4 w-4" />System checks</Link></Button></CardContent></Card><FestivalLegacyRecordsManagement /><FestivalDataHealthManagement /><FestivalAuditLog /></TabsContent></Tabs></div>;
}
