import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import type { Database } from "@/lib/supabase-types";

type TwaaterAccount = Database["public"]["Tables"]["twaater_accounts"]["Row"];
type TwaaterAccountInsert = Database["public"]["Tables"]["twaater_accounts"]["Insert"];

export const useTwaaterAccount = (ownerType: "persona" | "band", ownerId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: account, isLoading } = useQuery({
    queryKey: ["twaater-account", ownerType, ownerId],
    queryFn: async () => {
      if (!ownerId) return null;

      const { data, error } = await supabase
        .from("twaater_accounts")
        .select("*")
        .eq("owner_type", ownerType)
        .eq("owner_id", ownerId)
        .maybeSingle();

      if (error) throw error;
      return data as TwaaterAccount | null;
    },
    enabled: !!ownerId,
  });

  const createAccountMutation = useMutation({
    mutationFn: async (accountData: TwaaterAccountInsert) => {
      const { data, error } = await supabase
        .from("twaater_accounts")
        .insert(accountData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["twaater-account", ownerType, ownerId] });
      toast({
        title: "Twaater account created!",
        description: "Welcome to Twaater! Start posting to build your following.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create account",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateAccountMutation = useMutation({
    mutationFn: async (updates: Partial<TwaaterAccount>) => {
      if (!account?.id) throw new Error("No account to update");

      const { data, error } = await supabase
        .from("twaater_accounts")
        .update(updates)
        .eq("id", account.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["twaater-account", ownerType, ownerId] });
      toast({
        title: "Account updated",
        description: "Your Twaater profile has been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    account,
    isLoading,
    createAccount: createAccountMutation.mutate,
    updateAccount: updateAccountMutation.mutate,
    isCreating: createAccountMutation.isPending,
    isUpdating: updateAccountMutation.isPending,
  };
};
