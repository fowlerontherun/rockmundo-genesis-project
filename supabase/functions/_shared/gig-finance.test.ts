import { describe, expect, it } from 'vitest';
import { calculateGigFinance } from './gig-finance';

const baseline = {
  adjustedTicketRevenue: 10_000, merchandiseRevenue: 500, barEntitlement: 0,
  attendance: 500, capacity: 500, venueBandRevenueShare: 0.7,
  contractedCrewCost: 1_500, existingEquipmentCost: 600, merchandiseCost: 200,
};

describe('canonical gig finance', () => {
  it('does not re-charge club shows for venue hire already paid at booking', () => {
    const result = calculateGigFinance(baseline);
    expect(result.venueShare).toBe(0);
    expect(result.eventStaffing).toBe(0);
    expect(result.totalCosts).toBe(2_300);
    expect(result.netProfit).toBe(8_200);
  });

  it('adds material event operating costs and the contracted venue share at stadium scale', () => {
    const result = calculateGigFinance({
      ...baseline, capacity: 74_310, attendance: 74_310,
      adjustedTicketRevenue: 2_674_000, merchandiseRevenue: 23_401,
      contractedCrewCost: 9_910, existingEquipmentCost: 904, merchandiseCost: 15_445,
    });
    expect(result.venueShare).toBe(802_200);
    expect(result.eventSecurity).toBeGreaterThan(400_000);
    expect(result.stageInfrastructure).toBe(120_000);
    expect(result.netProfit).toBeLessThan(1_100_000);
    expect(result.netProfit).toBeGreaterThan(500_000);
  });

  it('keeps venue fixed costs for undersold stadiums instead of making loss risk disappear', () => {
    const undersold = calculateGigFinance({ ...baseline, capacity: 74_310, attendance: 1000 });
    const soldOut = calculateGigFinance({ ...baseline, capacity: 74_310, attendance: 74_310 });
    expect(undersold.stageInfrastructure).toBe(120_000);
    expect(undersold.netProfit).toBeLessThan(0);
    expect(soldOut.eventStaffing).toBeGreaterThan(undersold.eventStaffing);
  });

  it('never allocates negative shares or more attendees than capacity', () => {
    const result = calculateGigFinance({ ...baseline, capacity: 10000, attendance: 100000, adjustedTicketRevenue: -100, venueBandRevenueShare: 2 });
    expect(result.venueShare).toBe(0);
    expect(result.eventSecurity).toBeLessThanOrEqual(55_000);
    expect(result.grossRevenue).toBeGreaterThanOrEqual(0);
  });

  it('supports venue share records configured as a percentage rather than a fraction', () => {
    const input = { ...baseline, capacity: 50_000, attendance: 30_000 };
    expect(calculateGigFinance({ ...input, venueBandRevenueShare: 70 }).venueShare)
      .toBe(calculateGigFinance({ ...input, venueBandRevenueShare: 0.7 }).venueShare);
  });
});
