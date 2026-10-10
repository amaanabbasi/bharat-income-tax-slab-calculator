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
  if (annual.arrears.length) {
    const total = annual.arrears.reduce((sum, arrear) => sum + arrear.amount, 0);
    notes.push(`Arrears of ${formatRupees(total)} (${annual.arrears.map(arrear => arrear.label).join(', ')}) are taxed this year. If part of them belongs to an earlier year, relief u/s 89 (Form 10E) can lower the tax; enter it in Declarations.`);
  }

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
