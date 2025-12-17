import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Route, Search, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface LinkTourDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (tourId: string, tourName: string) => void;
}

export const LinkTourDialog = ({ open, onOpenChange, onSelect }: LinkTourDialogProps) => {
  const { user } = useAuth();
  const [search, setSearch] = useState("");

  const { data: tours = [], isLoading } = useQuery({
    queryKey: ["user-tours-for-twaater", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Get user's bands
      const { data: memberships } = await supabase
        .from("band_members")
        .select("band_id")
        .eq("user_id", user.id);

      const bandIds = memberships?.map((m) => m.band_id) || [];
      if (bandIds.length === 0) return [];

      // Fetch tours
      const { data: tours, error } = await supabase
        .from("tours")
        .select(`
          id, name, status, start_date, end_date,
          band:bands(id, name)
        `)
        .in("band_id", bandIds)
        .order("start_date", { ascending: false })
        .limit(30);

      if (error) throw error;
      return tours || [];
    },
    enabled: open && !!user?.id,
  });

  const filteredTours = tours.filter((t: any) =>
    t.name?.toLowerCase().includes(search.toLowerCase()) ||
    t.band?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" style={{ backgroundColor: "hsl(var(--twaater-card))" }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Route className="h-5 w-5" style={{ color: "hsl(var(--twaater-purple))" }} />
            Link a Tour
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tours..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <ScrollArea className="h-[300px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-20 text-muted-foreground">Loading tours...</div>
          ) : filteredTours.length === 0 ? (
            <div className="flex items-center justify-center h-20 text-muted-foreground">
              {search ? "No tours found" : "No tours yet"}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTours.map((tour: any) => (
                <button
                  key={tour.id}
                  onClick={() => {
                    onSelect(tour.id, tour.name);
                    onOpenChange(false);
                  }}
                  className="w-full p-3 rounded-lg text-left transition-colors hover:bg-[hsl(var(--twaater-hover))] border border-transparent hover:border-[hsl(var(--twaater-border))]"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{tour.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {tour.band?.name}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <Calendar className="h-3 w-3" />
                        {tour.start_date && format(new Date(tour.start_date), "MMM d")} - {tour.end_date && format(new Date(tour.end_date), "MMM d, yyyy")}
                      </p>
                    </div>
                    <Badge 
                      variant={tour.status === "completed" ? "default" : "secondary"} 
                      className="text-xs capitalize"
                    >
                      {tour.status || "planned"}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
