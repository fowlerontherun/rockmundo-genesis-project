/**
 * Health System Feedback Loops (v1.0.955)
 * 
 * Cross-system interactions between the 4 band health pillars:
 * - Fan Sentiment ↔ Reputation (bad rep erodes sentiment; devoted fans boost rep)
 * - Media Cycle ↔ Reputation (oversaturation damages rep; peak + good rep = sentiment boost)
 * - Morale ↔ Sentiment (low morale → worse gigs → sentiment loss; fan love boosts morale)
 * - Morale ↔ Media (peak media + low morale = drama risk; high morale + media = better coverage)
 *
 * Each function returns a delta (positive or negative) to be applied during daily processing.
 */

export interface HealthSnapshot {
  sentimentScore: number;    // -100 to 100
  mediaIntensity: number;    // 0-100
  mediaFatigue: number;      // 0-100
  reputationScore: number;   // -100 to 100
  moraleScore: number;       // 0-100
}

export interface FeedbackDeltas {
  sentimentDelta: number;
  reputationDelta: number;
  moraleDelta: number;
  mediaIntensityDelta: number;
  mediaFatigueDelta: number;
  triggers: string[];  // human-readable descriptions of what fired
}

/**
 * Calculate all cross-system feedback deltas for one daily tick.
 * Deltas are intentionally small (±0.5–3) to create gradual drift, not sudden swings.
 */
export function calculateFeedbackDeltas(snapshot: HealthSnapshot): FeedbackDeltas {
  const {
    sentimentScore,
    mediaIntensity,
    mediaFatigue,
    reputationScore,
    moraleScore,
  } = snapshot;

  const deltas: FeedbackDeltas = {
    sentimentDelta: 0,
    reputationDelta: 0,
    moraleDelta: 0,
    mediaIntensityDelta: 0,
    mediaFatigueDelta: 0,
    triggers: [],
  };

  // ─── Reputation → Sentiment ───────────────────────────────────────
  // Toxic reputation slowly poisons fan sentiment
  if (reputationScore <= -40) {
    deltas.sentimentDelta -= 1.5;
    deltas.triggers.push("Toxic reputation eroding fan sentiment");
  } else if (reputationScore <= -20) {
    deltas.sentimentDelta -= 0.5;
    deltas.triggers.push("Controversial reputation slightly hurting sentiment");
  }
  // Beloved/iconic reputation slowly uplifts sentiment
  if (reputationScore >= 60) {
    deltas.sentimentDelta += 1;
    deltas.triggers.push("Strong reputation boosting fan sentiment");
  }

  // ─── Sentiment → Reputation ───────────────────────────────────────
  // Fanatical fans organically improve public image
  if (sentimentScore >= 70) {
    deltas.reputationDelta += 0.5;
    deltas.triggers.push("Devoted fanbase improving public image");
  }
  // Hostile fans damage public perception
  if (sentimentScore <= -50) {
    deltas.reputationDelta -= 1;
    deltas.triggers.push("Hostile fans damaging public perception");
  }

  // ─── Media Cycle → Reputation ─────────────────────────────────────
  // Media oversaturation causes reputation fatigue
  if (mediaFatigue >= 70) {
    deltas.reputationDelta -= 1;
    deltas.triggers.push("Media oversaturation causing reputation fatigue");
  }
  // Peak media + positive reputation amplifies good image
  if (mediaIntensity >= 60 && reputationScore >= 30) {
    deltas.reputationDelta += 0.5;
    deltas.sentimentDelta += 0.5;
    deltas.triggers.push("Positive media coverage amplifying good reputation");
  }
  // Peak media + bad reputation amplifies damage
  if (mediaIntensity >= 60 && reputationScore <= -20) {
    deltas.reputationDelta -= 1;
    deltas.sentimentDelta -= 1;
    deltas.triggers.push("Media spotlight amplifying negative reputation");
  }

  // ─── Morale → Sentiment ───────────────────────────────────────────
  // Low morale leads to lackluster performances → sentiment drops
  if (moraleScore <= 25) {
    deltas.sentimentDelta -= 1;
    deltas.triggers.push("Low morale causing poor performances, fans notice");
  }
  // Euphoric morale → better shows → sentiment boost
  if (moraleScore >= 85) {
    deltas.sentimentDelta += 0.5;
    deltas.triggers.push("High morale boosting show quality and fan satisfaction");
  }

  // ─── Sentiment → Morale ───────────────────────────────────────────
  // Fan love energizes the band
  if (sentimentScore >= 60) {
    deltas.moraleDelta += 1;
    deltas.triggers.push("Fan devotion boosting band morale");
  }
  // Fan hostility demoralizes
  if (sentimentScore <= -40) {
    deltas.moraleDelta -= 1.5;
    deltas.triggers.push("Fan hostility demoralizing the band");
  }

  // ─── Media → Morale ──────────────────────────────────────────────
  // Peak media attention + low morale = stressful spotlight
  if (mediaIntensity >= 70 && moraleScore <= 35) {
    deltas.moraleDelta -= 1;
    deltas.mediaFatigueDelta += 1;
    deltas.triggers.push("Media pressure stressing low-morale band");
  }
  // Building media buzz with good morale = excitement
  if (mediaIntensity >= 30 && mediaIntensity < 70 && moraleScore >= 60) {
    deltas.moraleDelta += 0.5;
    deltas.triggers.push("Growing media buzz exciting the band");
  }

  // ─── Compound: Downward Spiral Detection ──────────────────────────
  // If 3+ systems are in bad shape, accelerate decline slightly
  const badCount = [
    sentimentScore <= -30,
    reputationScore <= -30,
    moraleScore <= 25,
    mediaFatigue >= 70,
  ].filter(Boolean).length;

  if (badCount >= 3) {
    deltas.sentimentDelta -= 0.5;
    deltas.reputationDelta -= 0.5;
    deltas.moraleDelta -= 0.5;
    deltas.triggers.push("⚠️ Downward spiral: multiple systems in crisis");
  }

  // ─── Compound: Virtuous Cycle Detection ───────────────────────────
  const goodCount = [
    sentimentScore >= 50,
    reputationScore >= 40,
    moraleScore >= 70,
    mediaIntensity >= 30 && mediaFatigue <= 40,
  ].filter(Boolean).length;

  if (goodCount >= 3) {
    deltas.sentimentDelta += 0.5;
    deltas.reputationDelta += 0.5;
    deltas.moraleDelta += 0.5;
    deltas.triggers.push("✨ Virtuous cycle: multiple systems thriving");
  }

  // Round all deltas to 1 decimal
  deltas.sentimentDelta = parseFloat(deltas.sentimentDelta.toFixed(1));
  deltas.reputationDelta = parseFloat(deltas.reputationDelta.toFixed(1));
  deltas.moraleDelta = parseFloat(deltas.moraleDelta.toFixed(1));
  deltas.mediaIntensityDelta = parseFloat(deltas.mediaIntensityDelta.toFixed(1));
  deltas.mediaFatigueDelta = parseFloat(deltas.mediaFatigueDelta.toFixed(1));

  return deltas;
}

/**
 * Apply deltas to a snapshot and return clamped new values.
 */
export function applyFeedbackDeltas(
  snapshot: HealthSnapshot,
  deltas: FeedbackDeltas
): HealthSnapshot {
  return {
    sentimentScore: Math.max(-100, Math.min(100,
      snapshot.sentimentScore + deltas.sentimentDelta)),
    mediaIntensity: Math.max(0, Math.min(100,
      snapshot.mediaIntensity + deltas.mediaIntensityDelta)),
    mediaFatigue: Math.max(0, Math.min(100,
      snapshot.mediaFatigue + deltas.mediaFatigueDelta)),
    reputationScore: Math.max(-100, Math.min(100,
      snapshot.reputationScore + deltas.reputationDelta)),
    moraleScore: Math.max(0, Math.min(100,
      snapshot.moraleScore + deltas.moraleDelta)),
  };
}
