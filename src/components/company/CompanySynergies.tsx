import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Link2, TrendingUp, Check, Lock } from "lucide-react";
import { useCompanies } from "@/hooks/useCompanies";

interface SynergyDefinition {
  id: string;
  name: string;
  description: string;
  requires: string[];
  bonus: string;
  bonusValue: number;
  icon: string;
}

const SYNERGY_DEFINITIONS: SynergyDefinition[] = [
  {
    id: 'label_venue',
    name: 'Label-Venue Partnership',
    description: 'Book your label artists at your own venues',
    requires: ['label', 'venue'],
    bonus: '15% venue fee discount',
    bonusValue: 15,
    icon: '🎪',
  },
  {
    id: 'venue_security',
    name: 'Venue-Security Synergy',
    description: 'Use your security firm for venue events',
    requires: ['venue', 'security'],
    bonus: '25% security cost reduction',
    bonusValue: 25,
    icon: '🛡️',
  },
  {
    id: 'factory_logistics',
    name: 'Factory-Logistics Chain',
    description: 'Ship merchandise via your logistics company',
    requires: ['factory', 'logistics'],
    bonus: '20% shipping discount',
    bonusValue: 20,
    icon: '📦',
  },
  {
    id: 'studio_label',
    name: 'Studio-Label Connection',
    description: 'Record label artists at your studio',
    requires: ['recording_studio', 'label'],
    bonus: '10% recording cost reduction',
    bonusValue: 10,
    icon: '🎵',
  },
  {
    id: 'full_vertical',
    name: 'Vertical Integration',
    description: 'Own all business types for maximum synergy',
    requires: ['label', 'venue', 'security', 'logistics', 'factory', 'recording_studio'],
    bonus: '35% discount on all internal services',
    bonusValue: 35,
    icon: '👑',
  },
];

export function CompanySynergies() {
  const { data: companies } = useCompanies();
  
  // Use string array instead of Set for simpler type handling
  const ownedTypes: string[] = companies
    ?.filter(c => c.company_type !== 'holding')
    .map(c => c.company_type) || [];

  const synergies = SYNERGY_DEFINITIONS.map(synergy => ({
    ...synergy,
    active: synergy.requires.every(type => ownedTypes.includes(type)),
    progress: synergy.requires.filter(type => ownedTypes.includes(type)).length,
    total: synergy.requires.length,
  }));

  const activeSynergies = synergies.filter(s => s.active);
  const inactiveSynergies = synergies.filter(s => !s.active);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Empire Synergies
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {activeSynergies.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-primary flex items-center gap-2">
              <Check className="h-4 w-4" />
              Active Synergies ({activeSynergies.length})
            </h4>
            {activeSynergies.map((synergy) => (
              <div 
                key={synergy.id}
                className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{synergy.icon}</span>
                  <div>
                    <div className="font-medium text-primary">{synergy.name}</div>
                    <div className="text-sm text-muted-foreground">{synergy.description}</div>
                  </div>
                </div>
                <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  {synergy.bonus}
                </Badge>
              </div>
            ))}
          </div>
        )}

        {inactiveSynergies.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Locked Synergies ({inactiveSynergies.length})
            </h4>
            {inactiveSynergies.map((synergy) => (
              <div 
                key={synergy.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50 opacity-60"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl grayscale">{synergy.icon}</span>
                  <div>
                    <div className="font-medium">{synergy.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {synergy.progress}/{synergy.total} requirements met
                    </div>
                  </div>
                </div>
                <Badge variant="secondary">
                  {synergy.bonus}
                </Badge>
              </div>
            ))}
          </div>
        )}

        {synergies.length === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            <Link2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Synergies unlock when you own multiple business types</p>
          </div>
        )}

        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground text-center">
            Synergy discounts are automatically applied when using your own companies' services
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// Helper to detect active synergies for a given company set
export function detectActiveSynergies(companyTypes: string[]): SynergyDefinition[] {
  return SYNERGY_DEFINITIONS.filter(synergy => 
    synergy.requires.every(type => companyTypes.includes(type))
  );
}

// Helper to calculate total synergy discount
export function calculateSynergyDiscount(companyTypes: string[], targetService: string): number {
  const activeSynergies = detectActiveSynergies(companyTypes);
  
  // Check for relevant synergies based on target service
  let discount = 0;
  
  activeSynergies.forEach(synergy => {
    if (synergy.id === 'full_vertical') {
      discount = Math.max(discount, synergy.bonusValue);
    } else if (synergy.id === 'venue_security' && targetService === 'security') {
      discount = Math.max(discount, synergy.bonusValue);
    } else if (synergy.id === 'factory_logistics' && targetService === 'logistics') {
      discount = Math.max(discount, synergy.bonusValue);
    } else if (synergy.id === 'label_venue' && targetService === 'venue') {
      discount = Math.max(discount, synergy.bonusValue);
    } else if (synergy.id === 'studio_label' && targetService === 'recording_studio') {
      discount = Math.max(discount, synergy.bonusValue);
    }
  });
  
  return discount;
}
