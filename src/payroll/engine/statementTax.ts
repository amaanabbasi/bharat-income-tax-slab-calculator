import { type AnnualSalary, annualSalary } from './annualSalary';
import { type Declarations } from './declarations';
import { formatRupees } from './money';
import { type SalaryFigures, type TaxComputation, computeTax } from './tax';
import { type SalaryStatement } from '../model';
import { type FinancialYear, type Regime, isSupportedFy, nearestSupportedFy } from '../rules/taxRules';

export interface StatementTax {
  fy: FinancialYear;
  annual: AnnualSalary;
  /** The regime in the declarations. */
  chosen: TaxComputation;
  /** The other regime, for comparison. */
  alternative: TaxComputation;
  /** How to recover the balance from the months still to be paid. */
  recovery: { perMonth: number, months: string[] } | null;
  /** About the statement itself (projection, arrears, year); the computation has its own notes. */
  notes: string[];
}

export function salaryFigures(annual: AnnualSalary): SalaryFigures {
  const t = annual.totals;
  return {
    gross: t.gross,
    components: annual.components,
    basic: t.basic,
    npa: t.npa,
    da: t.da,
    hra: t.hra,
    employerNps: t.npsGovt,
    employeeNps: t.npsEmployee,
    cghs: t.cghs,
    gis: t.gis,
    gpf: t.gpf,
    lic: t.lic,
  };
}

export function taxYearFor(statement: SalaryStatement, declarations: Declarations): FinancialYear {
  if (declarations.fyOverride)
    return declarations.fyOverride;
  return isSupportedFy(statement.financialYear) ? statement.financialYear : nearestSupportedFy(statement.financialYear);
}

export function computeStatementTax(statement: SalaryStatement, declarations: Declarations): StatementTax {
  const fy = taxYearFor(statement, declarations);
  const annual = annualSalary(statement, { project: declarations.projectMissingMonths });
  const salary = salaryFigures(annual);
  const run = (regime: Regime) => computeTax({ fy, regime, salary, declarations, tdsDeducted: annual.tdsDeducted });
  const chosen = run(declarations.regime);
  const alternative = run(declarations.regime === 'new' ? 'old' : 'new');

  const notes: string[] = [];
  if (!declarations.fyOverride && fy !== statement.financialYear)
    notes.push(`The statement is for ${statement.financialYear}; rules for ${fy} were used, the nearest year available.`);
  if (annual.projectedMonths.length)
    notes.push(`No salary yet for ${listMonths(annual.projectedMonths)}, so those months repeat the latest month's pay as an estimate.`);
  if (annual.missingMonths.length)
    notes.push(`${listMonths(annual.missingMonths)} ${annual.missingMonths.length === 1 ? 'is' : 'are'} missing from the statement and not projected; the tax covers the months present only.`);
  // Rows other than months: true arrears, leave encashment, and other payments (CEA, dress allowance…).
  const extra = annual.arrears.filter(arrear => arrear.amount !== 0);
  const kinds = {
    leave: extra.filter(arrear => /enc/i.test(arrear.label)),
    arrears: extra.filter(arrear => !/enc/i.test(arrear.label) && /arr|in-?situ/i.test(arrear.label)),
    other: extra.filter(arrear => !/enc/i.test(arrear.label) && !/arr|in-?situ/i.test(arrear.label)),
  };
  const describe = (rows: typeof extra) => `${formatRupees(rows.reduce((sum, row) => sum + row.amount, 0))} (${rows.map(row => row.label).join(', ')})`;
  if (kinds.arrears.length)
    notes.push(`Arrears of ${describe(kinds.arrears)} are taxed this year. If part of them belongs to an earlier year, relief u/s 89 (Form 10E) can lower the tax; enter it in Declarations.`);
  if (kinds.leave.length)
    notes.push(`Leave encashment of ${describe(kinds.leave)} is taxed as salary: it is exempt only when paid on retirement (s.10(10AA)).`);
  if (kinds.other.length)
    notes.push(`Other payments of ${describe(kinds.other)} are taxed as salary.`);
  if (annual.totals.recovery)
    notes.push(`Pay recovered (${formatRupees(annual.totals.recovery)}) is shown as a deduction but not taken off taxable salary. If it recovers pay overpaid this year, reduce the pay rows instead.`);
  if (annual.totals.hba && declarations.regime === 'old')
    notes.push('The principal part of the house building advance repaid can count under 80C; add it in Declarations.');

  const recovery = chosen.balance > 0 && annual.pendingTaxMonths.length
    ? { perMonth: Math.ceil(chosen.balance / annual.pendingTaxMonths.length), months: annual.pendingTaxMonths }
    : null;

  return { fy, annual, chosen, alternative, recovery, notes };
}

function listMonths(months: string[]): string {
  if (months.length <= 2)
    return months.join(' and ');
  return `${months.slice(0, -1).join(', ')} and ${months[months.length - 1]}`;
}
