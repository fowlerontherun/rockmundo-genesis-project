import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useApplyFestivalPermit, useFestivalEditionOperations } from "../hooks";
import { WorkflowState } from "./workflowUtils";
import {
  asArray,
  asObject,
  canManage,
  friendlyError,
  lifecycleReadOnly,
  money,
  statusTone,
  text,
} from "./managementUtils";

export function permitStateLabel(s?: string) {
  const map: Record<string, string> = {
    not_applicable: "Not applicable",
    not_required: "Not required",
    not_started: "Not started",
    required: "Not started",
    pending: "Pending",
    information_requested: "More information required",
    more_information_required: "More information required",
    approved: "Approved",
    rejected: "Rejected",
    expired: "Expired",
  };
  return map[s || ""] || "Not started";
}

export function permitApplicationStatus(permit: Record<string, any>) {
  const application = asObject(permit.current_application);
  const raw = String(application.status ?? permit.application_status ?? permit.status ?? "not_started");
  if (raw === "required") return application.id ? "pending" : "not_started";
  if (raw === "not_applicable") return "not_applicable";
  return raw;
}

export function permitRequirementCode(permit: Record<string, any>) {
  return String(permit.requirement_code ?? permit.permit_type ?? permit.code ?? "");
}

function permitTitle(permit: Record<string, any>) {
  return text(permit.type ?? permit.label ?? permit.permit_type ?? permit.requirement_code);
}

function PermitApplicationDetails({ permit }: { permit: Record<string, any> }) {
  const application = asObject(permit.current_application);
  const submittedAt = application.created_at ?? permit.submitted_at;
  const updatedAt = application.updated_at ?? permit.updated_at;
  const applicant = application.applicant_profile_id ?? permit.applicant_profile_id;
  const reason = application.reason ?? permit.reason ?? permit.response;
  const idempotencyKey = application.idempotency_key ?? permit.idempotency_key;
  const id = application.id ?? (permit.id && permit.id !== permit.requirement_code ? permit.id : null);

  if (!id && !submittedAt && !reason) {
    return (
      <p className="rounded border border-dashed p-3 text-muted-foreground md:col-span-4">
        No application has been submitted for this requirement yet.
      </p>
    );
  }

  return (
    <div className="grid gap-2 rounded border bg-muted/30 p-3 text-xs md:col-span-4 md:grid-cols-2">
      <p>Application ID: <b>{text(id)}</b></p>
      <p>Applicant: <b>{text(applicant)}</b></p>
      <p>Submitted: <b>{text(submittedAt)}</b></p>
      <p>Last updated: <b>{text(updatedAt)}</b></p>
      <p>Tracking key: <b>{text(idempotencyKey)}</b></p>
      <p>Authority response: <b>{text(reason)}</b></p>
    </div>
  );
}

export function FestivalPermitManagement({
  editionId,
  scope = "owner",
}: {
  editionId: string;
  scope?: "owner" | "admin";
}) {
  const { data, isLoading, error } = useFestivalEditionOperations(editionId, scope);
  const apply = useApplyFestivalPermit(editionId);

  if (isLoading) return <WorkflowState title="Loading permits" message="Loading permit requirements…" />;
  if (error) return <WorkflowState title="Permit management unavailable" message={friendlyError(error)} variant="destructive" />;

  const root = asObject(data);
  const permits = asArray(root.permit_requirements);
  const readOnly = lifecycleReadOnly(root.lifecycle?.status || root.status) || !canManage(root.permissions, "permits");

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Permits</h2>
        <p className="text-sm text-muted-foreground">
          Apply for each edition requirement, then use the application details below to track submission status and authority responses.
        </p>
      </div>
      {permits.length === 0 ? (
        <WorkflowState title="No permits are currently required based on this edition’s configuration." message="If venue, capacity, or city rules change, canonical requirements will appear here." />
      ) : (
        <div className="grid gap-3">
          {permits.map((rawPermit) => {
            const permit = asObject(rawPermit);
            const application = asObject(permit.current_application);
            const code = permitRequirementCode(permit);
            const status = permitApplicationStatus(permit);
            const isApplicable = status !== "not_applicable" && permit.required !== false;
            const canApply = Boolean(code) && isApplicable && !["pending", "approved"].includes(status);
            const actionLabel = /information|required/i.test(status) ? "Submit requested information" : "Apply";

            return (
              <Card key={application.id ?? permit.id ?? code}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-3">
                    <span>{permitTitle(permit)}</span>
                    <Badge variant={statusTone(status) as any}>{permitStateLabel(status)}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2 text-sm md:grid-cols-4">
                  <p>{isApplicable ? "Required" : "Optional / not applicable"}</p>
                  <p>Deadline: <b>{text(permit.application_deadline)}</b></p>
                  <p>Fee: <b>{money(permit.fee_cents, root.currency_code)}</b></p>
                  <p>Processing: <b>{text(permit.expected_processing_days && `${permit.expected_processing_days} days`)}</b></p>
                  <p>Submitted: <b>{text(application.created_at ?? permit.submitted_at)}</b></p>
                  <p>Response: <b>{text(application.reason ?? permit.response)}</b></p>
                  <p>Expiry: <b>{text(application.expires_on ?? permit.expires_at)}</b></p>
                  <p>Blocker: <b>{text(permit.blocker_severity ?? (permit.blocker ? "blocker" : "none"), "none")}</b></p>
                  <div className="flex flex-wrap gap-2 md:col-span-4">
                    <Button size="sm" disabled={readOnly || apply.isPending || !canApply} onClick={() => apply.mutate(code)}>
                      {actionLabel}
                    </Button>
                    <Button size="sm" variant="outline" disabled>
                      View application below
                    </Button>
                  </div>
                  <PermitApplicationDetails permit={permit} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      {apply.error && <p className="text-sm text-destructive">{friendlyError(apply.error)}</p>}
    </div>
  );
}
