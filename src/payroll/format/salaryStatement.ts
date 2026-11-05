/**
 * The salary statement format, learned from the office's "Statement of Salary" workbook.
 *
 * One sheet holds one employee's salary for one financial year:
 *
 *   row 2   organisation name (E2)
 *   row 4   "Statement of Salary for the year 2025-26" (F4)
 *   row 7   "Name of employee:  …" (A7) and "Designation:  …" (J7)
 *   row 9   column headings (A9:Q9, listed in COLUMNS below)
 *   row 10+ one row per month, March to February (salary for March is paid in April),
 *           then arrear rows such as "DA ARR" or "Inc. Arrear"
 *   TOTAL   =SUM of every column, followed by signatures ("Dealing Hand", "Checked by", …)
 *
 * A sheet can also hold many employees, one block below the other, each with its own name,
 * headings and TOTAL (blocks may start in a different column). Each block is read on its own.
 *
 * Reading is forgiving: headings are matched by meaning (with spelling mistakes reported),
 * the rows can start anywhere, and extra sheets in the workbook are skipped.
 */

export type PayKey =
  | 'basic'
  | 'npa'
  | 'hra'
  | 'da'
  | 'tpt'
  | 'daOnTa'
  | 'specialPay'
  | 'na'
  | 'hpca'
  | 'others'
  | 'gross'
  | 'incomeTax'
  | 'cghs'
  | 'gis'
  | 'npsEmployee'
  | 'npsGovt'
  | 'ua'
  | 'wa'
  | 'gpf'
  | 'lic'
  | 'hba'
  | 'recovery';

export type ColumnKey = 'month' | PayKey;

export interface ColumnSpec {
  key: ColumnKey;
  /** Heading exactly as the office template writes it. */
  header: string;
  /** Other headings accepted when reading a file. */
  aliases: string[];
  /** Name used on pay slips and in messages. */
  label: string;
  group: 'month' | 'earning' | 'gross' | 'deduction' | 'employer';
  required: boolean;
  /** How the template fills the column: typed in, or worked out by an Excel formula. */
  source: 'typed' | 'formula';
  /** Template formula for row 10 (rates such as DA change during the year). */
  formula?: string;
  description: string;
}

export const COLUMNS: ColumnSpec[] = [
  {
    key: 'month',
    header: 'Month',
    aliases: ['Months', 'Pay Month', 'Month/Year', 'Month Year', 'Period', 'Salary Month'],
    label: 'Month',
    group: 'month',
    required: true,
    source: 'typed',
    description: 'Salary month as a date (shown as Mar-25), or a label such as "DA ARR" for an arrear row.',
  },
  {
    key: 'basic',
    header: 'Pay Band',
    aliases: ['Basic Pay', 'Basic', 'BP', 'B.P.', 'Pay', 'Pay in Pay Band', 'Pay Level', 'Pay Matrix', 'Basic Salary'],
    label: 'Basic pay',
    group: 'earning',
    required: true,
    source: 'typed',
    description: 'Basic pay for the month.',
  },
  {
    key: 'npa',
    header: 'NPA',
    aliases: ['N.P.A.', 'Non Practising Allowance', 'Non Practicing Allowance', 'Non-Practising Allowance'],
    label: 'Non-practising allowance (NPA)',
    group: 'earning',
    required: false,
    source: 'formula',
    formula: 'ROUND(B10*20%,0)',
    description: '20% of basic pay. Basic pay + NPA may not exceed ₹2,37,500, so it is typed in once the cap applies.',
  },
  {
    key: 'hra',
    header: 'HRA',
    aliases: ['H.R.A.', 'House Rent Allowance'],
    label: 'House rent allowance (HRA)',
    group: 'earning',
    required: false,
    source: 'formula',
    formula: 'B10*30%',
    description: 'Share of basic pay: 30% in X-class cities, 20% in Y, 10% in Z.',
  },
  {
    key: 'da',
    header: 'DA',
    aliases: ['D.A.', 'Dearness Allowance'],
    label: 'Dearness allowance (DA)',
    group: 'earning',
    required: true,
    source: 'formula',
    formula: 'ROUND((B10+C10)*53%,0)',
    description: 'DA rate × (basic pay + NPA). The rate changes in January and July.',
  },
  {
    key: 'tpt',
    header: 'TPT',
    aliases: ['TA', 'T.A.', 'TPTA', 'Transport Allowance', 'Transport'],
    label: 'Transport allowance',
    group: 'earning',
    required: false,
    source: 'typed',
    description: 'Transport allowance for the month.',
  },
  {
    key: 'daOnTa',
    header: 'Da on TA',
    aliases: ['DA on TA', 'DA on TPT', 'DA on TPTA', 'DA on Transport Allowance', 'DA/TA', 'DA TA'],
    label: 'DA on transport allowance',
    group: 'earning',
    required: false,
    source: 'formula',
    formula: 'F10*53%',
    description: 'DA rate × transport allowance.',
  },
  {
    key: 'specialPay',
    header: 'S.Pay',
    aliases: ['S. Pay', 'SP', 'Spl Pay', 'Spl. Pay', 'Special Pay'],
    label: 'Special pay',
    group: 'earning',
    required: false,
    source: 'typed',
    description: 'Special pay, if any.',
  },
  {
    key: 'na',
    header: 'NA',
    aliases: ['N.A.', 'Nursing Allowance'],
    label: 'Nursing allowance',
    group: 'earning',
    required: false,
    source: 'typed',
    description: 'Nursing allowance, if any.',
  },
  {
    key: 'hpca',
    header: 'HPCA',
    aliases: ['H.P.C.A.', 'PCA', 'Hospital Patient Care Allowance', 'Patient Care Allowance'],
    label: 'Hospital patient care allowance',
    group: 'earning',
    required: false,
    source: 'typed',
    description: 'Hospital patient care allowance, if any.',
  },
  {
    key: 'others',
    header: 'Others',
    aliases: ['Other', 'Other Allowance', 'Other Allowances', 'Misc', 'Miscellaneous'],
    label: 'Other allowances',
    group: 'earning',
    required: false,
    source: 'typed',
    description: 'Any other taxable pay for the month.',
  },
  {
    key: 'gross',
    header: 'GROSS PAY',
    aliases: ['Gross', 'Gross Salary', 'Total Pay', 'Gross Total', 'Total Earnings', 'Gross Amount'],
    label: 'Gross pay',
    group: 'gross',
    required: false,
    source: 'formula',
    formula: 'SUM(B10:K10)',
    description: 'Sum of the pay columns (Pay Band to Others).',
  },
  {
    key: 'incomeTax',
    header: 'I.T. Ded.',
    aliases: ['IT Ded', 'I.T.', 'IT', 'Income Tax', 'Income Tax Ded', 'IT Deduction', 'Income Tax Deducted', 'TDS', 'I.Tax'],
    label: 'Income tax (TDS)',
    group: 'deduction',
    required: false,
    source: 'typed',
    description: 'Income tax deducted from the month’s salary. Leave it blank for months not deducted yet.',
  },
  {
    key: 'cghs',
    header: 'CGHS',
    aliases: ['C.G.H.S.', 'CGHS Contribution', 'CGHS Ded'],
    label: 'CGHS contribution',
    group: 'deduction',
    required: false,
    source: 'typed',
    description: 'CGHS contribution deducted from salary.',
  },
  {
    key: 'gis',
    header: 'GIS',
    aliases: ['G.I.S.', 'CGEGIS', 'Group Insurance', 'CGEGIS/GIS'],
    label: 'Group insurance (CGEGIS)',
    group: 'deduction',
    required: false,
    source: 'typed',
    description: 'Central Government Employees Group Insurance subscription.',
  },
  {
    key: 'npsEmployee',
    header: 'NPS(10%)',
    aliases: ['NPS 10%', 'NPS (10%)', 'NPS Employee', 'Employee NPS', 'NPS Tier I', 'NPS Emp'],
    label: 'NPS – employee share (10%)',
    group: 'deduction',
    required: false,
    source: 'formula',
    formula: 'ROUND((B10+C10+E10)*10%,0)',
    description: 'Employee’s NPS contribution: 10% of (basic pay + NPA + DA).',
  },
  {
    key: 'npsGovt',
    header: 'NPS(14%)',
    aliases: ['NPS 14%', 'NPS (14%)', 'NPS Govt', 'Govt NPS', 'NPS Employer', 'Employer NPS', 'NPS Govt Contribution'],
    label: 'NPS – Government share (14%)',
    group: 'employer',
    required: false,
    source: 'formula',
    formula: 'ROUND((B10+C10+E10)*14%,0)',
    description: 'Government’s NPS contribution: 14% of (basic pay + NPA + DA). Not paid out, but taxable salary.',
  },
  // Columns some statements add. They go after the office template's 17 columns when written back.
  {
    key: 'ua',
    header: 'UA',
    aliases: ['U.A.', 'Uniform Allowance', 'Dress Allowance', 'Dress All', 'Dress Allce', 'Dress', 'Uniform'],
    label: 'Uniform allowance',
    group: 'earning',
    required: false,
    source: 'typed',
    description: 'Uniform (dress) allowance, taxable as salary.',
  },
  {
    key: 'wa',
    header: 'WA',
    aliases: ['W.A.', 'Washing Allowance', 'Washing All', 'Washing Allce', 'Wash All'],
    label: 'Washing allowance',
    group: 'earning',
    required: false,
    source: 'typed',
    description: 'Washing allowance, taxable as salary.',
  },
  {
    key: 'gpf',
    header: 'GPF',
    aliases: ['G.P.F.', 'G.P.F', 'GPF Subscription', 'General Provident Fund'],
    label: 'GPF subscription',
    group: 'deduction',
    required: false,
    source: 'typed',
    description: 'General Provident Fund subscription (old pension scheme). Counts under 80C in the old regime.',
  },
  {
    key: 'lic',
    header: 'LIC',
    aliases: ['L.I.C.', 'L.I.C', 'LIC Premium'],
    label: 'LIC premium',
    group: 'deduction',
    required: false,
    source: 'typed',
    description: 'Life insurance premium deducted from salary. Counts under 80C in the old regime.',
  },
  {
    key: 'hba',
    header: 'H.B.A',
    aliases: ['HBA', 'H.B.A.', 'House Building Advance'],
    label: 'House building advance (HBA)',
    group: 'deduction',
    required: false,
    source: 'typed',
    description: 'House building advance recovery.',
  },
  {
    key: 'recovery',
    header: 'Pay Recovery',
    aliases: ['Recovery of pay', 'Recovery', 'Pay Rec', 'Excess Pay Recovery', 'Recovery of Excess Pay'],
    label: 'Pay recovery',
    group: 'deduction',
    required: false,
    source: 'typed',
    description: 'Recovery of pay paid in excess earlier.',
  },
];

/** The office template's columns, A to Q; the rest are written only when a statement has them. */
export const TEMPLATE_KEYS: ColumnKey[] = COLUMNS.slice(0, 17).map(c => c.key);

export const PAY_KEYS = COLUMNS.filter(c => c.key !== 'month').map(c => c.key as PayKey);
export const EARNING_KEYS = COLUMNS.filter(c => c.group === 'earning').map(c => c.key as PayKey);
export const DEDUCTION_KEYS: PayKey[] = ['incomeTax', 'cghs', 'gis', 'npsEmployee', 'gpf', 'lic', 'hba', 'recovery'];

export function columnSpec(key: ColumnKey): ColumnSpec {
  const spec = COLUMNS.find(c => c.key === key);
  if (!spec)
    throw new Error(`Unknown column ${key}`);
  return spec;
}

/** Excel column letter of each column in the template (A for Month … Q for NPS(14%)). */
export function templateLetter(key: ColumnKey): string {
  return String.fromCharCode(65 + COLUMNS.findIndex(c => c.key === key));
}

/** Where the template puts things; used when writing a statement back out. */
export const TEMPLATE_LAYOUT = {
  organisationCell: 'E2',
  titleCell: 'F4',
  nameCell: 'A7',
  designationCell: 'J7',
  headerRow: 9,
  firstDataRow: 10,
  signatures: ['Dealing Hand', 'Checked by', 'D.D. Incharge'],
} as const;

/** Rows whose first cell is one of these words end the table. */
export const TOTAL_LABELS = ['total', 'grand total', 'totals'];

/** Basic pay + NPA may not exceed this (7th CPC). */
export const NPA_CEILING = 237500;
