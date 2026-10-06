import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Plus, User, Users } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface TwaaterAccountSwitcherProps {
  currentAccount: {
    id: string;
    owner_type: string;
    display_name: string;
    handle: string;
  };
  userId: string;
  profileId: string;
  onSwitch: (accountId: string) => void;
}

const BAND_POSTING_ROLES = new Set(["leader", "founder", "co-leader", "co_leader", "manager"]);

export const TwaaterAccountSwitcher = ({
  currentAccount,
  userId,
  profileId,
  onSwitch,
}: TwaaterAccountSwitcherProps) => {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: switcherData } = useQuery({
    queryKey: ["twaater-accounts-for-user", userId, profileId],
    queryFn: async () => {
      const { data: personalAccount, error: personalError } = await supabase
        .from("twaater_accounts")
        .select("id, owner_type, display_name, handle, owner_id")
        .eq("owner_type", "persona")
        .eq("owner_id", profileId)
        .maybeSingle();

      if (personalError) throw personalError;

      const { data: memberships, error: membershipsError } = await supabase
        .from("band_members")
        .select("band_id, role, member_status, is_touring_member, user_id, profile_id, band:bands(id, name, leader_id)")
        .or(`user_id.eq.${userId},profile_id.eq.${profileId}`)
        .eq("member_status", "active");

      if (membershipsError) throw membershipsError;

      const manageableMemberships = (memberships || []).filter((membership: any) => {
        if (membership.is_touring_member) return false;
        const role = String(membership.role || "").toLowerCase();
        const leaderId = membership.band?.leader_id;
        return BAND_POSTING_ROLES.has(role) || leaderId === userId || leaderId === profileId;
      });

      const bandIds = Array.from(new Set(manageableMemberships.map((membership: any) => membership.band_id)));
      let bandAccounts: any[] = [];

      if (bandIds.length > 0) {
        const { data: existingBandAccounts, error: bandAccountsError } = await supabase
          .from("twaater_accounts")
          .select("id, owner_type, display_name, handle, owner_id")
          .eq("owner_type", "band")
          .in("owner_id", bandIds);

        if (bandAccountsError) throw bandAccountsError;
        bandAccounts = existingBandAccounts || [];
      }

      const uniqueAccounts = new Map<string, any>();
      for (const account of [personalAccount, ...bandAccounts].filter(Boolean)) {
        uniqueAccounts.set(account.id, account);
      }

      const existingBandIds = new Set(bandAccounts.map((account) => account.owner_id));
      const uniqueMissingBands = new Map<string, any>();
      for (const membership of manageableMemberships) {
        const band = membership.band as any;
        if (band?.id && !existingBandIds.has(band.id)) uniqueMissingBands.set(band.id, band);
      }

      return {
        accounts: Array.from(uniqueAccounts.values()),
        missingBands: Array.from(uniqueMissingBands.values()),
      };
    },
    enabled: open && !!userId && !!profileId,
    staleTime: 5 * 60 * 1000,
  });

  const accounts = switcherData?.accounts || [];
  const missingBands = switcherData?.missingBands || [];

  const createBandAccount = useMutation({
    mutationFn: async (band: { id: string; name: string }) => {
      const baseHandle = String(band.name || "band")
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, "")
        .slice(0, 40) || "band";
      const suffix = String(band.id).replace(/-/g, "").slice(0, 6);

      const { data, error } = await supabase
        .from("twaater_accounts")
        .insert({
          owner_type: "band",
          owner_id: band.id,
          handle: `${baseHandle}_${suffix}`.slice(0, 50),
          display_name: band.name,
        })
        .select("id, owner_type, display_name, handle, owner_id")
        .maybeSingle();

      if (!error && data) return data;
      if (error?.code !== "23505") throw error || new Error("Band account was not created");

      const { data: existing, error: existingError } = await supabase
        .from("twaater_accounts")
        .select("id, owner_type, display_name, handle, owner_id")
        .eq("owner_type", "band")
        .eq("owner_id", band.id)
        .maybeSingle();

      if (existingError || !existing) throw existingError || new Error("Band account was not created");
      return existing;
    },
    onSuccess: (account) => {
      queryClient.invalidateQueries({ queryKey: ["twaater-accounts-for-user", userId, profileId] });
      onSwitch(account.id);
      setOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Couldn't create band Twaater account",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2 border-[hsl(var(--twaater-border))]">
          {currentAccount.owner_type === "persona" ? (
            <User className="h-4 w-4" />
          ) : (
            <Users className="h-4 w-4" />
          )}
          <span className="max-w-[100px] truncate">{currentAccount.display_name}</span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56" style={{ backgroundColor: "hsl(var(--twaater-card))" }}>
        <DropdownMenuLabel>Post as</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {accounts.map((account: any) => (
          <DropdownMenuItem
            key={account.id}
            className={`gap-2 cursor-pointer ${account.id === currentAccount.id ? "bg-[hsl(var(--twaater-purple)_/_0.2)]" : ""}`}
            onClick={() => onSwitch(account.id)}
          >
            {account.owner_type === "persona" ? (
              <User className="h-4 w-4" />
            ) : (
              <Users className="h-4 w-4" />
            )}
            <span className="truncate">{account.display_name}</span>
            <span className="text-xs text-muted-foreground ml-auto">@{account.handle}</span>
          </DropdownMenuItem>
        ))}
        {missingBands.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Create band account</DropdownMenuLabel>
            {missingBands.map((band: any) => (
              <DropdownMenuItem
                key={band.id}
                className="gap-2 cursor-pointer"
                disabled={createBandAccount.isPending}
                onClick={() => createBandAccount.mutate({ id: band.id, name: band.name })}
              >
                <Plus className="h-4 w-4" />
                <span className="truncate">{band.name}</span>
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
