import { type AgeGroup, type FinancialYear, type Regime, isSupportedFy } from '../rules/taxRules';

/**
 * What an employee declares to the pay office on top of the salary statement.
 * Everything is optional: with the defaults the tax is worked out under the new regime
 * on salary alone, which is what the office's computation sheet does.
 */
export interface Declarations {
  regime: Regime;
  ageGroup: AgeGroup;
  /** Tax rules year; null uses the year written on the statement. */
  fyOverride: FinancialYear | null;
  /** Fill months with no salary yet from the latest month (for a mid-year estimate). */
  projectMissingMonths: boolean;
  /** Count NPA as "salary" for the 14% NPS limit and HRA (an allowance, so off by default). */
  npaInSalary: boolean;

  interestSavings: number;
  interestDeposits: number;
  otherIncome: number;
  previousEmployerSalary: number;
  previousEmployerTds: number;

  rentPaid: number;
  metroCity: boolean;
  professionalTax: number;
  includeGisIn80C: boolean;
  investments80C: number;
  nps80CCD1B: number;
  healthInsuranceSelf: number;
  healthInsuranceParents: number;
  parentsSenior: boolean;
  homeLoanInterest: number;
  educationLoanInterest: number;
  donations80G: number;
  otherDeductions: number;

  relief89: number;
}

export const DEFAULT_DECLARATIONS: Declarations = {
  regime: 'new',
  ageGroup: 'below60',
  fyOverride: null,
  projectMissingMonths: true,
  npaInSalary: false,
  interestSavings: 0,
  interestDeposits: 0,
  otherIncome: 0,
  previousEmployerSalary: 0,
  previousEmployerTds: 0,
  rentPaid: 0,
  metroCity: true,
  professionalTax: 0,
  includeGisIn80C: true,
  investments80C: 0,
  nps80CCD1B: 0,
  healthInsuranceSelf: 0,
  healthInsuranceParents: 0,
  parentsSenior: false,
  homeLoanInterest: 0,
  educationLoanInterest: 0,
  donations80G: 0,
  otherDeductions: 0,
  relief89: 0,
};

export type FieldKind = 'amount' | 'yesno' | 'regime' | 'age' | 'fy';

export interface DeclarationField {
  key: keyof Declarations;
  /** Label in the Declarations sheet and the form. */
  label: string;
  aliases: string[];
  kind: FieldKind;
  group: 'profile' | 'income' | 'old' | 'relief';
  help: string;
  /** Regimes in which the value changes the tax. */
  regimes: Regime[];
}

const BOTH: Regime[] = ['new', 'old'];
const OLD: Regime[] = ['old'];

export const DECLARATION_FIELDS: DeclarationField[] = [
  { key: 'regime', label: 'Tax regime (New / Old)', aliases: ['Regime', 'Tax regime'], kind: 'regime', group: 'profile', help: 'New regime is the default; the old regime applies only if the employee opted for it.', regimes: BOTH },
  { key: 'ageGroup', label: 'Age group (Below 60 / 60-79 / 80+)', aliases: ['Age', 'Age group', 'Age category'], kind: 'age', group: 'profile', help: 'Changes the old-regime slabs and the 80D and 80TTB limits.', regimes: OLD },
  { key: 'fyOverride', label: 'Tax rules for year (leave blank to use the statement year)', aliases: ['Financial year', 'Tax year', 'Rules year'], kind: 'fy', group: 'profile', help: 'Normally the year in the statement title.', regimes: BOTH },
  { key: 'projectMissingMonths', label: 'Project months not yet drawn (Yes / No)', aliases: ['Project remaining months', 'Projection'], kind: 'yesno', group: 'profile', help: 'Fills months without salary from the latest month, for a full-year estimate.', regimes: BOTH },
  { key: 'npaInSalary', label: 'Count NPA as salary for NPS and HRA limits (Yes / No)', aliases: ['NPA in salary'], kind: 'yesno', group: 'profile', help: 'NPA is an allowance, so the 14% NPS limit is normally worked on basic pay + DA only.', regimes: BOTH },

  { key: 'interestSavings', label: 'Savings bank interest', aliases: ['Savings interest', 'SB interest'], kind: 'amount', group: 'income', help: 'Added to income; old regime allows 80TTA (₹10,000) or 80TTB for seniors.', regimes: BOTH },
  { key: 'interestDeposits', label: 'Fixed deposit and other interest', aliases: ['FD interest', 'Deposit interest', 'Interest on deposits'], kind: 'amount', group: 'income', help: 'Added to income; counts for 80TTB (seniors, old regime).', regimes: BOTH },
  { key: 'otherIncome', label: 'Any other income', aliases: ['Other income', 'Income from other sources'], kind: 'amount', group: 'income', help: 'Taxed at slab rates.', regimes: BOTH },
  { key: 'previousEmployerSalary', label: 'Salary from previous employer this year', aliases: ['Previous employer salary', 'Previous employer income'], kind: 'amount', group: 'income', help: 'Taxable salary already received from another office this year (Form 12B).', regimes: BOTH },
  { key: 'previousEmployerTds', label: 'Tax deducted by previous employer', aliases: ['Previous employer TDS', 'TDS by previous employer'], kind: 'amount', group: 'income', help: 'Counted as tax already paid.', regimes: BOTH },

  { key: 'rentPaid', label: 'Rent paid in the year', aliases: ['Rent paid', 'House rent paid', 'Annual rent'], kind: 'amount', group: 'old', help: 'For the HRA exemption u/s 10(13A).', regimes: OLD },
  { key: 'metroCity', label: 'Lives in a metro city for HRA (Yes / No)', aliases: ['Metro city', 'Metro'], kind: 'yesno', group: 'old', help: 'Metro: 50% of salary is exempt at most, otherwise 40%.', regimes: OLD },
  { key: 'professionalTax', label: 'Professional tax', aliases: ['Profession tax', 'PT'], kind: 'amount', group: 'old', help: 'Deductible u/s 16(iii); not levied in Delhi.', regimes: OLD },
  { key: 'includeGisIn80C', label: 'Count GIS in 80C (Yes / No)', aliases: ['GIS in 80C'], kind: 'yesno', group: 'old', help: 'CGEGIS subscription is usually claimed under 80C.', regimes: OLD },
  { key: 'investments80C', label: '80C investments besides salary deductions (PPF, LIC, tuition fees, home-loan principal, ELSS…)', aliases: ['80C investments', '80C', 'Section 80C'], kind: 'amount', group: 'old', help: 'GIS and the 10% NPS share come from the statement; add the rest here.', regimes: OLD },
  { key: 'nps80CCD1B', label: 'Extra NPS contribution outside salary - 80CCD(1B)', aliases: ['80CCD(1B)', 'Additional NPS'], kind: 'amount', group: 'old', help: 'Up to ₹50,000 together with any salary NPS not used in 80C.', regimes: OLD },
  { key: 'healthInsuranceSelf', label: 'Health insurance premium - self, spouse, children (80D)', aliases: ['Mediclaim self', '80D self', 'Health insurance'], kind: 'amount', group: 'old', help: 'CGHS from the statement is added automatically.', regimes: OLD },
  { key: 'healthInsuranceParents', label: 'Health insurance premium - parents (80D)', aliases: ['Mediclaim parents', '80D parents'], kind: 'amount', group: 'old', help: 'Separate limit of ₹25,000 (₹50,000 if a parent is 60+).', regimes: OLD },
  { key: 'parentsSenior', label: 'Parents are senior citizens (Yes / No)', aliases: ['Parents senior'], kind: 'yesno', group: 'old', help: 'Raises the parents’ 80D limit.', regimes: OLD },
  { key: 'homeLoanInterest', label: 'Home loan interest - self-occupied house (24(b))', aliases: ['Home loan interest', 'Housing loan interest', '24(b)'], kind: 'amount', group: 'old', help: 'Up to ₹2,00,000; not allowed in the new regime.', regimes: OLD },
  { key: 'educationLoanInterest', label: 'Education loan interest (80E)', aliases: ['80E', 'Education loan'], kind: 'amount', group: 'old', help: 'No upper limit.', regimes: OLD },
  { key: 'donations80G', label: 'Donations - eligible amount (80G)', aliases: ['80G', 'Donations'], kind: 'amount', group: 'old', help: 'Enter the deductible amount after the 50%/100% rules.', regimes: OLD },
  { key: 'otherDeductions', label: 'Other deductions (80DD, 80DDB, 80U…)', aliases: ['Other deductions'], kind: 'amount', group: 'old', help: 'Enter the eligible amount.', regimes: OLD },

  { key: 'relief89', label: 'Relief u/s 89 for arrears (from Form 10E)', aliases: ['Relief 89', 'Section 89 relief', '89 relief'], kind: 'amount', group: 'relief', help: 'When arrears of earlier years are taxed this year.', regimes: BOTH },
];

export function fieldByLabel(text: string): DeclarationField | undefined {
  const wanted = normaliseLabel(text);
  if (!wanted)
    return undefined;
  return DECLARATION_FIELDS.find(field => normaliseLabel(field.label) === wanted || field.aliases.some(alias => normaliseLabel(alias) === wanted))
    ?? DECLARATION_FIELDS.find(field => wanted.startsWith(normaliseLabel(field.label.split('(')[0])));
}

function normaliseLabel(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

type ParsedValue = { ok: true, value: Declarations[keyof Declarations] } | { ok: false, reason: string };

/** Turns a cell from the Declarations sheet into a value; blanks are skipped by the caller. */
export function parseDeclarationValue(field: DeclarationField, raw: unknown): ParsedValue {
  const text = String(raw ?? '').trim();
  const lower = text.toLowerCase();
  switch (field.kind) {
    case 'amount': {
      const value = typeof raw === 'number' ? raw : Number(text.replace(/[₹,\s]|rs\.?/gi, ''));
      if (!Number.isFinite(value))
        return { ok: false, reason: `"${text}" is not an amount` };
      if (value < 0)
        return { ok: false, reason: 'amounts cannot be negative' };
      return { ok: true, value };
    }
    case 'yesno': {
      if (['yes', 'y', 'true', '1'].includes(lower))
        return { ok: true, value: true };
      if (['no', 'n', 'false', '0'].includes(lower))
        return { ok: true, value: false };
      return { ok: false, reason: `write Yes or No (found "${text}")` };
    }
    case 'regime':
      if (lower.includes('old'))
        return { ok: true, value: 'old' };
      if (lower.includes('new') || lower.includes('115bac') || lower.includes('default'))
        return { ok: true, value: 'new' };
      return { ok: false, reason: `write New or Old (found "${text}")` };
    case 'age':
      if (/^\d+$/.test(lower))
        return ageFromNumber(Number(lower));
      // "Below 60" mentions 60, so check it before the senior bands.
      if (/below|under|less|<|general|normal/.test(lower))
        return { ok: true, value: 'below60' };
      if (/80|super/.test(lower))
        return { ok: true, value: 'superSenior' };
      if (/60|senior/.test(lower))
        return { ok: true, value: 'senior' };
      return { ok: false, reason: `write Below 60, 60-79 or 80+ (found "${text}")` };
    case 'fy': {
      const match = text.match(/(20\d{2})\s*[-–/]\s*(\d{2,4})/);
      const fy = match ? `${match[1]}-${match[2].slice(-2)}` : '';
      if (fy && isSupportedFy(fy))
        return { ok: true, value: fy };
      return { ok: false, reason: `use 2024-25, 2025-26 or 2026-27 (found "${text}")` };
    }
  }
}

function ageFromNumber(age: number): ParsedValue {
  if (age >= 80)
    return { ok: true, value: 'superSenior' };
  if (age >= 60)
    return { ok: true, value: 'senior' };
  return { ok: true, value: 'below60' };
}

export function describeValue(field: DeclarationField, value: unknown): string {
  switch (field.kind) {
    case 'yesno':
      return value ? 'Yes' : 'No';
    case 'regime':
      return value === 'old' ? 'Old' : 'New';
    case 'age':
      return value === 'superSenior' ? '80+' : value === 'senior' ? '60-79' : 'Below 60';
    case 'fy':
      return value ? String(value) : '';
    default:
      return String(value ?? 0);
  }
}
