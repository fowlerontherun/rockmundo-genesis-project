import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle, ExternalLink, XCircle } from "lucide-react";
import { AdminFestivalCatalogue } from "@/features/festivals/admin/components/AdminFestivalCatalogue";
import { FestivalStageManagement } from "@/features/festivals/admin/components/FestivalStageManagement";
import { FestivalScheduleWorkspace } from "@/features/festivals/scheduling/components/FestivalScheduleWorkspace";
import { FestivalStaffManagement } from "@/features/festivals/admin/components/FestivalStaffManagement";
import { FestivalPermitManagement } from "@/features/festivals/admin/components/FestivalPermitManagement";
import { FestivalInsuranceManagement } from "@/features/festivals/admin/components/FestivalInsuranceManagement";
import { FestivalOutcomesManagement } from "@/features/festivals/admin/components/FestivalOutcomesManagement";
import { FestivalSettlementManagement } from "@/features/festivals/admin/components/FestivalSettlementManagement";
import { FestivalDataHealthManagement } from "@/features/festivals/admin/components/FestivalDataHealthManagement";
import { FestivalLegacyRecordsManagement } from "@/features/festivals/admin/components/FestivalLegacyRecordsManagement";
import { FestivalLifecycleControls } from "@/features/festivals/admin/components/FestivalLifecycleControls";
import { FestivalCreationWizard } from "@/features/festivals/admin/components/FestivalCreationWizard";
import { FestivalAuditLog } from "@/features/festivals/admin/components/FestivalAuditLog";
import { selectPreferredFestivalEdition } from "@/features/festivals/admin/components/workspace/selectPreferredFestivalEdition";
import {
  useAdminFestivalCatalogue,
  useOwnerFestivalEditions,
} from "@/features/festivals/admin/hooks";
import type {
  AdminFestivalCatalogueRow,
  OwnerEditionOption,
} from "@/features/festivals/admin/types";
import { useFestivalSlotApplications } from "@/hooks/useFestivalSlotApplications";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

function EditionRequired({
  editionId,
  children,
  onCreateFirstEdition,
}: {
  editionId?: string;
  children: React.ReactNode;
  onCreateFirstEdition?: () => void;
}) {
  if (editionId) return <>{children}</>;
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Festival operations are unavailable until an edition is selected.
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <p>
          Select or create a festival edition before loading edition-specific
          tools.
        </p>
        <Button onClick={onCreateFirstEdition}>Create first edition</Button>
      </CardContent>
    </Card>
  );
}

function FestivalEditionSelector({
  rows,
  selectedFestivalId,
  setSelectedFestivalId,
  selectedEditionId,
  setSelectedEditionId,
}: {
  rows: AdminFestivalCatalogueRow[];
  selectedFestivalId?: string;
  setSelectedFestivalId: (id: string) => void;
  selectedEditionId?: string;
  setSelectedEditionId: (id: string) => void;
}) {
  const editionsQuery = useOwnerFestivalEditions(selectedFestivalId);
  const editions = editionsQuery.data ?? [];
  useEffect(() => {
    if (!selectedFestivalId && rows[0])
      setSelectedFestivalId(rows[0].festivalId);
  }, [rows, selectedFestivalId, setSelectedFestivalId]);
  useEffect(() => {
    if (!selectedFestivalId) return;
    if (editions.length === 0) {
      setSelectedEditionId("");
      return;
    }
    if (!editions.some((edition) => edition.id === selectedEditionId))
      setSelectedEditionId(selectPreferredFestivalEdition(editions)?.id ?? "");
  }, [editions, selectedFestivalId, selectedEditionId, setSelectedEditionId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Festival and edition selection</CardTitle>
        <CardDescription>
          Choose the festival workspace. The most relevant edition is selected
          automatically when possible.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div>
          <Label>Festival</Label>
          <Select
            value={selectedFestivalId}
            onValueChange={setSelectedFestivalId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a festival" />
            </SelectTrigger>
            <SelectContent>
              {rows.map((row) => (
                <SelectItem key={row.festivalId} value={row.festivalId}>
                  {row.brandName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Festival edition</Label>
          <Select
            value={selectedEditionId}
            onValueChange={setSelectedEditionId}
            disabled={editionsQuery.isLoading || editions.length === 0}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  editions.length ? "Select an edition" : "No edition available"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {editions.map((edition) => (
                <SelectItem key={edition.id} value={edition.id}>
                  {edition.title} · {edition.status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {editionsQuery.isLoading && (
            <p className="mt-2 text-sm text-muted-foreground">
              Loading festival editions…
            </p>
          )}
          {editionsQuery.error && (
            <p className="mt-2 text-sm text-destructive">
              Festival editions could not be loaded.
            </p>
          )}
          {!editionsQuery.isLoading && editions.length === 0 && (
            <p className="mt-2 text-sm text-muted-foreground">
              No edition has been created for this festival.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Overview({
  selectedFestival,
  selectedEdition,
  onCreateFestival,
  onCreateEdition,
  onSelectFestival,
  onOpenManagement,
}: {
  selectedFestival?: AdminFestivalCatalogueRow;
  selectedEdition?: OwnerEditionOption;
  onCreateFestival: () => void;
  onCreateEdition: (
    festivalId: string,
    mode: "create_first_edition" | "add_edition",
  ) => void;
  onSelectFestival: (festivalId: string) => void;
  onOpenManagement: (festivalId: string, editionId: string) => void;
}) {
  if (!selectedFestival)
    return (
      <div className="space-y-4">
        <AdminFestivalCatalogue
          selectedFestivalId={selectedFestival?.festivalId}
          onCreateFestival={onCreateFestival}
          onCreateEdition={onCreateEdition}
          onSelectFestival={onSelectFestival}
          onOpenManagement={onOpenManagement}
        />
        <Card>
          <CardContent className="flex items-center justify-between p-6 text-muted-foreground">
            <span>No festivals have been created yet.</span>
            <Button onClick={onCreateFestival}>Create Festival</Button>
          </CardContent>
        </Card>
      </div>
    );
  return (
    <div className="space-y-4">
      <AdminFestivalCatalogue
        selectedFestivalId={selectedFestival.festivalId}
        onCreateFestival={onCreateFestival}
        onCreateEdition={onCreateEdition}
        onSelectFestival={onSelectFestival}
        onOpenManagement={onOpenManagement}
      />
      <Card>
        <CardHeader>
          <CardTitle>Selected festival summary</CardTitle>
          <CardDescription>
            Lifecycle controls are shown after a valid festival edition is
            selected.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <p>
            <span className="text-muted-foreground">Festival</span>
            <br />
            <b>{selectedFestival.brandName}</b>
          </p>
          <p>
            <span className="text-muted-foreground">City</span>
            <br />
            <b>{selectedFestival.cityName ?? "Not set"}</b>
          </p>
          <p>
            <span className="text-muted-foreground">Lifecycle</span>
            <br />
            <b>
              {selectedEdition?.status ??
                selectedFestival.lifecycleState ??
                "No edition"}
            </b>
          </p>
          <p>
            <span className="text-muted-foreground">Dates</span>
            <br />
            <b>
              {selectedEdition?.startAt ?? "Not scheduled"} →{" "}
              {selectedEdition?.endAt ?? "Not scheduled"}
            </b>
          </p>
          <p>
            <span className="text-muted-foreground">Stages</span>
            <br />
            <b>{selectedFestival.stageCount}</b>
          </p>
          <p>
            <span className="text-muted-foreground">Confirmed bands</span>
            <br />
            <b>{selectedFestival.activeContractCount}</b>
          </p>
          <p>
            <span className="text-muted-foreground">System check warnings</span>
            <br />
            <b>{selectedFestival.dataHealthWarnings.length}</b>
          </p>
          <p>
            <span className="text-muted-foreground">Edition</span>
            <br />
            <b>
              {selectedEdition?.title ??
                "No edition has been created for this festival."}
            </b>
          </p>
        </CardContent>
      </Card>
      <FestivalLifecycleControls
        editionId={selectedEdition?.id}
        status={selectedEdition?.status ?? selectedFestival.lifecycleState}
      />
    </div>
  );
}

function Applications({
  festivalId,
  editionId,
}: {
  festivalId?: string;
  editionId?: string;
}) {
  const [selectedApplication, setSelectedApplication] = useState<any>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [offeredPayment, setOfferedPayment] = useState("");
  const { applications, isLoading, reviewApplication, isReviewing } =
    useFestivalSlotApplications(editionId ? { scope: "edition", editionId, festivalId } : festivalId ? { scope: "festival", festivalId } : undefined);
  const pending = applications?.filter((a) => a.status === "pending") ?? [];
  const reviewed = applications?.filter((a) => a.status !== "pending") ?? [];
  const submit = (status: "accepted" | "rejected") => {
    if (!selectedApplication) return;
    reviewApplication({
      applicationId: selectedApplication.id,
      status,
      adminNotes: adminNotes || undefined,
      offeredPayment: offeredPayment ? Number(offeredPayment) : undefined,
    });
    setSelectedApplication(null);
    setAdminNotes("");
    setOfferedPayment("");
  };
  if (!festivalId)
    return (
      <Card>
        <CardContent className="p-6 text-muted-foreground">
          Select a festival before reviewing applications.
        </CardContent>
      </Card>
    );
  if (isLoading)
    return (
      <Card>
        <CardContent className="p-6">
          Loading festival applications…
        </CardContent>
      </Card>
    );
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Pending applications</CardTitle>
          <CardDescription>
            Edition-scoped queue. Review offered payment and add admin notes
            before accepting or rejecting.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {pending.length === 0 ? (
            <p className="text-muted-foreground">No pending applications.</p>
          ) : (
            pending.map((app) => (
              <div
                key={app.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded border p-3"
              >
                <div>
                  <b>{app.band?.name ?? "Unknown band"}</b>
                  <p className="text-sm text-muted-foreground">
                    {app.festival?.name ?? "Selected festival"} ·{" "}
                    {app.slot_type}
                  </p>
                </div>
                <Button size="sm" onClick={() => setSelectedApplication(app)}>
                  Review
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Reviewed application history</CardTitle>
        </CardHeader>
        <CardContent>
          {reviewed.length === 0 ? (
            <p className="text-muted-foreground">No reviewed applications.</p>
          ) : (
            reviewed.map((app) => (
              <p key={app.id} className="flex justify-between border-b py-2">
                <span>{app.band?.name ?? "Unknown band"}</span>
                <Badge>{app.status}</Badge>
              </p>
            ))
          )}
        </CardContent>
      </Card>
      <Dialog
        open={!!selectedApplication}
        onOpenChange={(open) => !open && setSelectedApplication(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review application</DialogTitle>
          </DialogHeader>
          <Label>
            Offered payment
            <Input
              type="number"
              value={offeredPayment}
              onChange={(e) => setOfferedPayment(e.target.value)}
            />
          </Label>
          <Label>
            Admin notes
            <Textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
            />
          </Label>
          <div className="flex gap-2">
            <Button disabled={isReviewing} onClick={() => submit("accepted")}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Accept
            </Button>
            <Button
              disabled={isReviewing}
              variant="destructive"
              onClick={() => submit("rejected")}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Reject
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function FestivalsAdminPage() {
  const navigate = useNavigate();
  const catalogue = useAdminFestivalCatalogue();
  const rows = catalogue.data ?? [];
  const [selectedFestivalId, setSelectedFestivalId] = useState("");
  const [selectedEditionId, setSelectedEditionId] = useState("");
  const [wizard, setWizard] = useState<{
    open: boolean;
    mode: "create_festival" | "create_first_edition" | "add_edition";
    festival?: AdminFestivalCatalogueRow;
  }>({ open: false, mode: "create_festival" });
  const [success, setSuccess] = useState<null | {
    publicRoute: string;
    managementRoute: string;
  }>(null);
  const editionsQuery = useOwnerFestivalEditions(selectedFestivalId);
  const selectedFestival = rows.find(
    (row) => row.festivalId === selectedFestivalId,
  );
  const selectedEdition = editionsQuery.data?.find(
    (edition) => edition.id === selectedEditionId,
  );
  const openCreateEdition = (
    festivalId: string,
    mode: "create_first_edition" | "add_edition",
  ) =>
    setWizard({
      open: true,
      mode,
      festival: rows.find((row) => row.festivalId === festivalId),
    });
  const openManagement = (_festivalId: string, editionId: string) => {
    navigate(`/festivals/${_festivalId}/manage/editions/${editionId}`);
  };
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-oswald">Festivals Administration</h1>
          <p className="text-muted-foreground">
            Manage festivals, applications, operations, results and technical
            support tools from one workspace.
          </p>
        </div>
        <Button
          onClick={() => setWizard({ open: true, mode: "create_festival" })}
        >
          Create Festival
        </Button>
      </div>
      {success && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
            <span className="text-sm">
              Festival created successfully. Continue setup from the overview or
              open another workspace.
            </span>
            <span className="flex gap-2">
              <Button asChild variant="outline">
                <Link to={success.managementRoute}>
                  Open management workspace
                </Link>
              </Button>
              <Button asChild variant="ghost">
                <Link to={success.publicRoute}>View public page</Link>
              </Button>
            </span>
          </CardContent>
        </Card>
      )}
      {catalogue.isLoading && (
        <Card>
          <CardContent className="p-6">Loading festivals…</CardContent>
        </Card>
      )}
      {catalogue.error && (
        <Card>
          <CardContent className="p-6 text-destructive">
            Festivals could not be loaded. You may not have permission to manage
            festivals.
          </CardContent>
        </Card>
      )}
      {!catalogue.isLoading && !catalogue.error && (
        <FestivalEditionSelector
          rows={rows}
          selectedFestivalId={selectedFestivalId}
          setSelectedFestivalId={setSelectedFestivalId}
          selectedEditionId={selectedEditionId}
          setSelectedEditionId={setSelectedEditionId}
        />
      )}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="applications">Applications</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="operations">Operations</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <Overview
            selectedFestival={selectedFestival}
            selectedEdition={selectedEdition}
            onCreateFestival={() =>
              setWizard({ open: true, mode: "create_festival" })
            }
            onCreateEdition={openCreateEdition}
            onSelectFestival={setSelectedFestivalId}
            onOpenManagement={openManagement}
          />
        </TabsContent>
        <TabsContent value="applications">
          <Applications
            festivalId={selectedFestivalId}
            editionId={selectedEditionId}
          />
        </TabsContent>
        <TabsContent value="schedule">
          <EditionRequired editionId={selectedEditionId} onCreateFirstEdition={() => selectedFestivalId && openCreateEdition(selectedFestivalId, "create_first_edition")}>
            <FestivalScheduleWorkspace editionId={selectedEditionId} />
          </EditionRequired>
        </TabsContent>
        <TabsContent value="operations">
          <EditionRequired
            editionId={selectedEditionId}
            onCreateFirstEdition={() =>
              selectedFestivalId &&
              openCreateEdition(selectedFestivalId, "create_first_edition")
            }
          >
            <Tabs defaultValue="stages">
              <TabsList className="flex h-auto flex-wrap">
                <TabsTrigger value="stages">Stages</TabsTrigger>
                <TabsTrigger value="staff">Staff</TabsTrigger>
                <TabsTrigger value="permits">Permits</TabsTrigger>
                <TabsTrigger value="insurance">Insurance</TabsTrigger>
                <TabsTrigger value="live">Live event</TabsTrigger>
              </TabsList>
              <TabsContent value="stages">
                <FestivalStageManagement
                  editionId={selectedEditionId}
                  scope="admin"
                />
              </TabsContent>
              <TabsContent value="staff">
                <FestivalStaffManagement
                  editionId={selectedEditionId}
                  scope="admin"
                />
              </TabsContent>
              <TabsContent value="permits">
                <FestivalPermitManagement
                  editionId={selectedEditionId}
                  scope="admin"
                />
              </TabsContent>
              <TabsContent value="insurance">
                <FestivalInsuranceManagement
                  editionId={selectedEditionId}
                  scope="admin"
                />
              </TabsContent>
              <TabsContent value="live">
                <FestivalOutcomesManagement
                  editionId={selectedEditionId}
                  scope="admin"
                />
              </TabsContent>
            </Tabs>
          </EditionRequired>
        </TabsContent>
        <TabsContent value="results">
          <EditionRequired
            editionId={selectedEditionId}
            onCreateFirstEdition={() =>
              selectedFestivalId &&
              openCreateEdition(selectedFestivalId, "create_first_edition")
            }
          >
            <FestivalOutcomesManagement
              editionId={selectedEditionId}
              scope="admin"
            />
            <FestivalSettlementManagement editionId={selectedEditionId} />
          </EditionRequired>
        </TabsContent>
        <TabsContent value="advanced">
          <Card>
            <CardHeader>
              <CardTitle>Advanced technical support tools</CardTitle>
              <CardDescription>
                These tools are for migration support, system checks and audit
                review. They are not required for normal festival management.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link to="/admin/festivals#system-checks">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  System checks
                </Link>
              </Button>
            </CardContent>
          </Card>
          <FestivalLegacyRecordsManagement />
          <FestivalDataHealthManagement />
          <FestivalAuditLog />
        </TabsContent>
      </Tabs>
      <FestivalCreationWizard
        open={wizard.open}
        mode={wizard.mode}
        festival={wizard.festival}
        onOpenChange={(open) => setWizard((current) => ({ ...current, open }))}
        onCreated={(result) => {
          setWizard((current) => ({ ...current, open: false }));
          setSelectedFestivalId(result.festivalId);
          setSelectedEditionId(result.editionId);
          setSuccess({
            publicRoute: result.publicRoute,
            managementRoute: result.managementRoute,
          });
          catalogue.refetch();
        }}
      />
    </div>
  );
}
