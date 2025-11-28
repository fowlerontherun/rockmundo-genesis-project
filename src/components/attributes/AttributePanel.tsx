import { AttributeCard } from "./AttributeCard";
import type { Tables } from "@/lib/supabase-types";
import { getAttributeValue } from "@/utils/attributeProgression";
import { FULL_ATTRIBUTE_METADATA, type FullAttributeKey } from "@/utils/attributeProgression";

interface AttributePanelProps {
  attributes: Tables<"player_attributes"> | null;
  xpBalance: number;
}

const ATTRIBUTE_CATEGORIES = {
  physical: {
    title: "Physical",
    keys: ["looks", "physical_endurance"] as FullAttributeKey[],
  },
  mental: {
    title: "Mental",
    keys: ["mental_focus", "creative_insight"] as FullAttributeKey[],
  },
  social: {
    title: "Social",
    keys: ["charisma", "social_reach", "crowd_engagement"] as FullAttributeKey[],
  },
  performance: {
    title: "Performance",
    keys: ["stage_presence", "musicality"] as FullAttributeKey[],
  },
  musical: {
    title: "Musical Skills",
    keys: ["musical_ability", "vocal_talent", "rhythm_sense", "technical_mastery"] as FullAttributeKey[],
  },
};

export const AttributePanel = ({ attributes, xpBalance }: AttributePanelProps) => {
  return (
    <div className="space-y-6">
      {Object.entries(ATTRIBUTE_CATEGORIES).map(([categoryKey, category]) => (
        <div key={categoryKey} className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">{category.title}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {category.keys.map((key) => {
              const metadata = FULL_ATTRIBUTE_METADATA[key];
              const currentValue = getAttributeValue(attributes, key);
              
              return (
                <AttributeCard
                  key={key}
                  attributeKey={key}
                  label={metadata.label}
                  description={metadata.description}
                  currentValue={currentValue}
                  xpBalance={xpBalance}
                  affectedSystems={metadata.affectedSystems}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
