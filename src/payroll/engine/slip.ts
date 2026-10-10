import { NPA_CEILING, type PayKey, columnSpec } from '../format/salaryStatement';
import { MONTH_FULL_NAMES, type StatementRow } from '../model';
import { percent, rupeesInWords } from './money';

export interface SlipLine {
  label: string;
  amount: number;
  note?: string;
}

export interface PaySlip {
  /** Stable key for lists: the sheet row, or the label for projected months. */
  key: string;
  kind: 'month' | 'arrear';
  /** "March 2025" or the arrear row's label. */
  period: string;
  title: string;
  projected: boolean;
  earnings: SlipLine[];
  deductions: SlipLine[];
  gross: number;
  totalDeductions: number;
  net: number;
  netInWords: string;
  /** Government NPS share: credited to the employee's PRAN, not paid out. */
  employerNps: number;
  taxPending: boolean;
}

const EARNINGS: PayKey[] = ['basic', 'npa', 'hra', 'da', 'tpt', 'daOnTa', 'specialPay', 'na', 'hpca', 'others'];
const DEDUCTIONS: PayKey[] = ['incomeTax', 'cghs', 'gis', 'npsEmployee'];

function rateOf(part: number, whole: number): string | null {
  if (!part || !whole)
    return null;
  return percent(Math.round((part / whole) * 1000) / 1000);
}

function earningNote(key: PayKey, row: StatementRow): string | undefined {
  const v = row.values;
  switch (key) {
    case 'npa':
      if (v.basic && v.basic + v.npa === NPA_CEILING && Math.round(v.basic * 0.2) !== v.npa)
        return `capped so basic pay + NPA = ₹${NPA_CEILING.toLocaleString('en-IN')}`;
      return rateOf(v.npa, v.basic) ? `${rateOf(v.npa, v.basic)} of basic pay` : undefined;
    case 'hra':
      return rateOf(v.hra, v.basic) ? `${rateOf(v.hra, v.basic)} of basic pay` : undefined;
    case 'da':
      return rateOf(v.da, v.basic + v.npa) ? `${rateOf(v.da, v.basic + v.npa)} of basic pay${v.npa ? ' + NPA' : ''}` : undefined;
    case 'daOnTa':
      return rateOf(v.daOnTa, v.tpt) ? `${rateOf(v.daOnTa, v.tpt)} of transport allowance` : undefined;
    default:
      return undefined;
  }
}

export function buildSlip(row: StatementRow): PaySlip {
  const isMonth = row.kind === 'month' && row.month && row.year;
  const period = isMonth ? `${MONTH_FULL_NAMES[(row.month as number) - 1]} ${row.year}` : row.label;
  // Arrear rows have no rates of their own; months show what each allowance is worked on.
  const earnings: SlipLine[] = EARNINGS
    .filter(key => row.values[key] !== 0 || (isMonth && key === 'basic'))
    .map(key => ({ label: columnSpec(key).label, amount: row.values[key], note: isMonth ? earningNote(key, row) : undefined }));
  const deductions: SlipLine[] = DEDUCTIONS
    .filter(key => row.values[key] !== 0 || (key === 'incomeTax' && isMonth))
    .map(key => ({
      label: columnSpec(key).label,
      amount: row.values[key],
      note: key === 'incomeTax' && row.taxPending ? 'not deducted yet' : undefined,
    }));
  const gross = row.values.gross;
  const totalDeductions = deductions.reduce((sum, line) => sum + line.amount, 0);
  const net = gross - totalDeductions;
  return {
    key: row.sheetRow ? `row-${row.sheetRow}${row.projected ? '-p' : ''}` : `p-${row.label}`,
    kind: row.kind,
    period,
    title: isMonth ? `Pay slip for ${period}` : `Supplementary pay slip: ${period}`,
    projected: Boolean(row.projected),
    earnings,
    deductions,
    gross,
    totalDeductions,
    net,
    netInWords: rupeesInWords(Math.round(net)),
    employerNps: row.values.npsGovt,
    taxPending: row.taxPending,
  };
}
