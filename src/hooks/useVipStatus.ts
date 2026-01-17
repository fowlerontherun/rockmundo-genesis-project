import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";

export interface VipSubscription {
  id: string;
  user_id: string;
  status: string;
  subscription_type: 'trial' | 'paid' | 'gifted';
  starts_at: string;
  expires_at: string;
  stripe_subscription_id: string | null;
  gifted_by_admin_id: string | null;
  gift_message: string | null;
  created_at: string;
}

export interface VipStatus {
  isVip: boolean;
  subscriptionType: 'trial' | 'paid' | 'gifted' | null;
  expiresAt: Date | null;
  daysRemaining: number | null;
  subscription: VipSubscription | null;
}

export const useVipStatus = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["vip-status", user?.id],
    queryFn: async (): Promise<VipStatus> => {
      if (!user?.id) {
        return {
          isVip: false,
          subscriptionType: null,
          expiresAt: null,
          daysRemaining: null,
          subscription: null,
        };
      }

      console.log('[useVipStatus] Checking VIP for user:', user.id);
      
      const { data, error } = await supabase
        .from("vip_subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .gte("expires_at", new Date().toISOString())
        .order("expires_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      console.log('[useVipStatus] Query result:', { data, error });

      if (error) {
        console.error("Error fetching VIP status:", error);
        throw error;
      }

      if (!data) {
        return {
          isVip: false,
          subscriptionType: null,
          expiresAt: null,
          daysRemaining: null,
          subscription: null,
        };
      }

      const expiresAt = new Date(data.expires_at);
      const now = new Date();
      const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      return {
        isVip: true,
        subscriptionType: data.subscription_type as 'trial' | 'paid' | 'gifted',
        expiresAt,
        daysRemaining,
        subscription: data as VipSubscription,
      };
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
};
