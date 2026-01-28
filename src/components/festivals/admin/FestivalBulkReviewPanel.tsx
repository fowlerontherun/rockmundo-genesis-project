import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  CheckCircle,
  XCircle,
  Clock,
  Filter,
  ArrowUpDown,
  Search,
  Star,
  Music,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Application {
  id: string;
  status: string;
  slot_type: string;
  application_message?: string;
  created_at: string;
  band?: { id: string; name: string; genre: string; fame: number };
  festival?: { id: string; name: string };
  setlist?: { id: string; name: string };
}

interface FestivalBulkReviewPanelProps {
  applications: Application[];
  onReviewComplete?: () => void;
}

type FilterStatus = "all" | "pending" | "accepted" | "rejected" | "waitlist";
type SortBy = "date" | "fame" | "slot";

export function FestivalBulkReviewPanel({ applications, onReviewComplete }: FestivalBulkReviewPanelProps) {
  const queryClient = useQueryClient();
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("pending");
  const [sortBy, setSortBy] = useState<SortBy>("date");
  const [searchQuery, setSearchQuery] = useState("");
  const [bulkActionOpen, setBulkActionOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState<"accept" | "reject" | "waitlist">("accept");
  const [bulkPayment, setBulkPayment] = useState("");
  const [bulkNotes, setBulkNotes] = useState("");

  // Auto-scoring rubric
  const calculateScore = (app: Application) => {
    let score = 0;
    
    // Fame score (0-40 points)
    const fame = app.band?.fame || 0;
    if (fame >= 2000) score += 40;
    else if (fame >= 1000) score += 30;
    else if (fame >= 500) score += 20;
    else if (fame >= 250) score += 10;
    
    // Slot match score (0-30 points)
    if (app.slot_type === "headline" && fame >= 2000) score += 30;
    else if (app.slot_type === "main" && fame >= 750) score += 30;
    else if (app.slot_type === "support" && fame >= 250) score += 30;
    else if (app.slot_type === "opening") score += 30;
    else score += 10; // Mismatched slot
    
    // Has setlist (0-15 points)
    if (app.setlist) score += 15;
    
    // Has message (0-15 points)
    if (app.application_message && app.application_message.length > 20) score += 15;
    else if (app.application_message) score += 5;
    
    return score;
  };

  // Filter and sort applications
  const filteredApplications = applications
    .filter(app => {
      if (filterStatus !== "all" && app.status !== filterStatus) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          app.band?.name.toLowerCase().includes(query) ||
          app.festival?.name.toLowerCase().includes(query) ||
          app.band?.genre?.toLowerCase().includes(query)
        );
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "fame":
          return (b.band?.fame || 0) - (a.band?.fame || 0);
        case "slot":
          const slotOrder = { headline: 0, main: 1, support: 2, opening: 3 };
          return (slotOrder[a.slot_type as keyof typeof slotOrder] || 4) - 
                 (slotOrder[b.slot_type as keyof typeof slotOrder] || 4);
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

  // Bulk review mutation
  const bulkReviewMutation = useMutation({
    mutationFn: async () => {
      const updates = selectedIds.map(id => ({
        id,
        status: bulkAction === "waitlist" ? "waitlist" : bulkAction === "accept" ? "accepted" : "rejected",
        reviewed_at: new Date().toISOString(),
        admin_notes: bulkNotes || undefined,
        offered_payment: bulkPayment ? parseFloat(bulkPayment) : undefined,
      }));
      
      // Update each application
      for (const update of updates) {
        const { error } = await (supabase as any)
          .from("festival_slot_applications")
          .update({
            status: update.status,
            reviewed_at: update.reviewed_at,
            admin_notes: update.admin_notes,
            offered_payment: update.offered_payment,
          })
          .eq("id", update.id);
        
        if (error) throw error;
      }
      
      return updates.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["festival-slot-applications"] });
      toast.success(`${count} applications ${bulkAction === "accept" ? "accepted" : bulkAction === "reject" ? "rejected" : "waitlisted"}`);
      setSelectedIds([]);
      setBulkActionOpen(false);
      setBulkNotes("");
      setBulkPayment("");
      onReviewComplete?.();
    },
    onError: (error: any) => {
      toast.error("Bulk review failed", { description: error.message });
    },
  });

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredApplications.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredApplications.map(a => a.id));
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-primary";
    if (score >= 40) return "text-amber-500";
    return "text-muted-foreground";
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Application Review Queue
          </CardTitle>
          <CardDescription>
            Review and process festival applications in bulk
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters and Search */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search bands or festivals..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as FilterStatus)}>
              <SelectTrigger className="w-[130px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="waitlist">Waitlist</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
              <SelectTrigger className="w-[130px]">
                <ArrowUpDown className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">By Date</SelectItem>
                <SelectItem value="fame">By Fame</SelectItem>
                <SelectItem value="slot">By Slot</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Bulk Actions */}
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <span className="text-sm font-medium">
                {selectedIds.length} selected
              </span>
              <div className="flex gap-2 ml-auto">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setBulkAction("accept"); setBulkActionOpen(true); }}
                >
                  <CheckCircle className="h-4 w-4 mr-1 text-green-500" />
                  Accept All
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setBulkAction("waitlist"); setBulkActionOpen(true); }}
                >
                  <Clock className="h-4 w-4 mr-1 text-amber-500" />
                  Waitlist
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setBulkAction("reject"); setBulkActionOpen(true); }}
                >
                  <XCircle className="h-4 w-4 mr-1 text-destructive" />
                  Reject All
                </Button>
              </div>
            </div>
          )}

          {/* Application List */}
          <div className="border rounded-lg">
            {/* Header */}
            <div className="flex items-center gap-3 p-3 bg-muted/30 border-b text-sm font-medium">
              <Checkbox
                checked={selectedIds.length === filteredApplications.length && filteredApplications.length > 0}
                onCheckedChange={toggleSelectAll}
              />
              <span className="flex-1">Band</span>
              <span className="w-24 text-center">Slot</span>
              <span className="w-20 text-center">Fame</span>
              <span className="w-20 text-center">Score</span>
              <span className="w-24 text-center">Status</span>
            </div>
            
            <ScrollArea className="h-[400px]">
              {filteredApplications.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No applications match your filters
                </div>
              ) : (
                <div className="divide-y">
                  {filteredApplications.map((app) => {
                    const score = calculateScore(app);
                    return (
                      <div
                        key={app.id}
                        className={cn(
                          "flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors",
                          selectedIds.includes(app.id) && "bg-primary/5"
                        )}
                      >
                        <Checkbox
                          checked={selectedIds.includes(app.id)}
                          onCheckedChange={() => toggleSelect(app.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{app.band?.name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline" className="text-xs">{app.band?.genre}</Badge>
                            <span>{app.festival?.name}</span>
                          </div>
                        </div>
                        <Badge variant="outline" className="w-24 justify-center capitalize">
                          {app.slot_type}
                        </Badge>
                        <div className="w-20 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Star className="h-3 w-3 text-amber-500" />
                            <span className="text-sm">{app.band?.fame || 0}</span>
                          </div>
                        </div>
                        <div className="w-20 text-center">
                          <span className={cn("font-bold", getScoreColor(score))}>
                            {score}/100
                          </span>
                        </div>
                        <Badge
                          className="w-24 justify-center capitalize"
                          variant={
                            app.status === "accepted" ? "default" :
                            app.status === "rejected" ? "destructive" :
                            app.status === "waitlist" ? "secondary" : "outline"
                          }
                        >
                          {app.status}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Summary */}
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Showing {filteredApplications.length} of {applications.length} applications</span>
            <span>
              {applications.filter(a => a.status === "pending").length} pending review
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Action Dialog */}
      <Dialog open={bulkActionOpen} onOpenChange={setBulkActionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {bulkAction === "accept" ? "Accept" : bulkAction === "reject" ? "Reject" : "Waitlist"} {selectedIds.length} Applications
            </DialogTitle>
            <DialogDescription>
              This will {bulkAction} all selected applications. You can add notes and payment details.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {bulkAction === "accept" && (
              <div className="space-y-2">
                <Label htmlFor="bulkPayment">Offered Payment (per band)</Label>
                <Input
                  id="bulkPayment"
                  type="number"
                  value={bulkPayment}
                  onChange={(e) => setBulkPayment(e.target.value)}
                  placeholder="e.g., 5000"
                />
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="bulkNotes">Admin Notes</Label>
              <Textarea
                id="bulkNotes"
                value={bulkNotes}
                onChange={(e) => setBulkNotes(e.target.value)}
                placeholder="Add any notes for this batch..."
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkActionOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={bulkAction === "reject" ? "destructive" : "default"}
              onClick={() => bulkReviewMutation.mutate()}
              disabled={bulkReviewMutation.isPending}
            >
              {bulkAction === "accept" && <CheckCircle className="h-4 w-4 mr-2" />}
              {bulkAction === "reject" && <XCircle className="h-4 w-4 mr-2" />}
              {bulkAction === "waitlist" && <Clock className="h-4 w-4 mr-2" />}
              Confirm {bulkAction === "accept" ? "Acceptance" : bulkAction === "reject" ? "Rejection" : "Waitlist"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
