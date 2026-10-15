import { applyRecordingQualityBoost, selectRecordingQualityBoost } from "./recordingUnderworldBoost.ts";

const end = "2026-10-15T20:00:00.000Z";
const row = {
  profile_id: "p1", source_purchase_id: "purchase-1",
  boost_type: "recording_quality_boost", boost_value: 35,
  started_at: "2026-10-15T19:00:00.000Z",
  expires_at: "2026-10-16T19:00:00.000Z", is_active: true,
};

Deno.test("recording boost requires paid provenance and an actual booked performer", () => {
  const eligible = selectRecordingQualityBoost([row], new Set(["p1"]), end);
  if (eligible?.percent !== 35 || eligible?.purchaseId !== "purchase-1")
    throw new Error("valid recording boost missing");
  if (selectRecordingQualityBoost([row], new Set(["p2"]), end))
    throw new Error("unbooked profile cannot boost another recording");
  if (selectRecordingQualityBoost([{ ...row, source_purchase_id: null }], new Set(["p1"]), end))
    throw new Error("unpaid/legacy boost was accepted");
});

Deno.test("recording boost excludes expiry, future starts and forged values", () => {
  const invalid = [
    { ...row, started_at: "2026-10-15T21:00:00Z" },
    { ...row, expires_at: end },
    { ...row, is_active: false },
    { ...row, boost_value: 999 },
    { ...row, boost_value: 1.5 },
    { ...row, boost_type: "gig_quality_boost" },
  ];
  for (const candidate of invalid) {
    if (selectRecordingQualityBoost([candidate], new Set(["p1"]), end))
      throw new Error("invalid booster was accepted");
  }
});

Deno.test("recording boost picks strongest valid effect without stacking", () => {
  const weak = { ...row, boost_value: 15, source_purchase_id: "purchase-2" };
  const selected = selectRecordingQualityBoost([weak, row], new Set(["p1"]), end);
  if (selected?.percent !== 35) throw new Error("stacked or chose weaker boost");
  if (applyRecordingQualityBoost(600, 35) !== 810) throw new Error("boost formula incorrect");
  if (applyRecordingQualityBoost(950, 35) !== 1000) throw new Error("quality ceiling broken");
  if (applyRecordingQualityBoost(600, 999) !== 600) throw new Error("invalid percentage accepted");
});
