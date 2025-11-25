import { Mail, MapPin, PhoneCall, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { MediaContact } from "./types";

interface MediaContactTableProps {
  contacts: MediaContact[];
  isLoading?: boolean;
}

export function MediaContactTable({ contacts, isLoading }: MediaContactTableProps) {
  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          <CardTitle>Media Contacts</CardTitle>
        </div>
        <Badge variant="secondary">{contacts.length} relationships</Badge>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : contacts.length === 0 ? (
          <EmptyState
            title="No media contacts"
            description="Import your press list or add new editors and producers."
            icon={PhoneCall}
          />
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Outlet</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>Last outreach</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead className="text-right">Contact</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell>
                      <div className="font-semibold">{contact.name}</div>
                      <p className="text-sm text-muted-foreground">{contact.role}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">
                          {contact.sentiment ?? "neutral"}
                        </Badge>
                        <span>{contact.outlet}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        {contact.region}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{contact.lastEngaged}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{contact.preferredChannel}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      <div className="flex items-center justify-end gap-2 text-muted-foreground">
                        <Mail className="h-4 w-4" />
                        <span>{contact.email}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
