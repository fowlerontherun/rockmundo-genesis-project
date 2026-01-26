import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CityLaws } from "@/types/city-governance";
import { DRUG_POLICY_LABELS } from "@/types/city-governance";
import { 
  DollarSign, Wine, Leaf, Clock, Music, Ticket, 
  Building, PartyPopper, Users 
} from "lucide-react";

interface CityLawsDisplayProps {
  laws: CityLaws | null;
  cityName?: string;
}

export function CityLawsDisplay({ laws, cityName }: CityLawsDisplayProps) {
  if (!laws) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          No laws have been established for this city yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building className="h-5 w-5" />
          {cityName ? `${cityName} City Laws` : "City Laws"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tax Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <LawItem
            icon={<DollarSign className="h-4 w-4" />}
            label="Income Tax"
            value={`${laws.income_tax_rate}%`}
            description="Deducted from all earnings"
          />
          <LawItem
            icon={<DollarSign className="h-4 w-4" />}
            label="Sales Tax"
            value={`${laws.sales_tax_rate}%`}
            description="Added to purchases"
          />
          <LawItem
            icon={<DollarSign className="h-4 w-4" />}
            label="Travel Tax"
            value={`$${laws.travel_tax}`}
            description="Departure fee"
          />
        </div>

        {/* Age & Substance Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <LawItem
            icon={<Wine className="h-4 w-4" />}
            label="Alcohol Age"
            value={`${laws.alcohol_legal_age}+`}
            description="Minimum age for venues"
          />
          <LawItem
            icon={<Leaf className="h-4 w-4" />}
            label="Drug Policy"
            value={DRUG_POLICY_LABELS[laws.drug_policy]}
            variant={laws.drug_policy === "legalized" ? "success" : laws.drug_policy === "prohibited" ? "destructive" : "default"}
          />
        </div>

        {/* Venue Rules */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <LawItem
            icon={<Clock className="h-4 w-4" />}
            label="Noise Curfew"
            value={laws.noise_curfew_hour ? `${laws.noise_curfew_hour}:00` : "None"}
            description="Gigs after this face fines"
          />
          <LawItem
            icon={<Ticket className="h-4 w-4" />}
            label="Busking License"
            value={laws.busking_license_fee > 0 ? `$${laws.busking_license_fee}` : "Free"}
          />
          <LawItem
            icon={<Building className="h-4 w-4" />}
            label="Venue Permit"
            value={`$${laws.venue_permit_cost}`}
          />
        </div>

        {/* Genre Rules */}
        {(laws.prohibited_genres.length > 0 || laws.promoted_genres.length > 0) && (
          <div className="space-y-2">
            {laws.prohibited_genres.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-destructive flex items-center gap-1">
                  <Music className="h-4 w-4" /> Prohibited:
                </span>
                {laws.prohibited_genres.map((genre) => (
                  <Badge key={genre} variant="destructive">{genre}</Badge>
                ))}
              </div>
            )}
            {laws.promoted_genres.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-green-600 flex items-center gap-1">
                  <Music className="h-4 w-4" /> Promoted:
                </span>
                {laws.promoted_genres.map((genre) => (
                  <Badge key={genre} variant="outline" className="border-green-500 text-green-600">{genre}</Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Other Rules */}
        <div className="flex flex-wrap gap-2">
          <Badge variant={laws.festival_permit_required ? "secondary" : "outline"}>
            <PartyPopper className="h-3 w-3 mr-1" />
            Festival Permit: {laws.festival_permit_required ? "Required" : "Not Required"}
          </Badge>
          {laws.max_concert_capacity && (
            <Badge variant="secondary">
              <Users className="h-3 w-3 mr-1" />
              Max Capacity: {laws.max_concert_capacity.toLocaleString()}
            </Badge>
          )}
          {laws.community_events_funding > 0 && (
            <Badge variant="outline" className="border-green-500 text-green-600">
              Community Funding: ${laws.community_events_funding}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface LawItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  description?: string;
  variant?: "default" | "success" | "destructive";
}

function LawItem({ icon, label, value, description, variant = "default" }: LawItemProps) {
  const valueColor = variant === "success" 
    ? "text-green-600" 
    : variant === "destructive" 
      ? "text-destructive" 
      : "text-foreground";

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
      <div className="text-muted-foreground mt-0.5">{icon}</div>
      <div>
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className={`font-semibold ${valueColor}`}>{value}</div>
        {description && (
          <div className="text-xs text-muted-foreground">{description}</div>
        )}
      </div>
    </div>
  );
}
