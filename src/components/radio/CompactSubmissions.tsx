import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { 
  Clock, CheckCircle, XCircle, Radio, Search, Filter, 
  ChevronDown, ChevronUp, Music 
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Submission {
  id: string;
  status: string;
  submitted_at: string;
  reviewed_at: string | null;
  rejection_reason: string | null;
  songs?: { title: string } | null;
  radio_stations?: { name: string } | null;
}

interface CompactSubmissionsProps {
  submissions: Submission[];
  isLoading: boolean;
}

export function CompactSubmissions({ submissions, isLoading }: CompactSubmissionsProps) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [stationFilter, setStationFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Get unique station names
  const stationNames = useMemo(() => {
    const names = new Set<string>();
    submissions.forEach(s => {
      if (s.radio_stations?.name) names.add(s.radio_stations.name);
    });
    return Array.from(names).sort();
  }, [submissions]);

  // Filter submissions
  const filteredSubmissions = useMemo(() => {
    return submissions.filter(sub => {
      // Status filter
      if (statusFilter !== "all" && sub.status !== statusFilter) return false;
      
      // Station filter
      if (stationFilter !== "all" && sub.radio_stations?.name !== stationFilter) return false;
      
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const songMatch = sub.songs?.title?.toLowerCase().includes(query);
        const stationMatch = sub.radio_stations?.name?.toLowerCase().includes(query);
        if (!songMatch && !stationMatch) return false;
      }
      
      return true;
    });
  }, [submissions, statusFilter, stationFilter, searchQuery]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "accepted":
        return <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />;
      case "rejected":
        return <XCircle className="h-3.5 w-3.5 text-destructive" />;
      default:
        return <Clock className="h-3.5 w-3.5 text-amber-500" />;
    }
  };

  const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" => {
    switch (status) {
      case "accepted": return "default";
      case "rejected": return "destructive";
      default: return "secondary";
    }
  };

  // Stats summary
  const stats = useMemo(() => ({
    total: submissions.length,
    pending: submissions.filter(s => s.status === "pending").length,
    accepted: submissions.filter(s => s.status === "accepted").length,
    rejected: submissions.filter(s => s.status === "rejected").length,
  }), [submissions]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-2 animate-pulse">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Radio className="h-5 w-5" />
              My Submissions
            </CardTitle>
            <CardDescription className="text-sm">
              {stats.total} total • {stats.pending} pending • {stats.accepted} accepted
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowFilters(!showFilters)}
            className="w-fit"
          >
            <Filter className="h-4 w-4 mr-1" />
            Filters
            {showFilters ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
          </Button>
        </div>

        {/* Filters Section */}
        {showFilters && (
          <div className="mt-4 space-y-3 p-3 bg-muted/30 rounded-lg border">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search songs or stations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Select value={stationFilter} onValueChange={setStationFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Station" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stations</SelectItem>
                  {stationNames.map(name => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {submissions.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <Music className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No submissions yet</p>
            <p className="text-sm">Submit songs to radio stations to get airplay!</p>
          </div>
        ) : filteredSubmissions.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground">
            <p>No submissions match your filters</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] -mx-2">
            <div className="space-y-1 px-2">
              {filteredSubmissions.map((sub) => (
                <div
                  key={sub.id}
                  className="rounded-lg border p-2.5 hover:bg-accent/50 transition-colors cursor-pointer"
                  onClick={() => setExpandedId(expandedId === sub.id ? null : sub.id)}
                >
                  <div className="flex items-center gap-2">
                    {getStatusIcon(sub.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate text-sm">
                          {sub.songs?.title || "Unknown Song"}
                        </span>
                        <Badge 
                          variant={getStatusBadgeVariant(sub.status)} 
                          className="text-xs px-1.5 py-0 h-5 shrink-0"
                        >
                          {sub.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="truncate">{sub.radio_stations?.name || "Unknown Station"}</span>
                        <span>•</span>
                        <span className="shrink-0">
                          {formatDistanceToNow(new Date(sub.submitted_at), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Expanded details */}
                  {expandedId === sub.id && sub.rejection_reason && (
                    <div className="mt-2 pt-2 border-t text-xs">
                      <p className="text-destructive font-medium">Rejection Reason:</p>
                      <p className="text-muted-foreground mt-0.5">{sub.rejection_reason}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
