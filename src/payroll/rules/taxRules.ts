/**
 * Income-tax rules for salaried individuals, one entry per financial year.
 * Amounts are in rupees, rates in percent. Section numbers follow the Income-tax Act, 1961,
 * which is what pay offices still quote; from tax year 2026-27 the Income-tax Act, 2025
 * applies with the same rates and limits, and its renumbered sections are listed per year.
 */

export type FinancialYear = '2024-25' | '2025-26' | '2026-27';
export type Regime = 'new' | 'old';
export type AgeGroup = 'below60' | 'senior' | 'superSenior';

export interface Slab {
  /** Upper end of the slab; null for the top slab. */
  upTo: number | null;
  rate: number;
}

export interface SurchargeBand {
  /** Applies when total income exceeds this amount. */
  above: number;
  rate: number;
}

export interface RegimeRules {
  regime: Regime;
  title: string;
  slabs: Record<AgeGroup, Slab[]>;
  standardDeduction: number;
  rebate: { incomeUpTo: number, maxRebate: number, marginalRelief: boolean };
  surcharge: SurchargeBand[];
  /** Section 80CCD(2) limit for Central and State Government employers, as % of salary. */
  govtNpsPercent: number;
}

export interface YearRules {
  fy: FinancialYear;
  assessmentYear: string;
  label: string;
  act: '1961' | '2025';
  cessPercent: number;
  regimes: Record<Regime, RegimeRules>;
  oldRegimeLimits: {
    section80C: number;
    section80CCD1B: number;
    section80DSelf: number;
    section80DSelfSenior: number;
    section80DParents: number;
    section80DParentsSenior: number;
    homeLoanInterest: number;
    section80TTA: number;
    section80TTB: number;
  };
  /** Cities where HRA exemption allows 50% of salary (40% elsewhere). */
  hraMetroCities: string[];
  /** Employer contributions to NPS + PF + superannuation above this are taxable, s.17(2)(vii). */
  employerRetirementCap: number;
  /** Sections renumbered by the Income-tax Act, 2025 (1961 number → 2025 number). */
  newActSections?: Record<string, string>;
}

const OLD_SLABS: Record<AgeGroup, Slab[]> = {
  below60: [
    { upTo: 250000, rate: 0 },
    { upTo: 500000, rate: 5 },
    { upTo: 1000000, rate: 20 },
    { upTo: null, rate: 30 },
  ],
  senior: [
    { upTo: 300000, rate: 0 },
    { upTo: 500000, rate: 5 },
    { upTo: 1000000, rate: 20 },
    { upTo: null, rate: 30 },
  ],
  superSenior: [
    { upTo: 500000, rate: 0 },
    { upTo: 1000000, rate: 20 },
    { upTo: null, rate: 30 },
  ],
};

const NEW_SLABS_2024: Slab[] = [
  { upTo: 300000, rate: 0 },
  { upTo: 700000, rate: 5 },
  { upTo: 1000000, rate: 10 },
  { upTo: 1200000, rate: 15 },
  { upTo: 1500000, rate: 20 },
  { upTo: null, rate: 30 },
];

const NEW_SLABS_2025: Slab[] = [
  { upTo: 400000, rate: 0 },
  { upTo: 800000, rate: 5 },
  { upTo: 1200000, rate: 10 },
  { upTo: 1600000, rate: 15 },
  { upTo: 2000000, rate: 20 },
  { upTo: 2400000, rate: 25 },
  { upTo: null, rate: 30 },
];

const sameForAllAges = (slabs: Slab[]): Record<AgeGroup, Slab[]> => ({ below60: slabs, senior: slabs, superSenior: slabs });

const NEW_SURCHARGE: SurchargeBand[] = [
  { above: 5000000, rate: 10 },
  { above: 10000000, rate: 15 },
  { above: 20000000, rate: 25 },
];

const OLD_SURCHARGE: SurchargeBand[] = [...NEW_SURCHARGE, { above: 50000000, rate: 37 }];

const OLD_REGIME: RegimeRules = {
  regime: 'old',
  title: 'Old tax regime',
  slabs: OLD_SLABS,
  standardDeduction: 50000,
  rebate: { incomeUpTo: 500000, maxRebate: 12500, marginalRelief: false },
  surcharge: OLD_SURCHARGE,
  govtNpsPercent: 14,
};

const OLD_LIMITS: YearRules['oldRegimeLimits'] = {
  section80C: 150000,
  section80CCD1B: 50000,
  section80DSelf: 25000,
  section80DSelfSenior: 50000,
  section80DParents: 25000,
  section80DParentsSenior: 50000,
  homeLoanInterest: 200000,
  section80TTA: 10000,
  section80TTB: 50000,
};

const FOUR_METROS = ['Delhi', 'Mumbai', 'Kolkata', 'Chennai'];

function newRegime(slabs: Slab[], rebate: RegimeRules['rebate']): RegimeRules {
  return {
    regime: 'new',
    title: 'New tax regime (section 115BAC)',
    slabs: sameForAllAges(slabs),
    standardDeduction: 75000,
    rebate,
    surcharge: NEW_SURCHARGE,
    govtNpsPercent: 14,
  };
}

export const YEAR_RULES: Record<FinancialYear, YearRules> = {
  '2024-25': {
    fy: '2024-25',
    assessmentYear: '2025-26',
    label: 'FY 2024-25 (AY 2025-26)',
    act: '1961',
    cessPercent: 4,
    regimes: {
      new: newRegime(NEW_SLABS_2024, { incomeUpTo: 700000, maxRebate: 25000, marginalRelief: true }),
      old: OLD_REGIME,
    },
    oldRegimeLimits: OLD_LIMITS,
    hraMetroCities: FOUR_METROS,
    employerRetirementCap: 750000,
  },
  '2025-26': {
    fy: '2025-26',
    assessmentYear: '2026-27',
    label: 'FY 2025-26 (AY 2026-27)',
    act: '1961',
    cessPercent: 4,
    regimes: {
      new: newRegime(NEW_SLABS_2025, { incomeUpTo: 1200000, maxRebate: 60000, marginalRelief: true }),
      old: OLD_REGIME,
    },
    oldRegimeLimits: OLD_LIMITS,
    hraMetroCities: FOUR_METROS,
    employerRetirementCap: 750000,
  },
  '2026-27': {
    fy: '2026-27',
    assessmentYear: '2027-28',
    label: 'Tax year 2026-27 (Income-tax Act, 2025)',
    act: '2025',
    cessPercent: 4,
    regimes: {
      new: newRegime(NEW_SLABS_2025, { incomeUpTo: 1200000, maxRebate: 60000, marginalRelief: true }),
      old: OLD_REGIME,
    },
    oldRegimeLimits: OLD_LIMITS,
    // Income-tax Rules, 2026 add four cities to the 50% HRA list.
    hraMetroCities: [...FOUR_METROS, 'Bengaluru', 'Hyderabad', 'Pune', 'Ahmedabad'],
    employerRetirementCap: 750000,
    newActSections: { '80C': '123', '80CCD': '124', '80D': '126', '87A': '156', '115BAC': '202' },
  },
};

export const FINANCIAL_YEARS = Object.keys(YEAR_RULES) as FinancialYear[];

export function getYearRules(fy: FinancialYear): YearRules {
  return YEAR_RULES[fy];
}

/** 2025 → "2025-26". */
export function fyFromStartYear(startYear: number): string {
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

export function startYearOf(fy: string): number {
  return Number.parseInt(fy.slice(0, 4), 10);
}

export function isSupportedFy(fy: string): fy is FinancialYear {
  return fy in YEAR_RULES;
}

/** Closest year we have rules for (used when a statement is for an older or newer year). */
export function nearestSupportedFy(fy: string): FinancialYear {
  if (isSupportedFy(fy))
    return fy;
  const start = startYearOf(fy);
  const first = startYearOf(FINANCIAL_YEARS[0]);
  return start < first ? FINANCIAL_YEARS[0] : FINANCIAL_YEARS[FINANCIAL_YEARS.length - 1];
}

export const AGE_GROUP_LABELS: Record<AgeGroup, string> = {
  below60: 'Below 60',
  senior: '60 to 79 (senior citizen)',
  superSenior: '80 or above (super senior citizen)',
};
