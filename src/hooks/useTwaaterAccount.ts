import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import type { Database } from "@/lib/supabase-types";

type TwaaterAccount = Database["public"]["Tables"]["twaater_accounts"]["Row"];
type TwaaterAccountInsert = Database["public"]["Tables"]["twaater_accounts"]["Insert"];
type TwaaterAccountUpdate = Partial<Pick<
  TwaaterAccount,
  "handle" | "display_name" | "bio" | "location" | "website_url" | "banner_url"
>>;

const accountErrorMessage = (error: any) => {
  const message = String(error?.message || "");
  if (error?.code === "23505" && /handle/i.test(message)) return "That Twaater handle is already taken.";
  if (error?.code === "23514" || /handle_format/i.test(message)) {
    return "Handles can only contain letters, numbers and underscores.";
  }
  if (/row-level security|permission denied/i.test(message)) {
    return "You don't have permission to manage that Twaater account.";
  }
  return message || "Please try again.";
};

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
        description: accountErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const updateAccountMutation = useMutation({
    mutationFn: async (updates: TwaaterAccountUpdate) => {
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
        description: accountErrorMessage(error),
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
