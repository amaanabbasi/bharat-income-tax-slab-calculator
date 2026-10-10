import { type Declarations } from './declarations';
import { formatRupees, percent, roundToTen } from './money';
import {
  type AgeGroup,
  type FinancialYear,
  type Regime,
  type RegimeRules,
  type Slab,
  type YearRules,
  getYearRules,
} from '../rules/taxRules';

export interface SalaryFigures {
  /** Gross pay from the statement: every pay column, arrears and projected months. */
  gross: number;
  components: { key: string, label: string, amount: number }[];
  basic: number;
  npa: number;
  da: number;
  hra: number;
  employerNps: number;
  employeeNps: number;
  cghs: number;
  gis: number;
}

export interface TaxInput {
  fy: FinancialYear;
  regime: Regime;
  salary: SalaryFigures;
  declarations: Declarations;
  /** Tax already deducted by this office. */
  tdsDeducted: number;
  /** Employer PF or superannuation contributions, for the ₹7.5 lakh cap (none in the format). */
  otherEmployerContributions?: number;
}

export interface Line {
  label: string;
  section?: string;
  amount: number;
  op?: 'add' | 'less' | 'total';
  detail?: { label: string, amount: number }[];
}

export interface SlabLine {
  from: number;
  to: number | null;
  rate: number;
  /** Part of the income that falls in this slab. */
  amount: number;
  tax: number;
}

export interface TaxComputation {
  fy: FinancialYear;
  rules: YearRules;
  regime: Regime;
  regimeRules: RegimeRules;
  ageGroup: AgeGroup;
  salaryLines: Line[];
  incomeFromSalary: number;
  otherLines: Line[];
  grossTotalIncome: number;
  deductionLines: Line[];
  totalDeductions: number;
  totalIncome: number;
  /** Total income rounded to ₹10 (s.288A); the slabs apply to this. */
  taxableIncome: number;
  slabs: SlabLine[];
  taxOnIncome: number;
  rebate: { amount: number, kind: 'full' | 'marginal' | 'none', incomeUpTo: number, maxRebate: number };
  taxAfterRebate: number;
  surcharge: { rate: number, beforeRelief: number, relief: number, amount: number, threshold: number | null };
  cessPercent: number;
  cess: number;
  /** Tax + surcharge + cess, before relief u/s 89 and rounding. */
  grossTax: number;
  relief89: number;
  /** Rounded to ₹10 (s.288B). */
  taxPayable: number;
  tdsDeducted: number;
  previousEmployerTds: number;
  /** Positive: still to recover. Negative: deducted in excess. */
  balance: number;
  notes: string[];
}

export function slabTax(income: number, slabs: Slab[]): { lines: SlabLine[], total: number } {
  const lines: SlabLine[] = [];
  let lower = 0;
  let total = 0;
  for (const slab of slabs) {
    const upper = slab.upTo ?? Number.POSITIVE_INFINITY;
    const amount = Math.max(0, Math.min(income, upper) - lower);
    const tax = (amount * slab.rate) / 100;
    lines.push({ from: lower, to: slab.upTo, rate: slab.rate, amount, tax });
    total += tax;
    if (slab.upTo === null)
      break;
    lower = upper;
  }
  return { lines, total };
}

/** Section 87A, including the marginal relief just above the new-regime limit. */
export function rebate87A(income: number, tax: number, rule: RegimeRules['rebate']): { amount: number, kind: 'full' | 'marginal' | 'none' } {
  if (tax <= 0)
    return { amount: 0, kind: 'none' };
  if (income <= rule.incomeUpTo)
    return { amount: Math.min(tax, rule.maxRebate), kind: 'full' };
  const excess = income - rule.incomeUpTo;
  if (rule.marginalRelief && tax > excess)
    return { amount: tax - excess, kind: 'marginal' };
  return { amount: 0, kind: 'none' };
}

function surchargeRate(income: number, rules: RegimeRules): number {
  let rate = 0;
  for (const band of rules.surcharge) {
    if (income > band.above)
      rate = band.rate;
  }
  return rate;
}

/**
 * Surcharge with marginal relief: crossing a threshold may not cost more than the income
 * above it, i.e. tax + surcharge ≤ (tax + surcharge at the threshold) + (income − threshold).
 */
export function surchargeFor(income: number, tax: number, rules: RegimeRules, ageGroup: AgeGroup): TaxComputation['surcharge'] {
  const rate = surchargeRate(income, rules);
  if (rate === 0 || tax <= 0)
    return { rate: 0, beforeRelief: 0, relief: 0, amount: 0, threshold: null };
  const threshold = Math.max(...rules.surcharge.filter(band => income > band.above).map(band => band.above));
  const beforeRelief = (tax * rate) / 100;
  const taxAtThreshold = slabTax(threshold, rules.slabs[ageGroup]).total;
  const ceiling = taxAtThreshold * (1 + surchargeRate(threshold, rules) / 100) + (income - threshold);
  const relief = Math.min(beforeRelief, Math.max(0, tax + beforeRelief - ceiling));
  return { rate, beforeRelief, relief, amount: beforeRelief - relief, threshold };
}

const rupees = (amount: number) => formatRupees(amount);

export function computeTax(input: TaxInput): TaxComputation {
  const rules = getYearRules(input.fy);
  const regimeRules = rules.regimes[input.regime];
  const isOld = input.regime === 'old';
  const ageGroup: AgeGroup = isOld ? input.declarations.ageGroup : 'below60';
  const d = input.declarations;
  const s = input.salary;
  const limits = rules.oldRegimeLimits;
  const notes: string[] = [];

  // "Salary" for the NPS and HRA limits: basic pay + DA. NPA is an allowance, so it is left out
  // unless the office counts it (Explanation to s.80CCD).
  const salaryBase = s.basic + s.da + (d.npaInSalary ? s.npa : 0);
  const salaryBaseLabel = d.npaInSalary ? 'basic pay + NPA + DA' : 'basic pay + DA';

  // Income from salary
  const salaryLines: Line[] = [{ label: 'Gross salary (all months and arrears)', amount: s.gross, detail: s.components }];
  let salaryIncome = s.gross;
  if (d.previousEmployerSalary > 0) {
    salaryLines.push({ label: 'Add: salary from previous employer', amount: d.previousEmployerSalary, op: 'add' });
    salaryIncome += d.previousEmployerSalary;
  }
  if (s.employerNps > 0) {
    salaryLines.push({ label: 'Add: Government NPS contribution (14% of basic pay + NPA + DA)', section: '17(1)(viii)', amount: s.employerNps, op: 'add' });
    salaryIncome += s.employerNps;
  }
  if (isOld && s.hra > 0) {
    const metroPercent = d.metroCity ? 50 : 40;
    // Limits worked out from salary are taken in whole rupees, as pay offices do.
    const rentMinusTenth = Math.max(0, d.rentPaid - Math.round(salaryBase * 0.1));
    const metroLimit = Math.round((salaryBase * metroPercent) / 100);
    const exemption = Math.min(s.hra, rentMinusTenth, metroLimit);
    salaryLines.push({
      label: 'Less: HRA exemption (least of the three)',
      section: '10(13A)',
      amount: exemption,
      op: 'less',
      detail: [
        { label: 'HRA received', amount: s.hra },
        { label: `Rent paid − 10% of ${salaryBaseLabel}`, amount: rentMinusTenth },
        { label: `${metroPercent}% of ${salaryBaseLabel} (${d.metroCity ? 'metro' : 'non-metro'})`, amount: metroLimit },
      ],
    });
    salaryIncome -= exemption;
    if (d.rentPaid <= 0)
      notes.push('No rent was declared, so the HRA stays fully taxable.');
    if (d.metroCity && input.fy === '2026-27')
      notes.push(`Metro cities for the 50% HRA limit from 2026-27: ${rules.hraMetroCities.join(', ')}.`);
  }
  else if (!isOld && s.hra > 0) {
    notes.push('HRA is fully taxable in the new regime (no exemption u/s 10(13A)).');
  }
  const standardDeduction = Math.min(regimeRules.standardDeduction, Math.max(0, salaryIncome));
  salaryLines.push({ label: `Less: standard deduction (${rupees(regimeRules.standardDeduction)})`, section: '16(ia)', amount: standardDeduction, op: 'less' });
  salaryIncome -= standardDeduction;
  if (isOld && d.professionalTax > 0) {
    const professionalTax = Math.min(d.professionalTax, 2500, Math.max(0, salaryIncome));
    salaryLines.push({ label: 'Less: professional tax', section: '16(iii)', amount: professionalTax, op: 'less' });
    salaryIncome -= professionalTax;
  }
  const incomeFromSalary = Math.max(0, salaryIncome);

  // Other heads
  const otherLines: Line[] = [];
  let houseProperty = 0;
  if (d.homeLoanInterest > 0) {
    if (isOld) {
      houseProperty = -Math.min(d.homeLoanInterest, limits.homeLoanInterest);
      otherLines.push({ label: `Loss from house property: home-loan interest on self-occupied house (limit ${rupees(limits.homeLoanInterest)})`, section: '24(b)', amount: houseProperty });
    }
    else {
      notes.push('Home-loan interest on a self-occupied house is not deductible in the new regime.');
    }
  }
  const otherSources = d.interestSavings + d.interestDeposits + d.otherIncome;
  if (otherSources > 0)
    otherLines.push({ label: 'Income from other sources (interest and other income)', amount: otherSources, op: 'add' });
  const grossTotalIncome = Math.max(0, incomeFromSalary + houseProperty + otherSources);

  // Deductions (Chapter VI-A)
  const deductionLines: Line[] = [];
  if (s.employerNps > 0) {
    const percentLimit = Math.round((salaryBase * regimeRules.govtNpsPercent) / 100);
    const capRoom = Math.max(0, rules.employerRetirementCap - (input.otherEmployerContributions ?? 0));
    const allowed = Math.min(s.employerNps, percentLimit, capRoom);
    deductionLines.push({
      label: `Government NPS contribution, up to ${regimeRules.govtNpsPercent}% of ${salaryBaseLabel}`,
      section: '80CCD(2)',
      amount: allowed,
      op: 'less',
      detail: [
        { label: 'Contribution credited', amount: s.employerNps },
        { label: `${regimeRules.govtNpsPercent}% of ${salaryBaseLabel} (${rupees(salaryBase)})`, amount: percentLimit },
      ],
    });
    if (allowed < s.employerNps) {
      const why = allowed === capRoom && capRoom < percentLimit
        ? `employer retirement contributions above ${rupees(rules.employerRetirementCap)} a year are taxable (s.17(2)(vii))`
        : `the deduction is limited to ${regimeRules.govtNpsPercent}% of ${salaryBaseLabel}${d.npaInSalary ? '' : '; NPA is an allowance, so it is not "salary" for this limit'}`;
      notes.push(`${rupees(s.employerNps - allowed)} of the Government NPS contribution stays taxable: ${why}.`);
    }
  }

  if (isOld) {
    const gisIn80C = d.includeGisIn80C ? s.gis : 0;
    const items80C = gisIn80C + d.investments80C;
    const employeeNpsEligible = Math.min(s.employeeNps, Math.round(salaryBase * 0.1));
    const from80C = Math.min(items80C, limits.section80C);
    const fromNps = Math.min(employeeNpsEligible, limits.section80C - from80C);
    if (from80C + fromNps > 0) {
      deductionLines.push({
        label: `80C and 80CCD(1) together (limit ${rupees(limits.section80C)})`,
        section: '80C, 80CCD(1)',
        amount: from80C + fromNps,
        op: 'less',
        detail: [
          ...(gisIn80C ? [{ label: 'Group insurance (GIS) from salary', amount: gisIn80C }] : []),
          ...(d.investments80C ? [{ label: 'Investments declared (PPF, LIC, tuition fees…)', amount: d.investments80C }] : []),
          ...(fromNps ? [{ label: 'Employee NPS share, 80CCD(1) (within 10% of salary)', amount: fromNps }] : []),
        ],
      });
    }
    const npsLeft = Math.max(0, s.employeeNps - fromNps) + d.nps80CCD1B;
    const ccd1b = Math.min(npsLeft, limits.section80CCD1B);
    if (ccd1b > 0)
      deductionLines.push({ label: `Additional NPS (limit ${rupees(limits.section80CCD1B)})`, section: '80CCD(1B)', amount: ccd1b, op: 'less' });

    const senior = ageGroup !== 'below60';
    const selfLimit = senior ? limits.section80DSelfSenior : limits.section80DSelf;
    const selfClaim = Math.min(s.cghs + d.healthInsuranceSelf, selfLimit);
    const parentsLimit = d.parentsSenior ? limits.section80DParentsSenior : limits.section80DParents;
    const parentsClaim = Math.min(d.healthInsuranceParents, parentsLimit);
    if (selfClaim + parentsClaim > 0) {
      deductionLines.push({
        label: 'Health: CGHS and medical insurance',
        section: '80D',
        amount: selfClaim + parentsClaim,
        op: 'less',
        detail: [
          { label: `Self and family: CGHS ${rupees(s.cghs)} + premium ${rupees(d.healthInsuranceSelf)} (limit ${rupees(selfLimit)})`, amount: selfClaim },
          ...(d.healthInsuranceParents ? [{ label: `Parents (limit ${rupees(parentsLimit)})`, amount: parentsClaim }] : []),
        ],
      });
    }
    if (d.educationLoanInterest > 0)
      deductionLines.push({ label: 'Education loan interest', section: '80E', amount: d.educationLoanInterest, op: 'less' });
    if (d.donations80G > 0)
      deductionLines.push({ label: 'Donations (eligible amount)', section: '80G', amount: d.donations80G, op: 'less' });
    if (senior && d.interestSavings + d.interestDeposits > 0)
      deductionLines.push({ label: `Interest on deposits, senior citizen (limit ${rupees(limits.section80TTB)})`, section: '80TTB', amount: Math.min(d.interestSavings + d.interestDeposits, limits.section80TTB), op: 'less' });
    else if (!senior && d.interestSavings > 0)
      deductionLines.push({ label: `Savings bank interest (limit ${rupees(limits.section80TTA)})`, section: '80TTA', amount: Math.min(d.interestSavings, limits.section80TTA), op: 'less' });
    if (d.otherDeductions > 0)
      deductionLines.push({ label: 'Other deductions (80DD, 80DDB, 80U…)', section: 'VI-A', amount: d.otherDeductions, op: 'less' });
  }
  else {
    const oldOnly = d.rentPaid + d.investments80C + d.nps80CCD1B + d.healthInsuranceSelf + d.healthInsuranceParents
      + d.educationLoanInterest + d.donations80G + d.otherDeductions + d.professionalTax;
    if (oldOnly > 0)
      notes.push('Declared HRA rent, 80C, 80D, 80E, 80G and professional tax only count in the old regime, so they were left out.');
  }
  const claimed = deductionLines.reduce((sum, line) => sum + line.amount, 0);
  const totalDeductions = Math.min(claimed, grossTotalIncome);
  const totalIncome = Math.max(0, grossTotalIncome - totalDeductions);
  const taxableIncome = roundToTen(totalIncome);

  // Tax
  const { lines: slabs, total: taxOnIncome } = slabTax(taxableIncome, regimeRules.slabs[ageGroup]);
  const rebate = rebate87A(taxableIncome, taxOnIncome, regimeRules.rebate);
  const taxAfterRebate = taxOnIncome - rebate.amount;
  const surcharge = surchargeFor(taxableIncome, taxAfterRebate, regimeRules, ageGroup);
  const cess = ((taxAfterRebate + surcharge.amount) * rules.cessPercent) / 100;
  const grossTax = taxAfterRebate + surcharge.amount + cess;
  const relief89 = Math.min(d.relief89, grossTax);
  const taxPayable = roundToTen(grossTax - relief89);
  const balance = taxPayable - input.tdsDeducted - d.previousEmployerTds;

  const rebateLimit = rupees(regimeRules.rebate.incomeUpTo);
  if (rebate.kind === 'full')
    notes.push(`Total income is within ${rebateLimit}, so the rebate u/s 87A cancels tax up to ${rupees(regimeRules.rebate.maxRebate)}.`);
  else if (rebate.kind === 'marginal')
    notes.push(`Marginal relief u/s 87A: income is ${rupees(taxableIncome - regimeRules.rebate.incomeUpTo)} above ${rebateLimit}, so tax is capped at that amount.`);
  else if (taxOnIncome > 0)
    notes.push(`No rebate u/s 87A: total income is above ${rebateLimit}.`);
  if (surcharge.rate > 0 && surcharge.threshold !== null) {
    notes.push(surcharge.relief > 0
      ? `Surcharge ${surcharge.rate}% applies above ${rupees(surcharge.threshold)}; marginal relief of ${formatRupees(surcharge.relief, 2)} keeps the extra tax within the income above that line.`
      : `Surcharge ${surcharge.rate}% applies because total income exceeds ${rupees(surcharge.threshold)}; marginal relief checked and not due.`);
    if (!isOld && taxableIncome > 50000000)
      notes.push('In the new regime surcharge stops at 25%, even above ₹5 crore.');
  }
  notes.push(`Health and education cess is ${rules.cessPercent}% of tax plus surcharge.`);
  notes.push('Total income and tax are rounded to the nearest ₹10 (sections 288A and 288B).');
  if (rules.newActSections) {
    const mapping = Object.entries(rules.newActSections).map(([old, next]) => `${old} → ${next}`).join(', ');
    notes.push(`From tax year 2026-27 the Income-tax Act, 2025 applies with the same rates. Sections are quoted with their familiar 1961 numbers; new numbers include ${mapping}.`);
  }

  return {
    fy: input.fy,
    rules,
    regime: input.regime,
    regimeRules,
    ageGroup,
    salaryLines,
    incomeFromSalary,
    otherLines,
    grossTotalIncome,
    deductionLines,
    totalDeductions,
    totalIncome,
    taxableIncome,
    slabs,
    taxOnIncome,
    rebate: { ...rebate, incomeUpTo: regimeRules.rebate.incomeUpTo, maxRebate: regimeRules.rebate.maxRebate },
    taxAfterRebate,
    surcharge,
    cessPercent: rules.cessPercent,
    cess,
    grossTax,
    relief89,
    taxPayable,
    tdsDeducted: input.tdsDeducted,
    previousEmployerTds: d.previousEmployerTds,
    balance,
    notes,
  };
}

export function slabLabel(line: SlabLine): string {
  if (line.to === null)
    return `Above ${formatRupees(line.from)}`;
  if (line.from === 0)
    return `Up to ${formatRupees(line.to)}`;
  return `${formatRupees(line.from + 1)} – ${formatRupees(line.to)}`;
}

export function rateLabel(rate: number): string {
  return rate === 0 ? 'Nil' : percent(rate / 100);
}
