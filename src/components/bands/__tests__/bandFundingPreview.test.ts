import { describe, expect, it } from "vitest";
import {
  fundingPreviewStillCurrent,
  MAX_FUNDING_PREVIEW_AGE_MS,
  type FundingBalanceSnapshot,
} from "../bandFundingPreview";

const initial: FundingBalanceSnapshot = {
  currencyCode: "GBP",
  amountMinor: 2000,
  sourceBalanceMinor: 10000,
  resultingSourceBalanceMinor: 8000,
  treasuryBalanceMinor: 5000,
  resultingTreasuryBalanceMinor: 7000,
  treasuryWillBeCreated: false,
};

describe("band funding confirmation previews", () => {
  it("#4016 permits only fresh unchanged balances and transfer terms", () => {
    expect(fundingPreviewStillCurrent(initial, { ...initial }, 1000, 2000)).toBe(true);
    expect(fundingPreviewStillCurrent(initial, { ...initial }, 1000, 1000 + MAX_FUNDING_PREVIEW_AGE_MS + 1)).toBe(false);
    expect(fundingPreviewStillCurrent(initial, { ...initial }, null, 2000)).toBe(false);
  });

  it("#4016 rejects changed funding source, treasury balance, currency and amount", () => {
    for (const patch of [
      { sourceBalanceMinor: 9000 },
      { treasuryBalanceMinor: 8000 },
      { amountMinor: 2500 },
      { currencyCode: "EUR" },
      { treasuryWillBeCreated: true },
      { resultingSourceBalanceMinor: 7500 },
      { resultingTreasuryBalanceMinor: 7500 },
    ]) {
      expect(fundingPreviewStillCurrent(initial, { ...initial, ...patch }, 1000, 2000)).toBe(false);
    }
  });

  it("#4016 rejects clock anomalies and invalid preview age", () => {
    expect(fundingPreviewStillCurrent(initial, initial, 3000, 2000)).toBe(false);
    expect(fundingPreviewStillCurrent(initial, initial, Number.NaN, 2000)).toBe(false);
  });
});
