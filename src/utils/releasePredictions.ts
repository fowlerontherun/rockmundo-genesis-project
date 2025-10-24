/**
 * Calculate conservative predictions for release sales and streams
 */

interface ReleasePrediction {
  predictedStreams: {
    weekly: number;
    monthly: number;
    firstYear: number;
  };
  predictedSales: {
    digital: number;
    physical: number;
    total: number;
  };
  predictedRevenue: {
    streaming: number;
    sales: number;
    total: number;
  };
}

interface ReleaseFactors {
  artistFame: number;
  artistPopularity: number;
  songQuality: number;
  bandChemistry?: number;
  releaseType: 'single' | 'ep' | 'album';
  formatTypes: string[]; // 'digital', 'cd', 'vinyl', 'streaming'
  trackCount: number;
}

export function predictReleaseSales(factors: ReleaseFactors): ReleasePrediction {
  const {
    artistFame = 0,
    artistPopularity = 0,
    songQuality = 0,
    bandChemistry = 0,
    releaseType,
    formatTypes,
    trackCount = 1,
  } = factors;

  // Base multipliers (conservative)
  const fameMultiplier = Math.max(1, artistFame / 100);
  const popularityMultiplier = Math.max(1, artistPopularity / 100);
  const qualityMultiplier = Math.max(0.5, songQuality / 100);
  const chemistryMultiplier = Math.max(0.8, (bandChemistry || 50) / 100);

  // Release type multipliers
  const releaseTypeMultiplier = {
    single: 1.0,
    ep: 1.3,
    album: 1.8,
  }[releaseType] || 1.0;

  // Base predictions (very conservative)
  const baseWeeklyStreams = 50;
  const baseDigitalSales = 10;
  const basePhysicalSales = 5;

  // Calculate streaming predictions
  const weeklyStreams = Math.round(
    baseWeeklyStreams *
      fameMultiplier *
      popularityMultiplier *
      qualityMultiplier *
      chemistryMultiplier *
      releaseTypeMultiplier *
      trackCount
  );

  const monthlyStreams = weeklyStreams * 4;
  const firstYearStreams = Math.round(
    weeklyStreams * 52 * 0.7 // 30% decay over the year
  );

  // Calculate sales predictions
  const hasDigital = formatTypes.includes('digital') || formatTypes.includes('streaming');
  const hasPhysical = formatTypes.includes('cd') || formatTypes.includes('vinyl');

  const digitalSales = hasDigital
    ? Math.round(
        baseDigitalSales *
          fameMultiplier *
          popularityMultiplier *
          qualityMultiplier *
          releaseTypeMultiplier
      )
    : 0;

  const physicalSales = hasPhysical
    ? Math.round(
        basePhysicalSales *
          fameMultiplier *
          popularityMultiplier *
          qualityMultiplier *
          releaseTypeMultiplier *
          0.6 // Physical sales are typically lower
      )
    : 0;

  // Calculate revenue predictions
  const streamingRevenue = Math.round((firstYearStreams / 1000) * 3); // $3 per 1000 streams (conservative)
  const digitalSalesRevenue = digitalSales * 7; // $7 per digital sale
  const physicalSalesRevenue = physicalSales * 12; // $12 per physical sale

  return {
    predictedStreams: {
      weekly: weeklyStreams,
      monthly: monthlyStreams,
      firstYear: firstYearStreams,
    },
    predictedSales: {
      digital: digitalSales,
      physical: physicalSales,
      total: digitalSales + physicalSales,
    },
    predictedRevenue: {
      streaming: streamingRevenue,
      sales: digitalSalesRevenue + physicalSalesRevenue,
      total: streamingRevenue + digitalSalesRevenue + physicalSalesRevenue,
    },
  };
}
