import { EARNING_KEYS, PAY_KEYS, columnSpec } from '../format/salaryStatement';
import { type PayValues, type SalaryStatement, type StatementRow, emptyPayValues, monthLabel } from '../model';
import { startYearOf } from '../rules/taxRules';

export interface AnnualSalary {
  /** Month rows in date order (projected ones included), then arrear rows. */
  rows: StatementRow[];
  totals: PayValues;
  projectedMonths: string[];
  /** Months of the pay year with no row and no projection. */
  missingMonths: string[];
  tdsDeducted: number;
  /** Month range that tax was deducted in, e.g. "Mar 2025 – Jan 2026". */
  tdsPeriod: string | null;
  /** Months still to come, where tax can be recovered from salary. */
  pendingTaxMonths: string[];
  arrears: { label: string, amount: number }[];
  components: { key: string, label: string, amount: number }[];
}

/** Calendar (year, month) pairs of a pay year, e.g. Mar 2025 … Feb 2026. */
export function payYearMonths(statement: Pick<SalaryStatement, 'financialYear' | 'startMonth'>): { year: number, month: number }[] {
  const start = startYearOf(statement.financialYear);
  return Array.from({ length: 12 }, (_, index) => {
    const offset = statement.startMonth - 1 + index;
    return { year: start + Math.floor(offset / 12), month: (offset % 12) + 1 };
  });
}

function hasPay(row: StatementRow): boolean {
  return row.values.gross > 0 || EARNING_KEYS.some(key => row.values[key] > 0);
}

export function annualSalary(statement: SalaryStatement, options: { project: boolean }): AnnualSalary {
  const monthRows = statement.rows.filter(row => row.kind === 'month');
  const arrearRows = statement.rows.filter(row => row.kind === 'arrear');
  // A month can appear twice (flagged when reading); every row counts, as in the sheet's TOTAL.
  const byMonth = new Map<string, StatementRow[]>();
  for (const row of monthRows)
    byMonth.set(`${row.year}-${row.month}`, [...(byMonth.get(`${row.year}-${row.month}`) ?? []), row]);
  const latestWithPay = [...monthRows].filter(hasPay).sort((a, b) => key(b) - key(a))[0];

  const ordered: StatementRow[] = [];
  const projectedMonths: string[] = [];
  const missingMonths: string[] = [];
  const yearMonths = payYearMonths(statement);
  // Only months after the last one paid are projected; earlier gaps (joined mid-year, leave
  // without pay) stay empty rather than borrowing someone's full salary.
  const lastPaidIndex = yearMonths.reduce((last, { year, month }, index) =>
    (byMonth.get(`${year}-${month}`) ?? []).some(hasPay) ? index : last, -1);
  for (let index = 0; index < yearMonths.length; index++) {
    const { year, month } = yearMonths[index];
    const monthKey = `${year}-${month}`;
    const rowsForMonth = byMonth.get(monthKey) ?? [];
    byMonth.delete(monthKey);
    if (rowsForMonth.some(hasPay)) {
      ordered.push(...rowsForMonth);
      continue;
    }
    if (options.project && latestWithPay && index > lastPaidIndex) {
      const existing = rowsForMonth[0];
      ordered.push({
        ...latestWithPay,
        label: monthLabel(year, month),
        year,
        month,
        sheetRow: existing?.sheetRow,
        values: { ...latestWithPay.values, incomeTax: existing?.values.incomeTax ?? 0 },
        taxPending: existing ? existing.taxPending : true,
        projected: true,
      });
      projectedMonths.push(monthLabel(year, month));
      continue;
    }
    if (rowsForMonth.length)
      ordered.push(...rowsForMonth);
    else
      missingMonths.push(monthLabel(year, month));
  }
  // Month rows outside the pay year (already flagged when reading) still count.
  byMonth.forEach(rows => ordered.push(...rows));

  const rows = [...ordered, ...arrearRows];
  const totals = emptyPayValues();
  for (const row of rows) {
    for (const payKey of PAY_KEYS)
      totals[payKey] += row.values[payKey];
  }

  const monthsInOrder = ordered.filter(row => row.kind === 'month');
  const deductedMonths = monthsInOrder.filter(row => row.values.incomeTax > 0);
  const lastDeducted = deductedMonths.length ? monthsInOrder.lastIndexOf(deductedMonths[deductedMonths.length - 1]) : -1;
  const pendingTaxMonths = monthsInOrder
    .filter((row, index) => row.taxPending && index > lastDeducted)
    .map(row => row.label);

  return {
    rows,
    totals,
    projectedMonths,
    missingMonths,
    tdsDeducted: totals.incomeTax,
    tdsPeriod: deductedMonths.length
      ? deductedMonths.length === 1
        ? deductedMonths[0].label
        : `${deductedMonths[0].label} – ${deductedMonths[deductedMonths.length - 1].label}`
      : null,
    pendingTaxMonths,
    arrears: arrearRows.map(row => ({ label: row.label, amount: row.values.gross })),
    components: EARNING_KEYS
      .filter(payKey => totals[payKey] !== 0)
      .map(payKey => ({ key: payKey, label: columnSpec(payKey).label, amount: totals[payKey] })),
  };
}

function key(row: StatementRow): number {
  return (row.year ?? 0) * 12 + (row.month ?? 0);
}
