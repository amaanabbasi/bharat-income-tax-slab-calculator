import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { buildExportWorkbook, buildTemplateWorkbook, exportItem } from './exportWorkbook';
import { type CellValue, type GridCell, type SheetGrid } from './grid';
import { importFile } from './importFile';
import { guessColumn, parseMonth, parseStatementSheet } from './parseStatement';
import { DEFAULT_DECLARATIONS } from '../engine/declarations';
import { buildSlip } from '../engine/slip';
import { computeStatementTax, salaryFigures } from '../engine/statementTax';
import { PAY_KEYS } from '../format/salaryStatement';
import { sampleStatement } from '../sample';

const HEADINGS = ['Month', 'Pay Band', 'NPA', 'HRA', 'DA', 'TPT', 'Da on TA', 'S.Pay', 'NA', 'HPCA', 'Others', 'GROSS PAY', 'I.T. Ded.', 'CGHS', 'GIS', 'NPS(10%)', 'NPS(14%)'];

function monthValues(month: CellValue, basic: number, tax: number | null): CellValue[] {
  const npa = Math.round(basic * 0.2);
  const hra = basic * 0.3;
  const da = Math.round((basic + npa) * 0.55);
  const gross = basic + npa + hra + da + 7200 + 3960;
  return [month, basic, npa, hra, da, 7200, 3960, 0, 0, 0, 0, gross, tax, 650, 120, Math.round((basic + npa + da) * 0.1), Math.round((basic + npa + da) * 0.14)];
}

/** A statement laid out like the office sheet: title rows, headings in row 9, months, an arrear, TOTAL. */
function statementGrid(change: { headings?: string[], edit?: (rows: CellValue[][]) => void } = {}): SheetGrid {
  const months: CellValue[][] = Array.from({ length: 12 }, (_, index) => {
    const offset = index + 2;
    const date = new Date(Date.UTC(2025 + Math.floor(offset / 12), offset % 12, 1));
    return monthValues(date, 100000, index === 11 ? null : 15000);
  });
  const arrear: CellValue[] = ['DA ARR', 0, 0, 0, 1000, 0, 100, 0, 0, 0, 0, 1100, null, null, null, 100, 140];
  const body = [...months, arrear];
  const totals: CellValue[] = ['TOTAL', ...HEADINGS.slice(1).map((_, column) => body.reduce((sum, row) => sum + Number(row[column + 1] ?? 0), 0))];
  const rows: CellValue[][] = [
    [],
    [null, null, null, null, 'MY OFFICE, NEW DELHI'],
    [],
    [null, null, null, null, null, 'Statement of Salary for the year 2025-26'],
    [],
    [],
    ['Name of employee:  Test Person', null, null, null, null, null, null, null, null, 'Designation:  Scientist C'],
    [],
    change.headings ?? HEADINGS,
    ...body,
    [],
    totals,
    [],
    [],
    [],
    [null, 'Dealing Hand', null, null, null, null, null, 'Checked by', null, null, null, null, null, null, null, 'D.D. Incharge'],
  ];
  change.edit?.(rows);
  return { name: 'Sheet1', hidden: false, rows: rows.map(row => row.map((value): GridCell => ({ value }))) };
}

const parse = (grid: SheetGrid) => {
  const result = parseStatementSheet(grid, { id: 't', fileName: 'test.xlsx' });
  return { ...result, statement: result.statements[0] ?? null };
};
const messages = (result: { issues: { severity: string, message: string }[] }, severity: string) =>
  result.issues.filter(issue => issue.severity === severity).map(issue => issue.message);

describe('reading the statement layout', () => {
  it('reads details, months, arrears and signatures', () => {
    const result = parse(statementGrid());
    expect(messages(result, 'error')).toEqual([]);
    expect(messages(result, 'warning')).toEqual([]);
    const statement = result.statement!;
    expect(statement).toMatchObject({ organisation: 'MY OFFICE, NEW DELHI', financialYear: '2025-26', employeeName: 'Test Person', designation: 'Scientist C', startMonth: 3 });
    expect(statement.rows.map(row => row.label)).toEqual(['Mar 2025', 'Apr 2025', 'May 2025', 'Jun 2025', 'Jul 2025', 'Aug 2025', 'Sep 2025', 'Oct 2025', 'Nov 2025', 'Dec 2025', 'Jan 2026', 'Feb 2026', 'DA ARR']);
    expect(statement.rows[11].taxPending).toBe(true);
    expect(statement.signatures).toEqual(['Dealing Hand', 'Checked by', 'D.D. Incharge']);
    expect(messages(result, 'info')).toContain('I.T. Ded. is blank for Feb 2026, so no tax counts as deducted in that month yet.');
  });

  it('matches misspelled headings and says which ones', () => {
    const headings = [...HEADINGS];
    headings[11] = 'GROS PAY';
    headings[6] = 'DA on T.A.';
    headings[16] = 'NPS (14 %)';
    const result = parse(statementGrid({ headings }));
    expect(result.statement).not.toBeNull();
    expect(result.statement!.columns).toEqual(expect.arrayContaining(['gross', 'daOnTa', 'npsGovt']));
    expect(messages(result, 'warning')).toEqual([
      'Heading “GROS PAY” in L9 looks like a misspelling of “GROSS PAY”, so it was read as Gross pay.',
    ]);
  });

  it('keeps short headings apart', () => {
    expect(guessColumn('DA')?.key).toBe('da');
    expect(guessColumn('NA')?.key).toBe('na');
    expect(guessColumn('HRA (30%)')?.key).toBe('hra');
    expect(guessColumn('Basic Pay')?.key).toBe('basic');
    expect(guessColumn('Remarks')).toBeNull();
  });

  it('stops with an error when a required column is missing', () => {
    const headings = [...HEADINGS];
    headings[4] = 'Allowance';
    const result = parse(statementGrid({ headings }));
    expect(result.statement).toBeNull();
    expect(messages(result, 'error')[0]).toContain('Column “DA” (Dearness allowance (DA)) is missing');
  });

  it('corrects a month typed with the wrong year', () => {
    const result = parse(statementGrid({ edit: (rows) => { rows[17][0] = new Date(Date.UTC(2026, 10, 1)); } }));
    expect(result.statement!.rows[8].label).toBe('Nov 2025');
    expect(messages(result, 'warning')).toEqual(['A18 reads November 2026, but this statement is for 2025-26, so it was read as November 2025.']);
  });

  it('reports text in an amount cell with its address', () => {
    const result = parse(statementGrid({ edit: (rows) => { rows[11][3] = 'thirty percent'; } }));
    expect(result.statement).toBeNull();
    expect(messages(result, 'error')).toEqual(['These cells should hold amounts but contain text: D12 (“thirty percent”).']);
  });

  it('asks for a recalculation when formulas have no saved result', () => {
    const grid = statementGrid();
    grid.rows[12][4] = { value: null, formula: 'ROUND((B13+C13)*55%,0)', noResult: true };
    const result = parse(grid);
    expect(result.statement).toBeNull();
    expect(result.issues.find(issue => issue.severity === 'error')?.fix).toContain('Ctrl+Alt+F9');
  });

  it('flags a TOTAL row that disagrees with the rows', () => {
    const result = parse(statementGrid({ edit: (rows) => { rows[23][12] = 1; } }));
    expect(messages(result, 'warning')[0]).toMatch(/^The TOTAL row shows 1 for I\.T\. Ded\. \(M24\), but the rows above add up to 1,65,000/);
  });

  it('reads months typed as text', () => {
    expect(parseMonth('Mar-25')).toEqual({ month: 3, year: 2025 });
    expect(parseMonth('March 2025')).toEqual({ month: 3, year: 2025 });
    expect(parseMonth('Sept')).toEqual({ month: 9, year: undefined });
    expect(parseMonth('03/2025')).toEqual({ month: 3, year: 2025 });
    expect(parseMonth('DA ARR')).toBeNull();
    expect(parseMonth('Inc. Arrear')).toBeNull();
  });

  it('ignores sheets without the headings', () => {
    const result = parse({ name: 'Notes', hidden: false, rows: [[{ value: 'Remarks' }]] });
    expect(result.looksLikeStatement).toBe(false);
  });
});

describe('files', () => {
  it('rejects old .xls and password-protected workbooks with a fix', async () => {
    const ole = new Uint8Array([0xD0, 0xCF, 0x11, 0xE0, 0, 0, 0, 0]).buffer;
    const xls = await importFile('salary.xls', ole, 'a');
    expect(xls.issues[0].message).toBe('This is an old-style .xls workbook.');
    expect(xls.issues[0].fix).toContain('Save As');
    const locked = await importFile('salary.xlsx', ole, 'b');
    expect(locked.issues[0].message).toContain('password-protected');
  });

  it('explains what is expected when no sheet is a statement', async () => {
    const csv = new TextEncoder().encode('Name,Amount\nRent,1000\n').buffer as ArrayBuffer;
    const result = await importFile('other.csv', csv, 'c');
    expect(result.statements).toHaveLength(0);
    expect(result.issues.at(-1)?.message).toBe('No salary statement found in “other.csv”: none of its sheets has the column headings.');
  });

  it('round-trips the template, including the Declarations sheet', async () => {
    const buffer = await buildTemplateWorkbook();
    const imported = await importFile('template.xlsx', buffer, 'tpl');
    expect(imported.issues.filter(issue => issue.severity !== 'info')).toEqual([]);
    expect(imported.statements).toHaveLength(1);
    const statement = imported.statements[0];
    const sample = sampleStatement();
    expect(statement.employeeName).toBe(sample.employeeName);
    expect(statement.rows).toHaveLength(sample.rows.length);
    for (const key of PAY_KEYS) {
      const total = (rows: typeof sample.rows) => rows.reduce((sum, row) => sum + row.values[key], 0);
      expect(total(statement.rows)).toBeCloseTo(total(sample.rows), 6);
    }
    expect(imported.declarations[statement.id]).toMatchObject({ regime: 'new', ageGroup: 'below60', metroCity: true, rentPaid: 0 });
  });

  it('reads an old-regime declaration', async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('Declarations').addRows([
      ['Item', 'Value'],
      ['Tax regime (New / Old)', 'Old'],
      ['Age group (Below 60 / 60-79 / 80+)', '62'],
      ['Rent paid in the year', '2,40,000'],
      ['Lives in a metro city for HRA (Yes / No)', 'No'],
      ['Favourite colour', 'Blue'],
    ]);
    const templateBook = new ExcelJS.Workbook();
    await templateBook.xlsx.load(await buildTemplateWorkbook());
    const statementSheet = workbook.addWorksheet('Sheet1');
    templateBook.getWorksheet('Sheet1')!.eachRow({ includeEmpty: true }, (row, number) => {
      statementSheet.getRow(number).values = row.values as ExcelJS.CellValue[];
    });
    const imported = await importFile('mixed.xlsx', await workbook.xlsx.writeBuffer() as unknown as ArrayBuffer, 'mx');
    const statement = imported.statements[0];
    expect(imported.declarations[statement.id]).toMatchObject({ regime: 'old', ageGroup: 'senior', rentPaid: 240000, metroCity: false });
    expect(imported.issues.some(issue => issue.message.includes('“Favourite colour”'))).toBe(true);
  });

  it('exports the tax computation with the figures the engine produced', async () => {
    const statement = sampleStatement();
    const item = exportItem(statement, DEFAULT_DECLARATIONS);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await buildExportWorkbook([item]));
    expect(workbook.worksheets.map(sheet => sheet.name)).toEqual(['Income tax', 'Sheet1', 'Declarations']);
    const sheet = workbook.getWorksheet('Income tax')!;
    const find = (label: string) => {
      let value: unknown;
      sheet.eachRow((row) => {
        if (String(row.getCell(1).value).startsWith(label))
          value = row.getCell(3).value;
      });
      return value;
    };
    const tax = computeStatementTax(statement, DEFAULT_DECLARATIONS);
    expect(find('Tax payable rounded off u/s 288B')).toBe(tax.chosen.taxPayable);
    expect(find('Total taxable income rounded off u/s 288A')).toBe(tax.chosen.taxableIncome);
    expect(find('Balance tax to be recovered')).toBe(tax.chosen.balance);
  });
});

/** A second employee in the same sheet, one column to the right, with UA, WA, GPF and LIC columns. */
function gpfBlock(): CellValue[][] {
  const headings = ['Month', 'Pay Band', 'DA', 'HRA', 'TPT', 'Da on TA', 'UA', 'WA', 'Others', 'GROSS PAY', 'I.T. Ded.', 'CGHS', 'GIS', 'GPF', 'LIC'];
  const months: CellValue[][] = Array.from({ length: 12 }, (_, index) => {
    const offset = index + 2;
    const date = new Date(Date.UTC(2025 + Math.floor(offset / 12), offset % 12, 1));
    const ua = index === 6 ? 20000 : 0;
    return [date, 40000, 22000, 8000, 3600, 1980, ua, 450, 0, 40000 + 22000 + 8000 + 3600 + 1980 + ua + 450, 1000, 450, 60, 5000, 800];
  });
  const zeroRow: CellValue[] = [null, 0, 0, null, null, null, null, null, null, 0];
  const totals: CellValue[] = ['TOTAL', ...headings.slice(1).map((_, column) => months.reduce((sum, row) => sum + Number(row[column + 1] ?? 0), 0))];
  const rows: CellValue[][] = [
    [null, null, null, null, null, 'Statement of Salary for the year 2025-26'],
    [],
    ['Name of employee:  Second Person', null, null, null, null, null, null, null, null, 'Designation:  Assistant'],
    [],
    headings,
    ...months,
    zeroRow,
    totals,
    [],
    [null, 'Dealing Hand', null, null, null, null, null, 'Checked by'],
    [],
  ];
  return rows.map(row => [null, ...row]);
}

function twoEmployeeGrid(): SheetGrid {
  const first = statementGrid().rows.map(row => row.map(cell => cell.value));
  const rows = [...first, [], ...gpfBlock()];
  return { name: 'Sheet1', hidden: false, rows: rows.map(row => row.map((value): GridCell => ({ value }))) };
}

describe('several employees in one sheet', () => {
  it('reads each block with its own name, columns and rows', () => {
    const result = parseStatementSheet(twoEmployeeGrid(), { id: 't', fileName: 'test.xlsx' });
    expect(messages(result, 'error')).toEqual([]);
    expect(messages(result, 'warning')).toEqual([]);
    expect(result.statements.map(statement => statement.employeeName)).toEqual(['Test Person', 'Second Person']);
    expect(new Set(result.statements.map(statement => statement.id)).size).toBe(2);
    const [first, second] = result.statements;
    expect(first).toMatchObject({ designation: 'Scientist C', financialYear: '2025-26' });
    expect(first.rows).toHaveLength(13);
    expect(second).toMatchObject({ designation: 'Assistant', financialYear: '2025-26' });
    // The unlabelled row of zeros is not an arrear.
    expect(second.rows.map(row => row.kind)).toEqual(Array(12).fill('month'));
    expect(second.columns).toEqual(expect.arrayContaining(['ua', 'wa', 'gpf', 'lic']));
    expect(second.rows[6].values).toMatchObject({ ua: 20000, wa: 450, gpf: 5000, lic: 800 });
    expect(second.signatures).toEqual(['Dealing Hand', 'Checked by']);
  });

  it('tags each block’s messages with the employee', () => {
    const grid = twoEmployeeGrid();
    // A text amount in the second block.
    const row = grid.rows.findIndex(cells => cells[2]?.value === 40000);
    grid.rows[row][3] = { value: 'abc' };
    const result = parseStatementSheet(grid, { id: 't', fileName: 'test.xlsx' });
    const error = result.issues.find(issue => issue.severity === 'error');
    expect(error?.employee).toBe('Second Person');
    expect(error?.message).toContain(`D${row + 1}`);
    expect(result.statements.map(statement => statement.employeeName)).toEqual(['Test Person']);
  });

  it('counts GPF and LIC under 80C in the old regime only', () => {
    const second = parseStatementSheet(twoEmployeeGrid(), { id: 't', fileName: 'test.xlsx' }).statements[1];
    const tax = computeStatementTax(second, { ...DEFAULT_DECLARATIONS, regime: 'old' });
    expect(salaryFigures(tax.annual)).toMatchObject({ gpf: 60000, lic: 9600 });
    expect(tax.annual.totals.gross).toBe(12 * (40000 + 22000 + 8000 + 3600 + 1980 + 450) + 20000);
    const old = tax.chosen.regime === 'old' ? tax.chosen : tax.alternative;
    const fresh = tax.chosen.regime === 'new' ? tax.chosen : tax.alternative;
    expect(JSON.stringify(old)).toContain('GPF subscription from salary');
    expect(JSON.stringify(fresh)).not.toContain('GPF subscription from salary');
  });

  it('exports everyone into one workbook with the extra columns', async () => {
    const statements = parseStatementSheet(twoEmployeeGrid(), { id: 't', fileName: 'test.xlsx' }).statements;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await buildExportWorkbook(statements.map(statement => exportItem(statement, DEFAULT_DECLARATIONS))));
    const names = workbook.worksheets.map(sheet => sheet.name);
    expect(names[0]).toBe('Summary');
    const summary = workbook.getWorksheet('Summary')!;
    expect(summary.getCell('A4').value).toBe('Total, 2 employees');
    expect(summary.getCell('G4').value).toMatchObject({ formula: 'SUM(G2:G3)' });
    const salary = workbook.worksheets.find(sheet => sheet !== workbook.worksheets[0] && JSON.stringify(sheet.getRow(9).values).includes('"WA"'));
    expect(salary).toBeDefined();
    const headers = (salary!.getRow(9).values as unknown[]).slice(1);
    const gross = salary!.getCell(10, headers.indexOf('GROSS PAY') + 1).value as { formula: string };
    expect(gross.formula).toMatch(/^SUM\(B10:K10\)\+R10\+S10$/);
  });
});

describe('pay slips', () => {
  it('nets deductions off gross pay and notes the rates', () => {
    const statement = sampleStatement();
    const slip = buildSlip(statement.rows[11]);
    expect(slip.title).toBe('Pay slip for February 2026');
    expect(slip.net).toBe(slip.gross - slip.totalDeductions);
    expect(slip.earnings.find(line => line.label.startsWith('Dearness'))?.note).toBe('58% of basic pay + NPA');
    expect(slip.deductions.find(line => line.label.startsWith('Income tax'))?.note).toBe('not deducted yet');
    expect(slip.netInWords).toMatch(/^Rupees .+ Only$/);
    expect(buildSlip(statement.rows[12]).title).toBe('Supplementary pay slip: DA ARR');
  });
});
