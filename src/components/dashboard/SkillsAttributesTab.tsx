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

    // Fetch latest daily XP grant (for last claim date)
    const { data: grantData } = await supabase
      .from("profile_daily_xp_grants")
      .select("*")
      .eq("profile_id", profile.id)
      .eq("source", "daily_stipend")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (grantData) {
      setDailyXpGrant(grantData);
    }

    // Fetch yesterday's activity bonus
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayDate = yesterday.toISOString().slice(0, 10);

    const { data: activityGrant } = await supabase
      .from("profile_daily_xp_grants")
      .select("xp_amount")
      .eq("profile_id", profile.id)
      .eq("source", "activity_bonus")
      .eq("grant_date", yesterdayDate)
      .maybeSingle();

    if (activityGrant) {
      setActivityBonusXp(activityGrant.xp_amount || 0);
    } else {
      setActivityBonusXp(0);
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
  }, [profile?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  const handleRefresh = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  // Use dual currency columns, fallback to legacy
  const skillXpBalance = xpWallet?.skill_xp_balance ?? xpWallet?.xp_balance ?? 0;
  const skillXpLifetime = xpWallet?.skill_xp_lifetime ?? xpWallet?.lifetime_xp ?? 0;
  const attributePointsBalance = xpWallet?.attribute_points_balance ?? 0;
  const attributePointsSpent = rawAttributes?.attribute_points_spent ?? 0;
  const streak = xpWallet?.stipend_claim_streak ?? 0;
  const lastClaimDate = xpWallet?.last_stipend_claim_date ?? dailyXpGrant?.created_at;

  return (
    <div className="space-y-6">
      <XpWalletDisplay
        skillXpBalance={skillXpBalance}
        skillXpLifetime={skillXpLifetime}
        attributePointsBalance={attributePointsBalance}
        attributePointsSpent={attributePointsSpent}
        activityBonusXp={activityBonusXp}
        streak={streak}
      />

      <DailyStipendCard 
        lastClaimDate={lastClaimDate} 
        streak={streak}
        lifetimeSxp={skillXpLifetime}
        onClaimed={handleRefresh} 
      />

      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Attributes</h2>
        <AttributePanel 
          attributes={rawAttributes} 
          xpBalance={attributePointsBalance} 
          onXpSpent={handleRefresh} 
        />
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Skills</h2>
        <SkillTree xpBalance={skillXpBalance} onXpSpent={handleRefresh} />
      </div>
    </div>
  );
};
