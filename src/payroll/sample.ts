import { TEMPLATE_LAYOUT } from './format/salaryStatement';
import { type SalaryStatement, type StatementRow, emptyPayValues, monthLabel } from './model';

/**
 * A made-up employee laid out exactly like the office statement: an increment in July paid
 * with an arrear in August, DA moving from 53% to 55% to 58% with arrear rows, and February's
 * income tax not deducted yet. Used for the downloadable template and "Try a sample".
 */
export function sampleStatement(): SalaryStatement {
  const rows: StatementRow[] = [];
  for (let index = 0; index < 12; index++) {
    const year = index < 10 ? 2025 : 2026;
    const month = ((index + 2) % 12) + 1;
    const basic = index < 5 ? 123100 : 126800;
    const npa = Math.round(basic * 0.2);
    const daRate = index === 0 ? 0.53 : index < 7 ? 0.55 : 0.58;
    const values = emptyPayValues();
    values.basic = basic;
    values.npa = npa;
    values.hra = basic * 0.3;
    values.da = Math.round((basic + npa) * daRate);
    values.tpt = 7200;
    values.daOnTa = 7200 * daRate;
    values.cghs = 650;
    values.gis = 120;
    const taxPending = index === 11;
    values.incomeTax = taxPending ? 0 : index < 8 ? 20000 : 30000;
    finish(values);
    rows.push({ kind: 'month', label: monthLabel(year, month), year, month, values, taxPending });
  }
  rows.push(arrear('DA ARR', { da: 8863, daOnTa: 432 }));
  rows.push(arrear('DA ARR', { da: 13561, daOnTa: 648 }));
  rows.push(arrear('Inc. Arrear', { basic: 3700, npa: 740, hra: 1110, da: 2442 }));
  rows.forEach((row, index) => {
    row.sheetRow = TEMPLATE_LAYOUT.firstDataRow + index;
  });
  return {
    id: 'sample',
    fileName: 'Salary statement template.xlsx',
    sheetName: 'Sheet1',
    organisation: 'YOUR OFFICE NAME, CITY',
    title: 'Statement of Salary for the year 2025-26',
    financialYear: '2025-26',
    employeeName: 'Sample Employee',
    designation: 'Research Officer',
    rows,
    columns: ['month', 'basic', 'npa', 'hra', 'da', 'tpt', 'daOnTa', 'specialPay', 'na', 'hpca', 'others', 'gross', 'incomeTax', 'cghs', 'gis', 'npsEmployee', 'npsGovt'],
    signatures: [...TEMPLATE_LAYOUT.signatures],
    startMonth: 3,
  };
}

function arrear(label: string, parts: Partial<ReturnType<typeof emptyPayValues>>): StatementRow {
  const values = { ...emptyPayValues(), ...parts };
  finish(values);
  return { kind: 'arrear', label, values, taxPending: true };
}

function finish(values: ReturnType<typeof emptyPayValues>) {
  values.gross = values.basic + values.npa + values.hra + values.da + values.tpt + values.daOnTa
    + values.specialPay + values.na + values.hpca + values.others;
  values.npsEmployee = Math.round((values.basic + values.npa + values.da) * 0.1);
  values.npsGovt = Math.round((values.basic + values.npa + values.da) * 0.14);
}
