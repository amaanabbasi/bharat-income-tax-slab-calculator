import type { ColumnKey, PayKey } from './format/salaryStatement';

export type Severity = 'error' | 'warning' | 'info';

/** Something worth telling the user about a file, with where it is and how to fix it. */
export interface Issue {
  severity: Severity;
  message: string;
  fix?: string;
  sheet?: string;
  /** A1 reference, e.g. "A18". */
  cell?: string;
}

export type PayValues = Record<PayKey, number>;

export interface StatementRow {
  kind: 'month' | 'arrear';
  /** "Mar 2025" for months, the sheet's own label ("DA ARR") for arrears. */
  label: string;
  year?: number;
  /** 1–12 for month rows. */
  month?: number;
  /** Row number in the sheet; projected rows have none. */
  sheetRow?: number;
  values: PayValues;
  /** The I.T. Ded. cell was empty, i.e. tax not deducted for this month yet. */
  taxPending: boolean;
  /** Filled in from the latest month because the sheet had no salary for it. */
  projected?: boolean;
}

export interface SalaryStatement {
  id: string;
  fileName: string;
  sheetName: string;
  organisation: string;
  title: string;
  /** "2025-26" */
  financialYear: string;
  employeeName: string;
  designation: string;
  rows: StatementRow[];
  /** Columns found in the file. */
  columns: ColumnKey[];
  signatures: string[];
  /** First month of the pay year: 3 for March–February statements, 4 for April–March. */
  startMonth: number;
}

export function emptyPayValues(): PayValues {
  return {
    basic: 0,
    npa: 0,
    hra: 0,
    da: 0,
    tpt: 0,
    daOnTa: 0,
    specialPay: 0,
    na: 0,
    hpca: 0,
    others: 0,
    gross: 0,
    incomeTax: 0,
    cghs: 0,
    gis: 0,
    npsEmployee: 0,
    npsGovt: 0,
  };
}

export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTH_FULL_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function monthLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}
