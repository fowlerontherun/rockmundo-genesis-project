import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Eye, Mic2, Radio, Tv } from "lucide-react";
import { format } from "date-fns";

export interface MediaOfferRow {
  id: string;
  media_type: string;
  program_name: string;
  network: string;
  proposed_date: string;
  status: string;
  compensation: number;
}

interface MediaOffersTableProps {
  offers: MediaOfferRow[];
  loading?: boolean;
  onRespond: (params: { offerId: string; accept: boolean }) => void;
}

const statusBadge = (status: string) => {
  if (status === "accepted") return <Badge className="bg-success">Accepted</Badge>;
  if (status === "declined") return <Badge variant="destructive">Declined</Badge>;
  if (status === "pending") return <Badge variant="outline">Pending</Badge>;
  return <Badge>{status}</Badge>;
};

const mediaIcon = (type: string) => {
  switch (type) {
    case "tv":
      return <Tv className="h-4 w-4" aria-label="tv" />;
    case "radio":
      return <Radio className="h-4 w-4" aria-label="radio" />;
    case "podcast":
      return <Mic2 className="h-4 w-4" aria-label="podcast" />;
    default:
      return <Eye className="h-4 w-4" aria-label="appearance" />;
  }
};

export const MediaOffersTable = ({ offers, loading, onRespond }: MediaOffersTableProps) => {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">Loading...</CardContent>
      </Card>
    );
  }

  if (offers.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">No offers yet</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>Program</TableHead>
            <TableHead>Network</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Payout</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {offers.map((offer) => (
            <TableRow key={offer.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  {mediaIcon(offer.media_type)}
                  <span className="capitalize">{offer.media_type}</span>
                </div>
              </TableCell>
              <TableCell className="font-medium">{offer.program_name}</TableCell>
              <TableCell>{offer.network}</TableCell>
              <TableCell>{format(new Date(offer.proposed_date), "MMM d, yyyy")}</TableCell>
              <TableCell>{statusBadge(offer.status)}</TableCell>
              <TableCell>${offer.compensation.toLocaleString()}</TableCell>
              <TableCell className="text-right space-x-2">
                {offer.status === "pending" ? (
                  <>
                    <Button size="sm" variant="outline" onClick={() => onRespond({ offerId: offer.id, accept: false })}>
                      Decline
                    </Button>
                    <Button size="sm" onClick={() => onRespond({ offerId: offer.id, accept: true })}>
                      Accept
                    </Button>
                  </>
                ) : (
                  <Badge variant="secondary">Responded</Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
};

export default MediaOffersTable;
