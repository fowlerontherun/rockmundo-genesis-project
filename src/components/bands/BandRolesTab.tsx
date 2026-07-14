import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BAND_PERMISSION_CATALOGUE, DEFAULT_BAND_ROLE_TEMPLATES, permissionByKey } from "@/lib/band-permissions";
import { ShieldCheck, Timer, UserCog, Vote } from "lucide-react";

interface BandRolesTabProps { bandId: string; }

const riskClassName: Record<string, string> = {
  low: "bg-emerald-500/15 text-emerald-700",
  standard: "bg-sky-500/15 text-sky-700",
  sensitive: "bg-amber-500/15 text-amber-700",
  critical: "bg-red-500/15 text-red-700",
};

function humanCategory(value: string) {
  return value.replace("_", " & ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function BandRolesTab({ bandId }: BandRolesTabProps) {
  const groupedPermissions = useMemo(() => {
    return BAND_PERMISSION_CATALOGUE.reduce<Record<string, typeof BAND_PERMISSION_CATALOGUE[number][]>>((acc, permission) => {
      acc[permission.category] = [...(acc[permission.category] ?? []), permission];
      return acc;
    }, {});
  }, []);

  return (
    <div className="space-y-6" data-band-id={bandId}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Current authority</CardTitle>
            <CardDescription>Founder is historical; owner/controller remains the band leader until a transfer workflow completes.</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UserCog className="h-4 w-4" /> Responsibilities</CardTitle>
            <CardDescription>Musical position stays separate from one primary leadership role and multiple management roles.</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Timer className="h-4 w-4" /> Temporary delegation</CardTitle>
            <CardDescription>Expiring role assignments and overrides are modelled centrally and deny overrides take precedence.</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Vote className="h-4 w-4" /> Approval-ready</CardTitle>
            <CardDescription>Approval requests support leader, owner, two-person, majority and unanimous policy modes.</CardDescription>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Default role templates</CardTitle>
          <CardDescription>Reusable system roles seeded by the permission foundation; custom per-band roles use the same permission keys.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead>Protection</TableHead>
                  <TableHead>Permissions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {DEFAULT_BAND_ROLE_TEMPLATES.map((role) => (
                  <TableRow key={role.roleType}>
                    <TableCell className="font-medium">{role.name}</TableCell>
                    <TableCell className="max-w-md text-sm text-muted-foreground">{role.description}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {role.protected && <Badge variant="outline">Protected</Badge>}
                        {role.primaryLeadership && <Badge variant="secondary">Leadership</Badge>}
                        {!role.protected && !role.primaryLeadership && <Badge variant="outline">Assignable</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex max-w-lg flex-wrap gap-1">
                        {role.permissions.slice(0, 8).map((key) => {
                          const permission = permissionByKey.get(key);
                          return (
                          <Badge key={key} className={riskClassName[permission?.risk ?? "standard"]}>
                            {permission?.label ?? key}
                          </Badge>
                          );
                        })}
                        {role.permissions.length > 8 && <Badge variant="outline">+{role.permissions.length - 8} more</Badge>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Permission catalogue and risk levels</CardTitle>
          <CardDescription>Stable machine-readable keys are grouped by domain. Risk controls who may grant each permission.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          {Object.entries(groupedPermissions).map(([category, permissions]) => (
            <section key={category} className="rounded-lg border p-3">
              <h3 className="mb-3 font-semibold">{humanCategory(category)}</h3>
              <div className="space-y-2">
                {permissions.map((permission) => (
                  <div key={permission.key} className="flex items-center justify-between gap-3 text-sm">
                    <div>
                      <p className="font-medium">{permission.label}</p>
                      <code className="text-xs text-muted-foreground">{permission.key}</code>
                    </div>
                    <Badge className={riskClassName[permission.risk]}>{permission.risk}</Badge>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
