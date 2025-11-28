import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { XpWalletDisplay } from "@/components/attributes/XpWalletDisplay";
import { DailyStipendCard } from "@/components/attributes/DailyStipendCard";
import { AttributePanel } from "@/components/attributes/AttributePanel";
import { SkillTree } from "@/components/SkillTree";
import type { Database } from "@/lib/supabase-types";

interface SkillsAttributesTabProps {
  profile: any;
}

export const SkillsAttributesTab = ({ profile }: SkillsAttributesTabProps) => {
  const [xpWallet, setXpWallet] = useState<Database["public"]["Tables"]["player_xp_wallet"]["Row"] | null>(null);
  const [dailyXpGrant, setDailyXpGrant] = useState<Database["public"]["Tables"]["profile_daily_xp_grants"]["Row"] | null>(null);
  const [rawAttributes, setRawAttributes] = useState<Database["public"]["Tables"]["player_attributes"]["Row"] | null>(null);

  useEffect(() => {
    if (profile?.id) {
      const fetchData = async () => {
        // Fetch XP wallet
        const { data: walletData } = await supabase
          .from("player_xp_wallet")
          .select("*")
          .eq("profile_id", profile.id)
          .maybeSingle();
        
        if (walletData) {
          setXpWallet(walletData);
        }

        // Fetch daily XP grant
        const { data: grantData } = await supabase
          .from("profile_daily_xp_grants")
          .select("*")
          .eq("profile_id", profile.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (grantData) {
          setDailyXpGrant(grantData);
        }

        // Fetch attributes
        const { data: attrData } = await supabase
          .from("player_attributes")
          .select("*")
          .eq("profile_id", profile.id)
          .maybeSingle();
        
        if (attrData) {
          setRawAttributes(attrData);
        }
      };

      fetchData();
    }
  }, [profile?.id]);

  const xpBalance = xpWallet?.xp_balance ?? 0;
  const lifetimeXp = xpWallet?.lifetime_xp ?? 0;
  const attributePointsAvailable = xpWallet?.attribute_points_earned ?? 0;
  const attributePointsSpent = rawAttributes?.attribute_points_spent ?? 0;
  const lastClaimDate = dailyXpGrant?.created_at;

  return (
    <div className="space-y-6">
      <XpWalletDisplay
        xpBalance={xpBalance}
        lifetimeXp={lifetimeXp}
        attributePointsAvailable={attributePointsAvailable}
        attributePointsSpent={attributePointsSpent}
      />

      <DailyStipendCard lastClaimDate={lastClaimDate} />

      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Attributes</h2>
        <AttributePanel attributes={rawAttributes} xpBalance={xpBalance} />
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Skills</h2>
        <SkillTree />
      </div>
    </div>
  );
};
