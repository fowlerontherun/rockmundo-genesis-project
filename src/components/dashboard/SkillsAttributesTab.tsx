import { useState, useEffect, useCallback } from "react";
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
  const [activityBonusXp, setActivityBonusXp] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchData = useCallback(async () => {
    if (!profile?.id) return;
    
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

    // Fetch activity bonus XP from experience_ledger
    const { data: activityXpData } = await supabase
      .from("experience_ledger")
      .select("xp_amount")
      .eq("profile_id", profile.id)
      .in("activity_type", [
        "busking_session",
        "mentor_session", 
        "university_attendance",
        "exercise",
        "meditation",
        "book_reading",
        "rest",
        "nutrition",
        "therapy",
        "admin_grant",
        "birthday_reward",
        "weekly_bonus"
      ]);
    
    if (activityXpData) {
      const totalBonus = activityXpData.reduce((sum, entry) => sum + (entry.xp_amount || 0), 0);
      setActivityBonusXp(totalBonus);
    }
  }, [profile?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  const handleRefresh = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

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
        activityBonusXp={activityBonusXp}
      />

      <DailyStipendCard lastClaimDate={lastClaimDate} onClaimed={handleRefresh} />

      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Attributes</h2>
        <AttributePanel attributes={rawAttributes} xpBalance={xpBalance} onXpSpent={handleRefresh} />
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Skills</h2>
        <SkillTree xpBalance={xpBalance} onXpSpent={handleRefresh} />
      </div>
    </div>
  );
};
