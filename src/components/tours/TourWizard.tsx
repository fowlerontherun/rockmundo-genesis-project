import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTourWizard } from '@/hooks/useTourWizard';
import { TOUR_SCOPE_REQUIREMENTS, VENUE_SIZE_REQUIREMENTS, CONTINENTS, TOUR_BUS_DAILY_COST } from '@/lib/tourTypes';
import { StartingCitySelector } from './StartingCitySelector';
import { VenueFilters } from './VenueFilters';
import { TicketPricingSlider } from './TicketPricingSlider';
import { StageSetupPicker } from './StageSetupPicker';
import { SupportArtistPicker } from './SupportArtistPicker';
import { TourBudgetSummary } from './TourBudgetSummary';
import { Calendar, MapPin, Music, Bus, Plane, Check, Lock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TourWizardProps {
  bandId: string;
  onComplete?: () => void;
  onCancel?: () => void;
}

export function TourWizard({ bandId, onComplete, onCancel }: TourWizardProps) {
  const wizard = useTourWizard({ bandId });
  const progress = ((wizard.currentStep + 1) / wizard.totalSteps) * 100;

  const handleBook = () => {
    wizard.bookTour(undefined, {
      onSuccess: () => onComplete?.(),
    });
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Plan Your Tour</CardTitle>
            <CardDescription>
              Step {wizard.currentStep + 1} of {wizard.totalSteps}: {wizard.stepNames[wizard.currentStep]}
            </CardDescription>
          </div>
          <Badge variant="outline">{wizard.band?.name || 'Loading...'}</Badge>
        </div>
        <Progress value={progress} className="mt-4" />
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Step 0: Basics */}
        {wizard.currentStep === 0 && (
          <div className="space-y-4">
            <div>
              <Label>Tour Name</Label>
              <Input
                value={wizard.state.name}
                onChange={(e) => wizard.updateState({ name: e.target.value })}
                placeholder="Summer 2025 World Tour"
              />
            </div>
            
            <StartingCitySelector
              value={wizard.state.startingCityId}
              onChange={(cityId) => wizard.updateState({ startingCityId: cityId })}
              currentCityId={wizard.playerCurrentCityId}
            />
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={wizard.state.startDate}
                  onChange={(e) => wizard.updateState({ startDate: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div>
                <Label>Duration (days)</Label>
                <Input
                  type="number"
                  value={wizard.state.durationDays || ''}
                  onChange={(e) => wizard.updateState({ durationDays: e.target.value ? parseInt(e.target.value) : null })}
                  placeholder="30"
                  min={7}
                  max={365}
                />
              </div>
            </div>
            
            <div>
              <Label>Minimum Rest Days Between Shows: {wizard.state.minRestDays}</Label>
              <Slider
                value={[wizard.state.minRestDays]}
                onValueChange={([v]) => wizard.updateState({ minRestDays: v })}
                min={1}
                max={7}
                step={1}
                className="mt-2"
              />
            </div>
            
            {wizard.setlists && wizard.setlists.length > 0 && (
              <div>
                <Label>Setlist (optional)</Label>
                <Select value={wizard.state.setlistId || ''} onValueChange={(v) => wizard.updateState({ setlistId: v || null })}>
                  <SelectTrigger><SelectValue placeholder="Select a setlist" /></SelectTrigger>
                  <SelectContent>
                    {wizard.setlists.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        {/* Step 1: Scope */}
        {wizard.currentStep === 1 && (
          <div className="space-y-4">
            <p className="text-muted-foreground">Select the scope based on your band's fame ({wizard.band?.fame?.toLocaleString() || 0}).</p>
            <RadioGroup value={wizard.state.scope} onValueChange={(v: any) => wizard.setScope(v)}>
              {Object.entries(TOUR_SCOPE_REQUIREMENTS).map(([key, req]) => {
                const locked = !wizard.scopeAccess[key as keyof typeof wizard.scopeAccess];
                return (
                  <div key={key} className={cn("flex items-center space-x-3 p-4 border rounded-lg", locked && "opacity-50")}>
                    <RadioGroupItem value={key} disabled={locked} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{req.label}</span>
                        {locked && <Lock className="h-4 w-4" />}
                      </div>
                      <p className="text-sm text-muted-foreground">{req.description}</p>
                      <p className="text-xs text-muted-foreground">Requires {req.fame.toLocaleString()} fame</p>
                    </div>
                    {!locked && <Check className="h-5 w-5 text-green-500" />}
                  </div>
                );
              })}
            </RadioGroup>
          </div>
        )}

        {/* Step 2: Countries */}
        {wizard.currentStep === 2 && (
          <div className="space-y-4">
            {wizard.state.scope !== 'country' && (
              <div>
                <Label>Select Continents</Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {CONTINENTS.map(c => (
                    <label key={c} className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-muted/50">
                      <Checkbox checked={wizard.state.selectedContinents.includes(c)} onCheckedChange={() => wizard.toggleContinent(c)} />
                      <span className="text-sm">{c}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div>
              <Label>Select Countries ({wizard.state.selectedCountries.length} selected)</Label>
              <div className="grid grid-cols-3 gap-2 mt-2 max-h-64 overflow-y-auto">
                {wizard.availableCountries?.map(country => (
                  <label key={country} className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-muted/50">
                    <Checkbox checked={wizard.state.selectedCountries.includes(country)} onCheckedChange={() => wizard.toggleCountry(country)} />
                    <span className="text-sm">{country}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Venues */}
        {wizard.currentStep === 3 && (
          <div className="space-y-4">
            <VenueFilters
              selectedCountries={wizard.state.selectedCountries}
              countryFilter={wizard.state.venueCountryFilter}
              cityFilter={wizard.state.venueCityFilter}
              genreFilter={wizard.state.venueGenreFilter}
              onCountryFilterChange={(v) => wizard.updateState({ venueCountryFilter: v })}
              onCityFilterChange={(v) => wizard.updateState({ venueCityFilter: v })}
              onGenreFilterChange={(v) => wizard.updateState({ venueGenreFilter: v })}
            />
            
            <div>
              <Label>Maximum Venue Capacity</Label>
              <Select value={wizard.state.maxVenueCapacity.toString()} onValueChange={(v) => wizard.updateState({ maxVenueCapacity: parseInt(v) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(VENUE_SIZE_REQUIREMENTS).map(([key, req]) => {
                    const locked = (wizard.band?.total_fans || 0) < req.minFans;
                    return (
                      <SelectItem key={key} value={req.maxCapacity.toString()} disabled={locked}>
                        {req.label} - {req.description} {locked && '(Locked)'}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Venue Types</Label>
              <div className="grid grid-cols-4 gap-2 mt-2">
                {['club', 'bar', 'theater', 'concert_hall', 'arena', 'stadium', 'outdoor'].map(type => (
                  <label key={type} className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-muted/50">
                    <Checkbox
                      checked={wizard.state.venueTypes.includes(type)}
                      onCheckedChange={(checked) => {
                        wizard.updateState({
                          venueTypes: checked 
                            ? [...wizard.state.venueTypes, type]
                            : wizard.state.venueTypes.filter(t => t !== type)
                        });
                      }}
                    />
                    <span className="text-sm capitalize">{type.replace('_', ' ')}</span>
                  </label>
                ))}
              </div>
            </div>
            
            <p className="text-sm text-muted-foreground">
              {wizard.venuesLoading ? 'Loading...' : `${wizard.venueMatches.length} venues matched for ${wizard.venueMatches.length} shows`}
            </p>
          </div>
        )}

        {/* Step 4: Tickets */}
        {wizard.currentStep === 4 && (
          <TicketPricingSlider
            value={wizard.state.customTicketPrice}
            onChange={(price) => wizard.updateState({ customTicketPrice: price })}
            recommendedPrice={wizard.recommendedTicketPrice}
            bandFame={wizard.band?.fame || 0}
            averageCapacity={wizard.venueMatches.length > 0 
              ? wizard.venueMatches.reduce((sum, v) => sum + v.capacity, 0) / wizard.venueMatches.length 
              : 500}
          />
        )}

        {/* Step 5: Stage Setup */}
        {wizard.currentStep === 5 && (
          <StageSetupPicker
            value={wizard.state.stageSetupTier}
            onChange={(tier) => wizard.updateState({ stageSetupTier: tier })}
            bandFame={wizard.band?.fame || 0}
            showCount={wizard.venueMatches.length}
          />
        )}

        {/* Step 6: Travel */}
        {wizard.currentStep === 6 && (
          <div className="space-y-4">
            <RadioGroup value={wizard.state.travelMode} onValueChange={(v: any) => wizard.updateState({ travelMode: v })}>
              <div className="flex items-center space-x-3 p-4 border rounded-lg">
                <RadioGroupItem value="auto" />
                <Plane className="h-5 w-5" />
                <div>
                  <span className="font-medium">Auto-Book Travel</span>
                  <p className="text-sm text-muted-foreground">System books optimal flights/trains</p>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-4 border rounded-lg">
                <RadioGroupItem value="tour_bus" />
                <Bus className="h-5 w-5" />
                <div>
                  <span className="font-medium">Tour Bus</span>
                  <p className="text-sm text-muted-foreground">${TOUR_BUS_DAILY_COST}/day (fixed rate)</p>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-4 border rounded-lg">
                <RadioGroupItem value="manual" />
                <MapPin className="h-5 w-5" />
                <div>
                  <span className="font-medium">Manual Booking</span>
                  <p className="text-sm text-muted-foreground">Book your own travel</p>
                </div>
              </div>
            </RadioGroup>
          </div>
        )}

        {/* Step 7: Support Artist */}
        {wizard.currentStep === 7 && wizard.canInviteSupportArtist && (
          <SupportArtistPicker
            value={wizard.state.supportBandId}
            valueName={wizard.state.supportBandName}
            onChange={(bandId, bandName, share) => wizard.updateState({ 
              supportBandId: bandId, 
              supportBandName: bandName,
              supportRevenueShare: share 
            })}
            headlinerBandId={bandId}
            headlinerFame={wizard.band?.fame || 0}
            tourDates={wizard.venueMatches.map(v => v.date)}
          />
        )}

        {/* Step 8: Review */}
        {wizard.currentStep === 8 && (
          <div className="space-y-4">
            <div className="p-4 border rounded-lg bg-muted/30 space-y-2">
              <p><strong>Tour:</strong> {wizard.state.name}</p>
              <p><strong>Shows:</strong> {wizard.venueMatches.length} venues</p>
              <p><strong>Countries:</strong> {wizard.state.selectedCountries.join(', ')}</p>
              {wizard.state.supportBandName && (
                <p><strong>Support:</strong> {wizard.state.supportBandName}</p>
              )}
            </div>
            
            <TourBudgetSummary
              estimate={wizard.costEstimate}
              stageSetupTier={wizard.state.stageSetupTier}
              supportBandName={wizard.state.supportBandName}
              supportRevenueShare={wizard.state.supportRevenueShare}
              sponsorName={wizard.state.sponsorName}
              sponsorCash={wizard.state.sponsorCashValue}
              bandBalance={wizard.band?.band_balance || 0}
            />
            
            {(wizard.band?.band_balance || 0) < wizard.costEstimate.netUpfrontCost && (
              <div className="flex items-center gap-2 p-4 bg-destructive/10 text-destructive rounded-lg">
                <AlertCircle className="h-5 w-5" />
                <span>Insufficient funds. Need ${wizard.costEstimate.netUpfrontCost.toLocaleString()}</span>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={wizard.currentStep === 0 ? onCancel : wizard.prevStep}>
            {wizard.currentStep === 0 ? 'Cancel' : 'Previous'}
          </Button>
          {wizard.currentStep < wizard.totalSteps - 1 ? (
            <Button onClick={wizard.nextStep} disabled={!wizard.canProceed}>Continue</Button>
          ) : (
            <Button onClick={handleBook} disabled={!wizard.canProceed || wizard.isBooking}>
              {wizard.isBooking ? 'Booking...' : `Book Tour ($${wizard.costEstimate.netUpfrontCost.toLocaleString()})`}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
