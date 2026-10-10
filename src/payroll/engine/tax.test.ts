import { describe, expect, it } from 'vitest';
import { DEFAULT_DECLARATIONS, type Declarations } from './declarations';
import { roundToTen, rupeesInWords } from './money';
import { type SalaryFigures, computeTax } from './tax';
import { type FinancialYear, type Regime } from '../rules/taxRules';

function salary(overrides: Partial<SalaryFigures>): SalaryFigures {
  return {
    gross: 0,
    components: [],
    basic: 0,
    npa: 0,
    da: 0,
    hra: 0,
    employerNps: 0,
    employeeNps: 0,
    cghs: 0,
    gis: 0,
    ...overrides,
  };
}

function run(fy: FinancialYear, regime: Regime, figures: Partial<SalaryFigures>, declarations: Partial<Declarations> = {}, tdsDeducted = 0) {
  return computeTax({ fy, regime, salary: salary(figures), declarations: { ...DEFAULT_DECLARATIONS, ...declarations }, tdsDeducted });
}

describe('rounding (sections 288A and 288B)', () => {
  it('rounds to the nearest ten, five and above going up, ignoring paise', () => {
    expect(roundToTen(4402796)).toBe(4402800);
    expect(roundToTen(803524.8)).toBe(803520);
    expect(roundToTen(1234565)).toBe(1234570);
    expect(roundToTen(1234564.99)).toBe(1234560);
    expect(roundToTen(0)).toBe(0);
  });
});

describe('new regime, FY 2025-26', () => {
  it('cancels tax up to ₹12 lakh with the 87A rebate', () => {
    const result = run('2025-26', 'new', { gross: 1275000 });
    expect(result.taxableIncome).toBe(1200000);
    expect(result.taxOnIncome).toBe(60000);
    expect(result.rebate).toMatchObject({ amount: 60000, kind: 'full' });
    expect(result.taxPayable).toBe(0);
  });

  it('gives marginal relief just above ₹12 lakh', () => {
    const result = run('2025-26', 'new', { gross: 1285000 });
    expect(result.taxableIncome).toBe(1210000);
    expect(result.taxOnIncome).toBe(61500);
    expect(result.rebate).toMatchObject({ amount: 51500, kind: 'marginal' });
    expect(result.cess).toBe(400);
    expect(result.taxPayable).toBe(10400);
  });

  it('stops the relief once slab tax is below the excess income', () => {
    const result = run('2025-26', 'new', { gross: 1375000 });
    expect(result.taxableIncome).toBe(1300000);
    expect(result.rebate.amount).toBe(0);
    expect(result.taxPayable).toBe(78000);
  });

  it('applies marginal relief on the 10% surcharge just above ₹50 lakh', () => {
    const result = run('2025-26', 'new', { gross: 5085000 });
    expect(result.taxableIncome).toBe(5010000);
    expect(result.taxOnIncome).toBe(1083000);
    expect(result.surcharge).toMatchObject({ rate: 10, beforeRelief: 108300, relief: 101300, amount: 7000 });
    expect(result.cess).toBe(43600);
    expect(result.taxPayable).toBe(1133600);
  });

  it('applies marginal relief at the ₹1 crore threshold', () => {
    const result = run('2025-26', 'new', { gross: 10125000 });
    expect(result.taxableIncome).toBe(10050000);
    expect(result.taxOnIncome).toBe(2595000);
    expect(result.surcharge).toMatchObject({ rate: 15, relief: 96250, amount: 293000 });
    expect(result.taxPayable).toBe(3003520);
  });

  it('caps the surcharge at 25% above ₹5 crore', () => {
    expect(run('2025-26', 'new', { gross: 60075000 }).surcharge.rate).toBe(25);
    expect(run('2025-26', 'old', { gross: 60050000 }).surcharge.rate).toBe(37);
  });

  it('taxes Government NPS and allows 14% of basic pay + DA, leaving NPA out (office sheet layout)', () => {
    // NPA counts for the contribution (14% of BP + NPA + DA) but not for the 80CCD(2) limit.
    const result = run('2025-26', 'new', {
      gross: 4000000,
      basic: 1800000,
      npa: 360000,
      da: 1252800,
      employerNps: 477792,
    }, {}, 750000);
    const nps = result.deductionLines.find(line => line.section === '80CCD(2)');
    expect(nps?.amount).toBe(427392);
    expect(result.incomeFromSalary).toBe(4402792);
    expect(result.taxableIncome).toBe(3975400);
    expect(result.taxOnIncome).toBe(772620);
    expect(result.surcharge.amount).toBe(0);
    expect(result.cess).toBeCloseTo(30904.8, 2);
    expect(result.taxPayable).toBe(803520);
    expect(result.balance).toBe(53520);
    expect(result.notes.some(note => note.includes('₹50,400 of the Government NPS contribution stays taxable'))).toBe(true);
  });

  it('allows the whole contribution when NPA is counted as salary', () => {
    const result = run('2025-26', 'new', { gross: 4000000, basic: 1800000, npa: 360000, da: 1252800, employerNps: 477792 }, { npaInSalary: true });
    expect(result.deductionLines.find(line => line.section === '80CCD(2)')?.amount).toBe(477792);
  });

  it('caps employer retirement contributions at ₹7.5 lakh (s.17(2)(vii))', () => {
    const result = run('2025-26', 'new', { gross: 9000000, basic: 4000000, da: 2320000, employerNps: 884800 });
    expect(result.deductionLines.find(line => line.section === '80CCD(2)')?.amount).toBe(750000);
    expect(result.notes.some(note => note.includes('17(2)(vii)'))).toBe(true);
  });

  it('ignores old-regime deductions and says so', () => {
    const result = run('2025-26', 'new', { gross: 2000000, hra: 300000 }, { rentPaid: 300000, investments80C: 150000 });
    expect(result.deductionLines).toHaveLength(0);
    expect(result.notes.some(note => note.includes('only count in the old regime'))).toBe(true);
  });
});

describe('new regime, FY 2024-25', () => {
  it('uses the ₹7 lakh rebate with marginal relief', () => {
    expect(run('2024-25', 'new', { gross: 775000 }).taxPayable).toBe(0);
    const above = run('2024-25', 'new', { gross: 785000 });
    expect(above.taxableIncome).toBe(710000);
    expect(above.taxOnIncome).toBe(21000);
    expect(above.rebate).toMatchObject({ amount: 11000, kind: 'marginal' });
    expect(above.taxPayable).toBe(10400);
  });
});

describe('old regime', () => {
  const figures = {
    gross: 1812000,
    basic: 900000,
    da: 522000,
    hra: 270000,
    employerNps: 199080,
    employeeNps: 142200,
    cghs: 7800,
    gis: 1440,
  };
  const declarations = { rentPaid: 300000, metroCity: true, investments80C: 50000, healthInsuranceSelf: 10000 };

  it('works out HRA, 80C/80CCD(1), 80CCD(1B), 80D and the slabs', () => {
    const result = run('2025-26', 'old', figures, declarations);
    const hra = result.salaryLines.find(line => line.section === '10(13A)');
    expect(hra?.amount).toBe(157800);
    expect(result.incomeFromSalary).toBe(1803280);
    const bySection = Object.fromEntries(result.deductionLines.map(line => [line.section, line.amount]));
    expect(bySection).toEqual({ '80CCD(2)': 199080, '80C, 80CCD(1)': 150000, '80CCD(1B)': 43640, '80D': 17800 });
    expect(result.taxableIncome).toBe(1392760);
    expect(result.taxOnIncome).toBe(230328);
    expect(result.cess).toBeCloseTo(9213.12, 2);
    expect(result.taxPayable).toBe(239540);
  });

  it('compares with the new regime on the same salary', () => {
    expect(run('2025-26', 'new', figures, declarations).taxPayable).toBe(153300);
  });

  it('uses the senior slabs and the full ₹12,500 rebate up to ₹5 lakh', () => {
    const senior = run('2025-26', 'old', { gross: 550000 }, { ageGroup: 'senior' });
    expect(senior.taxableIncome).toBe(500000);
    expect(senior.taxOnIncome).toBe(10000);
    expect(senior.taxPayable).toBe(0);
    const young = run('2025-26', 'old', { gross: 560000 });
    expect(young.taxableIncome).toBe(510000);
    expect(young.rebate.amount).toBe(0);
    expect(young.taxOnIncome).toBe(14500);
  });

  it('limits home-loan interest to ₹2 lakh', () => {
    const result = run('2025-26', 'old', { gross: 2050000 }, { homeLoanInterest: 350000 });
    expect(result.otherLines[0].amount).toBe(-200000);
    expect(result.grossTotalIncome).toBe(1800000);
  });
});

describe('words', () => {
  it('writes amounts the Indian way', () => {
    expect(rupeesInWords(302322)).toBe('Rupees Three Lakh Two Thousand Three Hundred Twenty-Two Only');
    expect(rupeesInWords(12345670)).toBe('Rupees One Crore Twenty-Three Lakh Forty-Five Thousand Six Hundred Seventy Only');
    expect(rupeesInWords(30904.8)).toBe('Rupees Thirty Thousand Nine Hundred Four and Eighty Paise Only');
  });
});
