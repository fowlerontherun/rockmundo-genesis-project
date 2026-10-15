/**
 * Recording-quality boost, evaluated by the trusted completion worker against
 * the booked performers' paid, unexpired purchases. Only the strongest
 * eligible effect applies; never add percentages from overlapping boosters.
 * The recording outcome scale is 0..1000 (not 0..100).
 */
export type RecordingBoostRow = {
  profile_id: string;
  source_purchase_id: string | null;
  boost_type: string;
  boost_value: number;
  started_at: string;
  expires_at: string;
  is_active: boolean;
};

export function selectRecordingQualityBoost(
  rows: readonly RecordingBoostRow[],
  participantIds: ReadonlySet<string>,
  scheduledEndIso: string,
): { percent: number; purchaseId: string } | null {
  const at = Date.parse(scheduledEndIso);
  if (!Number.isFinite(at)) return null;
  const valid = rows.filter(row => {
    const started = Date.parse(row.started_at);
    const expires = Date.parse(row.expires_at);
    return row.is_active === true &&
      row.boost_type === "recording_quality_boost" &&
      !!row.source_purchase_id &&
      participantIds.has(row.profile_id) &&
      Number.isFinite(started) && Number.isFinite(expires) &&
      started <= at && at < expires &&
      Number.isInteger(row.boost_value) &&
      row.boost_value >= 1 && row.boost_value <= 50;
  });
  valid.sort((a, b) => b.boost_value - a.boost_value ||
    String(a.source_purchase_id).localeCompare(String(b.source_purchase_id)));
  return valid.length ? {
    percent: valid[0].boost_value,
    purchaseId: valid[0].source_purchase_id!,
  } : null;
}

export function applyRecordingQualityBoost(
  baseQuality: number,
  percent: number,
): number {
  if (!Number.isFinite(baseQuality)) throw new Error("recording_quality_invalid");
  const validPercent = Number.isInteger(percent) && percent >= 1 && percent <= 50 ? percent : 0;
  return Math.round(Math.min(1000, Math.max(0, baseQuality) * (1 + validPercent / 100)));
}
