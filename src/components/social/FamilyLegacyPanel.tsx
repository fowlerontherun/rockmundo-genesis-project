// Family & Legacy Interface — Family tree and generational gameplay
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ScoreGauge } from "./ScoreGauge";
import { motion } from "framer-motion";
import {
  Users, Crown, Heart, Baby, TrendingUp, Star, Shield,
  Sparkles, AlertTriangle, Music, Activity,
} from "lucide-react";

interface FamilyMember {
  id: string;
  name: string;
  relationship: string; // "self", "partner", "child", "parent", "sibling"
  fame: number;
  level: number;
  traits: string[];
  isActive: boolean;
  emotionalStability: number; // 0-100
}

interface FamilyLegacyProps {
  familyMembers?: FamilyMember[];
  legacyPressure?: number;    // 0-100
  fameInheritance?: number;   // percentage modifier
  className?: string;
}

const RELATIONSHIP_COLORS: Record<string, string> = {
  self: "border-primary/50 bg-primary/10",
  partner: "border-social-love/50 bg-social-love/10",
  child: "border-social-chemistry/50 bg-social-chemistry/10",
  parent: "border-social-warm/50 bg-social-warm/10",
  sibling: "border-social-trust/50 bg-social-trust/10",
};

const RELATIONSHIP_ICONS: Record<string, React.ReactNode> = {
  self: <Crown className="h-4 w-4 text-primary" />,
  partner: <Heart className="h-4 w-4 text-social-love" />,
  child: <Baby className="h-4 w-4 text-social-chemistry" />,
  parent: <Users className="h-4 w-4 text-social-warm" />,
  sibling: <Users className="h-4 w-4 text-social-trust" />,
};

function FamilyMemberCard({ member }: { member: FamilyMember }) {
  const colorClass = RELATIONSHIP_COLORS[member.relationship] ?? "border-border/50";
  const icon = RELATIONSHIP_ICONS[member.relationship];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "rounded-lg border-2 p-3 space-y-2 transition-all hover:scale-[1.02]",
        colorClass,
        !member.isActive && "opacity-50",
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <div>
            <p className="text-sm font-bold">{member.name}</p>
            <p className="text-[10px] text-muted-foreground capitalize">{member.relationship}</p>
          </div>
        </div>
        <Badge variant="outline" className="text-[10px]">Lv.{member.level}</Badge>
      </div>

      <div className="flex items-center gap-2 text-[10px]">
        <span className="flex items-center gap-0.5">
          <Star className="h-3 w-3 text-social-warm" />
          {member.fame.toLocaleString()}
        </span>
        <ScoreGauge
          value={member.emotionalStability}
          label=""
          color={member.emotionalStability >= 50 ? "social-loyalty" : "social-tension"}
          size="sm"
          showValue={false}
          className="flex-1"
        />
      </div>

      {member.traits.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {member.traits.slice(0, 3).map((trait) => (
            <Badge key={trait} variant="secondary" className="text-[9px] px-1 py-0">{trait}</Badge>
          ))}
        </div>
      )}
    </motion.div>
  );
}

export function FamilyLegacyPanel({
  familyMembers = [],
  legacyPressure = 0,
  fameInheritance = 0,
  className,
}: FamilyLegacyProps) {
  // Group by relationship type
  const self = familyMembers.find(m => m.relationship === "self");
  const partner = familyMembers.filter(m => m.relationship === "partner");
  const children = familyMembers.filter(m => m.relationship === "child");
  const parents = familyMembers.filter(m => m.relationship === "parent");
  const siblings = familyMembers.filter(m => m.relationship === "sibling");

  return (
    <div className={cn("space-y-4", className)}>
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-social-warm" />
            Family & Legacy
          </CardTitle>
          <CardDescription>
            Your family tree, inherited traits, and generational legacy.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Legacy Metrics */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-border/50 p-3 bg-muted/20 text-center space-y-1">
              <Crown className="h-5 w-5 mx-auto text-social-warm" />
              <p className="text-lg font-oswald font-bold">{fameInheritance}%</p>
              <p className="text-[10px] text-muted-foreground">Fame Inheritance</p>
            </div>
            <div className="rounded-lg border border-border/50 p-3 bg-muted/20 text-center space-y-1">
              <Activity className="h-5 w-5 mx-auto text-social-chemistry" />
              <ScoreGauge
                value={legacyPressure}
                label=""
                color={legacyPressure > 60 ? "social-tension" : "social-trust"}
                size="sm"
                showValue={false}
              />
              <p className="font-oswald font-bold">{legacyPressure}</p>
              <p className="text-[10px] text-muted-foreground">Legacy Pressure</p>
            </div>
            <div className="rounded-lg border border-border/50 p-3 bg-muted/20 text-center space-y-1">
              <Users className="h-5 w-5 mx-auto text-social-trust" />
              <p className="text-lg font-oswald font-bold">{familyMembers.length}</p>
              <p className="text-[10px] text-muted-foreground">Family Size</p>
            </div>
          </div>

          {/* Family Tree Visualization */}
          <div className="space-y-3">
            {/* Parents Row */}
            {parents.length > 0 && (
              <div className="space-y-1">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Parents</h4>
                <div className="grid grid-cols-2 gap-2">
                  {parents.map(m => <FamilyMemberCard key={m.id} member={m} />)}
                </div>
              </div>
            )}

            {/* Self + Partner Row */}
            <div className="space-y-1">
              <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">You & Partner</h4>
              <div className="grid grid-cols-2 gap-2">
                {self && <FamilyMemberCard member={self} />}
                {partner.map(m => <FamilyMemberCard key={m.id} member={m} />)}
                {!self && partner.length === 0 && (
                  <div className="col-span-2 rounded-lg border border-dashed border-border/50 p-6 text-center text-xs text-muted-foreground">
                    No family data yet
                  </div>
                )}
              </div>
            </div>

            {/* Children Row */}
            {children.length > 0 && (
              <div className="space-y-1">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Children</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {children.map(m => <FamilyMemberCard key={m.id} member={m} />)}
                </div>
              </div>
            )}

            {/* Siblings */}
            {siblings.length > 0 && (
              <div className="space-y-1">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Siblings</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {siblings.map(m => <FamilyMemberCard key={m.id} member={m} />)}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
