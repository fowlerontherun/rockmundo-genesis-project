import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar, Eye, Mic2, Radio, Tv } from "lucide-react";
import { format } from "date-fns";

export interface MediaAppearanceRow {
  id: string;
  media_type: string;
  program_name: string;
  network: string;
  air_date: string;
  audience_reach: number;
  sentiment: string;
  highlight: string;
}

interface MediaAppearancesTableProps {
  appearances: MediaAppearanceRow[];
  loading?: boolean;
}

const sentimentBadge = (sentiment: string) => {
  if (sentiment === "positive") return <Badge className="bg-success">Positive</Badge>;
  if (sentiment === "negative") return <Badge variant="destructive">Negative</Badge>;
  return <Badge variant="secondary">Neutral</Badge>;
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

export const MediaAppearancesTable = ({ appearances, loading }: MediaAppearancesTableProps) => {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">Loading...</CardContent>
      </Card>
    );
  }

  if (appearances.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          No appearances yet
        </CardContent>
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
            <TableHead>Air Date</TableHead>
            <TableHead>Reach</TableHead>
            <TableHead>Sentiment</TableHead>
            <TableHead>Highlight</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {appearances.map((appearance) => (
            <TableRow key={appearance.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  {mediaIcon(appearance.media_type)}
                  <span className="capitalize">{appearance.media_type}</span>
                </div>
              </TableCell>
              <TableCell className="font-medium">{appearance.program_name}</TableCell>
              <TableCell>{appearance.network}</TableCell>
              <TableCell>
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-4 w-4" aria-hidden />
                  {format(new Date(appearance.air_date), "MMM d, yyyy")}
                </span>
              </TableCell>
              <TableCell>{appearance.audience_reach.toLocaleString()}</TableCell>
              <TableCell>{sentimentBadge(appearance.sentiment)}</TableCell>
              <TableCell className="max-w-xs truncate">{appearance.highlight}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
};

export default MediaAppearancesTable;
