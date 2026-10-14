export interface FundingBalanceSnapshot {
  currencyCode: string;
  sourceBalanceMinor: number;
  amountMinor: number;
  resultingSourceBalanceMinor: number;
  treasuryBalanceMinor: number;
  resultingTreasuryBalanceMinor: number;
  treasuryWillBeCreated: boolean;
}

export const MAX_FUNDING_PREVIEW_AGE_MS = 120_000;

/** Reconfirm a live server preview before spending; never trust a cached browser balance. */
export function fundingPreviewStillCurrent(
  oldPreview: FundingBalanceSnapshot,
  currentPreview: FundingBalanceSnapshot,
  previewedAt: number | null,
  now: number,
): boolean {
  return previewedAt !== null &&
    Number.isFinite(previewedAt) &&
    now >= previewedAt &&
    now - previewedAt <= MAX_FUNDING_PREVIEW_AGE_MS &&
    oldPreview.currencyCode === currentPreview.currencyCode &&
    oldPreview.amountMinor === currentPreview.amountMinor &&
    oldPreview.sourceBalanceMinor === currentPreview.sourceBalanceMinor &&
    oldPreview.treasuryBalanceMinor === currentPreview.treasuryBalanceMinor &&
    oldPreview.resultingSourceBalanceMinor === currentPreview.resultingSourceBalanceMinor &&
    oldPreview.resultingTreasuryBalanceMinor === currentPreview.resultingTreasuryBalanceMinor &&
    oldPreview.treasuryWillBeCreated === currentPreview.treasuryWillBeCreated;
}
