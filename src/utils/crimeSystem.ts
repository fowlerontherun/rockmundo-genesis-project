/**
 * Crime → Arrest → Prison pipeline.
 * When players interact with underworld activities, there's a chance of getting caught.
 */

export type CrimeType = 'drug_purchase' | 'drug_use' | 'contraband' | 'illegal_gambling' | 'bribery';

export interface ArrestRollResult {
  arrested: boolean;
  crimeType: CrimeType;
  bailAmount: number;
  sentenceDays: number;
  fameImpact: number;
  description: string;
}

const CRIME_CONFIG: Record<CrimeType, {
  baseArrestChance: number;
  bailRange: [number, number];
  sentenceRange: [number, number];
  fameLoss: number;
  description: string;
}> = {
  drug_purchase: {
    baseArrestChance: 0.08,
    bailRange: [200, 800],
    sentenceRange: [1, 3],
    fameLoss: 50,
    description: 'Caught purchasing illegal substances',
  },
  drug_use: {
    baseArrestChance: 0.05,
    bailRange: [100, 400],
    sentenceRange: [1, 2],
    fameLoss: 30,
    description: 'Caught using illegal substances',
  },
  contraband: {
    baseArrestChance: 0.12,
    bailRange: [500, 2000],
    sentenceRange: [2, 7],
    fameLoss: 100,
    description: 'Caught with contraband goods',
  },
  illegal_gambling: {
    baseArrestChance: 0.06,
    bailRange: [300, 1000],
    sentenceRange: [1, 3],
    fameLoss: 40,
    description: 'Caught at an illegal gambling den',
  },
  bribery: {
    baseArrestChance: 0.10,
    bailRange: [1000, 5000],
    sentenceRange: [3, 10],
    fameLoss: 150,
    description: 'Caught bribing an official',
  },
};

/**
 * Roll for arrest when committing a crime.
 * @param crimeType - type of crime
 * @param cityDrugPolicy - city's drug policy affects arrest chance
 * @param fameLevel - higher fame = more scrutiny
 */
export function rollForArrest(
  crimeType: CrimeType,
  cityDrugPolicy: string = 'prohibited',
  fameLevel: number = 0,
): ArrestRollResult {
  const config = CRIME_CONFIG[crimeType];
  if (!config) {
    return { arrested: false, crimeType, bailAmount: 0, sentenceDays: 0, fameImpact: 0, description: '' };
  }

  // Drug policy modifiers (only for drug-related crimes)
  let policyModifier = 1.0;
  if (crimeType === 'drug_purchase' || crimeType === 'drug_use') {
    switch (cityDrugPolicy) {
      case 'legalized': policyModifier = 0; break;       // Can't be arrested
      case 'decriminalized': policyModifier = 0.2; break; // Very low chance
      case 'medical_only': policyModifier = 0.6; break;   // Reduced chance
      case 'prohibited': policyModifier = 1.0; break;     // Full chance
    }
  }

  // Fame modifier: higher fame = +20% more scrutiny at 5000+ fame
  const fameModifier = 1 + Math.min(0.2, fameLevel / 25000);

  const finalChance = config.baseArrestChance * policyModifier * fameModifier;
  const arrested = Math.random() < finalChance;

  if (!arrested) {
    return { arrested: false, crimeType, bailAmount: 0, sentenceDays: 0, fameImpact: 0, description: '' };
  }

  const [minBail, maxBail] = config.bailRange;
  const [minSentence, maxSentence] = config.sentenceRange;

  return {
    arrested: true,
    crimeType,
    bailAmount: Math.round(minBail + Math.random() * (maxBail - minBail)),
    sentenceDays: Math.round(minSentence + Math.random() * (maxSentence - minSentence)),
    fameImpact: -config.fameLoss,
    description: config.description,
  };
}
