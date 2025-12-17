import { useQuery } from "@tanstack/react-query";
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
import { ChevronDown, User, Users } from "lucide-react";

interface TwaaterAccountSwitcherProps {
  currentAccount: {
    id: string;
    owner_type: string;
    display_name: string;
    handle: string;
  };
  userId: string;
  onSwitch: (accountId: string) => void;
}

export const TwaaterAccountSwitcher = ({
  currentAccount,
  userId,
  onSwitch,
}: TwaaterAccountSwitcherProps) => {
  // Fetch all accounts the user can post as (personal + band accounts)
  const { data: accounts = [] } = useQuery({
    queryKey: ["twaater-accounts-for-user", userId],
    queryFn: async () => {
      // Get personal account
      const { data: personalAccount } = await supabase
        .from("twaater_accounts")
        .select("id, owner_type, display_name, handle")
        .eq("owner_type", "persona")
        .eq("owner_id", userId)
        .single();

      // Get user's bands
      const { data: memberships } = await supabase
        .from("band_members")
        .select("band_id, band:bands(id, name)")
        .eq("user_id", userId);

      const bandIds = memberships?.map((m) => m.band_id) || [];

      // Get band twaater accounts
      let bandAccounts: any[] = [];
      if (bandIds.length > 0) {
        const { data: existingBandAccounts } = await supabase
          .from("twaater_accounts")
          .select("id, owner_type, display_name, handle, owner_id")
          .eq("owner_type", "band")
          .in("owner_id", bandIds);

        bandAccounts = existingBandAccounts || [];

        // Auto-create missing band accounts
        for (const membership of memberships || []) {
          const band = membership.band as any;
          if (band && !bandAccounts.find((a) => a.owner_id === band.id)) {
            const handle = band.name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 15);
            const { data: newAccount } = await supabase
              .from("twaater_accounts")
              .insert({
                owner_type: "band",
                owner_id: band.id,
                handle: handle + Math.floor(Math.random() * 1000),
                display_name: band.name,
              })
              .select("id, owner_type, display_name, handle, owner_id")
              .single();

            if (newAccount) bandAccounts.push(newAccount);
          }
        }
      }

      return [personalAccount, ...bandAccounts].filter(Boolean);
    },
    enabled: !!userId,
  });

  return (
    <DropdownMenu>
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
