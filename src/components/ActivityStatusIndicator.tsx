import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth-context";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export function ActivityStatusIndicator() {
  const { user } = useAuth();
  const [currentActivity, setCurrentActivity] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;

    const fetchCurrentActivity = async () => {
      const now = new Date().toISOString();
      
      // Find activities happening NOW based on time, not status
      // Activities may still be 'scheduled' even when they should be active
      const { data } = await (supabase as any)
        .from('player_scheduled_activities')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['scheduled', 'in_progress'])
        .lte('scheduled_start', now)
        .gte('scheduled_end', now)
        .order('scheduled_start', { ascending: false })
        .limit(1)
        .maybeSingle();

      setCurrentActivity(data);
      setLoading(false);
    };

    fetchCurrentActivity();

    // Poll every 30 seconds
    const interval = setInterval(fetchCurrentActivity, 30000);

    return () => clearInterval(interval);
  }, [user?.id]);

  if (loading || !user) return null;

  const isBusy = !!currentActivity;

  return (
    <Badge 
      variant="outline" 
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 transition-colors",
        isBusy 
          ? "bg-destructive/10 text-destructive border-destructive/50" 
          : "bg-emerald-500/10 text-emerald-600 border-emerald-500/50 dark:text-emerald-400"
      )}
    >
      {isBusy ? (
        <>
          <Clock className="h-3.5 w-3.5 animate-pulse" />
          <span className="font-medium">{currentActivity.title || 'Busy'}</span>
        </>
      ) : (
        <>
          <CheckCircle className="h-3.5 w-3.5" />
          <span className="font-medium">Available</span>
        </>
      )}
    </Badge>
  );
}
