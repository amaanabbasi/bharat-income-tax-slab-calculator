import { describe, expect, it } from 'vitest';
import { annualSalary } from './annualSalary';
import { DEFAULT_DECLARATIONS } from './declarations';
import { computeStatementTax } from './statementTax';
import { type SalaryStatement, type StatementRow, emptyPayValues, monthLabel } from '../model';

function month(year: number, monthNumber: number, basic: number, tax: number | null): StatementRow {
  const values = { ...emptyPayValues(), basic, da: basic / 2, gross: basic * 1.5, incomeTax: tax ?? 0, npsGovt: 0 };
  return { kind: 'month', label: monthLabel(year, monthNumber), year, month: monthNumber, values, taxPending: tax === null };
}

function statement(rows: StatementRow[]): SalaryStatement {
  return {
    id: 's',
    fileName: 'x.xlsx',
    sheetName: 'Sheet1',
    organisation: '',
    title: '',
    financialYear: '2025-26',
    employeeName: 'Test',
    designation: '',
    rows,
    columns: [],
    signatures: [],
    startMonth: 3,
  };
}

const PAY_YEAR = [[2025, 3], [2025, 4], [2025, 5], [2025, 6], [2025, 7], [2025, 8], [2025, 9], [2025, 10], [2025, 11], [2025, 12], [2026, 1], [2026, 2]];

describe('annual salary', () => {
  it('projects months not drawn yet from the latest month and recovers tax from them', () => {
    // Paid March to October; November to February are in the sheet but still empty.
    const rows = PAY_YEAR.map(([year, monthNumber], index) => index < 8 ? month(year, monthNumber, 100000, 10000) : month(year, monthNumber, 0, null));
    const annual = annualSalary(statement(rows), { project: true });
    expect(annual.projectedMonths).toEqual(['Nov 2025', 'Dec 2025', 'Jan 2026', 'Feb 2026']);
    expect(annual.totals.gross).toBe(12 * 150000);
    expect(annual.tdsDeducted).toBe(80000);
    expect(annual.pendingTaxMonths).toEqual(['Nov 2025', 'Dec 2025', 'Jan 2026', 'Feb 2026']);

    const tax = computeStatementTax(statement(rows), DEFAULT_DECLARATIONS);
    expect(tax.recovery?.months).toHaveLength(4);
    expect(tax.recovery?.perMonth).toBe(Math.ceil(tax.chosen.balance / 4));
  });

  it('leaves months empty when projection is off', () => {
    const rows = PAY_YEAR.map(([year, monthNumber], index) => index < 8 ? month(year, monthNumber, 100000, 10000) : month(year, monthNumber, 0, null));
    const annual = annualSalary(statement(rows), { project: false });
    expect(annual.projectedMonths).toEqual([]);
    expect(annual.totals.gross).toBe(8 * 150000);
  });

  it('does not fill the months before a mid-year joiner started', () => {
    const rows = PAY_YEAR.slice(4).map(([year, monthNumber]) => month(year, monthNumber, 100000, 10000));
    const annual = annualSalary(statement(rows), { project: true });
    expect(annual.projectedMonths).toEqual([]);
    expect(annual.missingMonths).toEqual(['Mar 2025', 'Apr 2025', 'May 2025', 'Jun 2025']);
    expect(annual.totals.gross).toBe(8 * 150000);
    expect(annual.tdsPeriod).toBe('Jul 2025 – Feb 2026');
  });

  it('counts a month that appears twice, as the sheet total does', () => {
    const rows = PAY_YEAR.map(([year, monthNumber]) => month(year, monthNumber, 100000, 10000));
    rows.push(month(2025, 11, 100000, 0));
    expect(annualSalary(statement(rows), { project: true }).totals.gross).toBe(13 * 150000);
  });
});
