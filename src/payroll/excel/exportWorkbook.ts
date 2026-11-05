import type { Borders, Cell, Fill, Font, Workbook, Worksheet } from 'exceljs';
import { columnLetter } from './grid';
import { loadExcel } from './readWorkbook';
import { DECLARATION_FIELDS, DEFAULT_DECLARATIONS, type Declarations, describeValue } from '../engine/declarations';
import { formatRupees } from '../engine/money';
import { type StatementTax, computeStatementTax } from '../engine/statementTax';
import { slabLabel } from '../engine/tax';
import { COLUMNS, type ColumnKey, type PayKey, TEMPLATE_KEYS, TEMPLATE_LAYOUT } from '../format/salaryStatement';
import { type SalaryStatement, type StatementRow } from '../model';
import { sampleStatement } from '../sample';

const FONT: Partial<Font> = { name: 'Calibri', size: 10 };
const BOLD: Partial<Font> = { ...FONT, bold: true };
const THIN = { style: 'thin' as const, color: { argb: 'FF000000' } };
const BOX: Partial<Borders> = { top: THIN, left: THIN, bottom: THIN, right: THIN };
const HEADING_FILL: Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF92D050' } };
const SOFT_FILL: Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
/** Indian digit grouping (12,34,567.00) in an Excel number format. */
const INDIAN_AMOUNT = '[>=10000000]##\\,##\\,##\\,##0.00;[>=100000]##\\,##\\,##0.00;##,##0.00';
const INDIAN_WHOLE = '[>=10000000]##\\,##\\,##\\,##0;[>=100000]##\\,##\\,##0;##,##0';

export interface ExportItem {
  statement: SalaryStatement;
  declarations: Declarations;
  tax: StatementTax;
}

/** Excel sheet names: 31 characters at most, no []:*?/\, unique in the workbook. */
function sheetName(wanted: string, used: Set<string>): string {
  const base = wanted.replace(/[[\]:*?/\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31) || 'Sheet';
  let name = base;
  for (let n = 2; used.has(name.toLowerCase()); n++)
    name = `${base.slice(0, 28)} (${n})`;
  used.add(name.toLowerCase());
  return name;
}

function shortName(statement: SalaryStatement): string {
  return statement.employeeName.replace(/^(dr|mr|mrs|ms|shri|smt)\.?\s+/i, '').split(/\s+/).slice(0, 2).join(' ');
}

function styleCell(cell: Cell, options: { font?: Partial<Font>, border?: boolean, fill?: Fill, numFmt?: string, align?: 'left' | 'right' | 'center', wrap?: boolean }) {
  cell.font = options.font ?? FONT;
  if (options.border)
    cell.border = BOX;
  if (options.fill)
    cell.fill = options.fill;
  if (options.numFmt)
    cell.numFmt = options.numFmt;
  if (options.align || options.wrap)
    cell.alignment = { horizontal: options.align, vertical: 'top', wrapText: options.wrap };
}

/** The rate behind a value, if it matches one of the template's formulas exactly. */
function matchRate(value: number, base: number, rates: number[], rounded: boolean): number | null {
  if (!base)
    return null;
  for (const rate of rates) {
    const expected = rounded ? Math.round(base * rate) : base * rate;
    if (Math.abs(expected - value) < 0.005)
      return rate;
  }
  return null;
}

const WHOLE_PERCENTS = Array.from({ length: 101 }, (_, n) => n / 100);
const HRA_RATES = [0.3, 0.27, 0.24, 0.2, 0.18, 0.16, 0.1, 0.09, 0.08];
const pct = (rate: number) => `${Math.round(rate * 100)}%`;

/** Formula for a cell of the statement, learned from the row's own numbers (null: keep the typed value). */
function formulaFor(key: PayKey, row: StatementRow, r: number, letter: (key: ColumnKey) => string, keys: ColumnKey[]): string | null {
  const v = row.values;
  const L = (k: ColumnKey) => `${letter(k)}${r}`;
  switch (key) {
    case 'npa':
      return v.npa && matchRate(v.npa, v.basic, [0.2], true) ? `ROUND(${L('basic')}*20%,0)` : null;
    case 'hra': {
      const rate = v.hra ? matchRate(v.hra, v.basic, HRA_RATES, false) : null;
      return rate ? `${L('basic')}*${pct(rate)}` : null;
    }
    case 'da': {
      const rate = v.da ? matchRate(v.da, v.basic + v.npa, WHOLE_PERCENTS, true) : null;
      return rate ? `ROUND((${L('basic')}+${L('npa')})*${pct(rate)},0)` : null;
    }
    case 'daOnTa': {
      const rate = v.daOnTa ? matchRate(v.daOnTa, v.tpt, WHOLE_PERCENTS, false) : null;
      return rate ? `${L('tpt')}*${pct(rate)}` : null;
    }
    case 'gross': {
      // Pay columns beyond the template's (such as UA and WA) sit after it, so they are added on.
      const extra = keys.filter(k => k === 'ua' || k === 'wa').map(L);
      return `SUM(${L('basic')}:${L('others')})${extra.map(ref => `+${ref}`).join('')}`;
    }
    case 'npsEmployee':
      return matchRate(v.npsEmployee, v.basic + v.npa + v.da, [0.1], true) !== null ? `ROUND((${L('basic')}+${L('npa')}+${L('da')})*10%,0)` : null;
    case 'npsGovt':
      return matchRate(v.npsGovt, v.basic + v.npa + v.da, [0.14], true) !== null ? `ROUND((${L('basic')}+${L('npa')}+${L('da')})*14%,0)` : null;
    default:
      return null;
  }
}

/** The salary statement in the office layout (headings in row 9, months from row 10, TOTAL and signatures). */
export function addStatementSheet(workbook: Workbook, statement: SalaryStatement, name: string, rows: StatementRow[] = statement.rows): Worksheet {
  const sheet = workbook.addWorksheet(name, { pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 } });
  // The office template's 17 columns, then any extra ones this statement has (UA, GPF, LIC…).
  const keys = COLUMNS.map(column => column.key).filter(key => TEMPLATE_KEYS.includes(key) || statement.columns.includes(key));
  const payKeys = keys.filter((key): key is PayKey => key !== 'month');
  const letter = (key: ColumnKey) => columnLetter(keys.indexOf(key));
  const widths = [10, 10, 9, 9, 10, 8, 9, 7, 7, 7, 8, 11, 10, 8, 7, 10, 10];
  keys.forEach((_, index) => {
    sheet.getColumn(index + 1).width = widths[index] ?? 9;
  });
  const put = (ref: string, value: string, font = BOLD) => {
    const cell = sheet.getCell(ref);
    cell.value = value;
    cell.font = font;
  };
  put(TEMPLATE_LAYOUT.organisationCell, statement.organisation);
  put(TEMPLATE_LAYOUT.titleCell, statement.title || `Statement of Salary for the year ${statement.financialYear}`);
  put(TEMPLATE_LAYOUT.nameCell, `Name of employee:  ${statement.employeeName}`, FONT);
  put(TEMPLATE_LAYOUT.designationCell, `Designation:  ${statement.designation}`, FONT);

  const headerRow = sheet.getRow(TEMPLATE_LAYOUT.headerRow);
  headerRow.height = 25.5;
  keys.forEach((key, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = COLUMNS.find(column => column.key === key)?.header ?? key;
    styleCell(cell, { font: BOLD, border: true, fill: HEADING_FILL, align: index === 0 ? 'left' : 'right', wrap: true });
  });

  const first = TEMPLATE_LAYOUT.firstDataRow;
  rows.forEach((row, index) => {
    const r = first + index;
    const excelRow = sheet.getRow(r);
    const monthCell = excelRow.getCell(1);
    if (row.kind === 'month' && row.year && row.month) {
      monthCell.value = new Date(Date.UTC(row.year, row.month - 1, 1));
      styleCell(monthCell, { font: BOLD, border: true, numFmt: 'mmm-yy', align: 'left' });
    }
    else {
      monthCell.value = row.label;
      styleCell(monthCell, { font: BOLD, border: true, align: 'left' });
    }
    payKeys.forEach((key, index) => {
      const cell = excelRow.getCell(index + 2);
      const value = row.values[key];
      if (key === 'incomeTax' && row.taxPending) {
        styleCell(cell, { border: true, align: 'right' });
        return;
      }
      const formula = formulaFor(key, row, r, letter, keys);
      cell.value = formula ? { formula, result: value } : value;
      styleCell(cell, { font: key === 'gross' ? BOLD : FONT, border: true, numFmt: key === 'gross' ? '0' : undefined, align: 'right' });
    });
  });

  const last = first + rows.length - 1;
  const totalRow = sheet.getRow(last + 2);
  totalRow.getCell(1).value = 'TOTAL';
  styleCell(totalRow.getCell(1), { font: BOLD, border: true, align: 'left' });
  payKeys.forEach((key, index) => {
    const cell = totalRow.getCell(index + 2);
    cell.value = { formula: `SUM(${letter(key)}${first}:${letter(key)}${last + 1})`, result: rows.reduce((sum, row) => sum + row.values[key], 0) };
    styleCell(cell, { font: BOLD, border: true, align: 'right' });
  });

  const signatures = statement.signatures.length >= 3 ? statement.signatures.slice(0, 3) : [...TEMPLATE_LAYOUT.signatures];
  const signatureRow = sheet.getRow(last + 6);
  [2, 8, 16].forEach((col, index) => {
    signatureRow.getCell(col).value = signatures[index];
    signatureRow.getCell(col).font = BOLD;
  });
  return sheet;
}

/** The income-tax computation in the layout of the office's "Calculation of Income Tax" sheet. */
export function addTaxSheet(workbook: Workbook, item: ExportItem, name: string): Worksheet {
  const { statement, tax } = item;
  const c = tax.chosen;
  const sheet = workbook.addWorksheet(name, { pageSetup: { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 } });
  sheet.getColumn(1).width = 66;
  sheet.getColumn(2).width = 16;
  sheet.getColumn(3).width = 18;

  let r = 1;
  const line = (label: string, amount?: number | null, options: { bold?: boolean, sub?: boolean, fill?: boolean, numFmt?: string } = {}) => {
    const row = sheet.getRow(r++);
    row.getCell(1).value = label;
    styleCell(row.getCell(1), { font: options.bold ? BOLD : FONT, border: true, fill: options.fill ? SOFT_FILL : undefined, wrap: true });
    for (const col of [2, 3])
      styleCell(row.getCell(col), { font: options.bold ? BOLD : FONT, border: true, fill: options.fill ? SOFT_FILL : undefined, numFmt: options.numFmt ?? INDIAN_AMOUNT, align: 'right' });
    if (amount !== undefined && amount !== null)
      row.getCell(options.sub ? 2 : 3).value = Math.round(amount * 100) / 100;
  };
  const text = (value: string, font = FONT) => {
    const row = sheet.getRow(r++);
    row.getCell(1).value = value;
    row.getCell(1).font = font;
    row.getCell(1).alignment = { wrapText: true, vertical: 'top' };
  };

  text(`CALCULATION OF INCOME TAX ${c.rules.label.toUpperCase()}`, { ...BOLD, size: 12 });
  if (statement.organisation)
    text(statement.organisation, BOLD);
  text(`Name of the employee: ${statement.employeeName}${statement.designation ? `, ${statement.designation}` : ''}`, BOLD);
  text(`${c.regimeRules.title}${c.regime === 'old' ? ` · age ${c.ageGroup === 'below60' ? 'below 60' : c.ageGroup === 'senior' ? '60-79' : '80+'}` : ''}`);
  r++;

  c.salaryLines.forEach((salaryLine, index) => {
    line(`${index === 0 ? 'Gross income from salary' : salaryLine.label}${salaryLine.section ? ` [u/s ${salaryLine.section}]` : ''}`, salaryLine.amount);
    for (const detail of salaryLine.detail ?? [])
      line(`      ${detail.label}`, detail.amount, { sub: true });
  });
  line('Income chargeable under the head “Salaries”', c.incomeFromSalary, { bold: true });
  for (const other of c.otherLines)
    line(`${other.label}${other.section ? ` [u/s ${other.section}]` : ''}`, other.amount);
  line('Gross total income', c.grossTotalIncome, { bold: true });
  if (c.deductionLines.length) {
    line('Less: deductions under Chapter VI-A');
    for (const deduction of c.deductionLines)
      line(`      ${deduction.section}: ${deduction.label}`, deduction.amount, { sub: true });
    line('Total deductions', c.totalDeductions);
  }
  line('Total taxable income', c.totalIncome, { bold: true });
  line('Total taxable income rounded off u/s 288A', c.taxableIncome, { bold: true, fill: true });
  for (const slab of c.slabs)
    line(`      Income ${slabLabel(slab).replace(/^Up to/, 'up to').replace(/^Above/, 'above')} [${slab.rate ? `${slab.rate}%` : 'NIL'}] on ${formatRupees(slab.amount)}`, slab.tax);
  line('Total tax', c.taxOnIncome, { bold: true });
  line(`Tax rebate u/s 87A (total income up to ${formatRupees(c.rebate.incomeUpTo)}${c.rebate.kind === 'marginal' ? ', marginal relief' : ''})`, c.rebate.amount);
  line('INCOME TAX', c.taxAfterRebate, { bold: true });
  line(c.surcharge.rate
    ? `Add: surcharge @${c.surcharge.rate}% (marginal relief ${c.surcharge.relief ? `of ${formatRupees(c.surcharge.relief, 2)}` : 'nil'})`
    : 'Add: surcharge (not applicable up to ₹50,00,000)', c.surcharge.amount);
  line('Total tax after surcharge', c.taxAfterRebate + c.surcharge.amount);
  line(`Add: Health & Education Cess @ ${c.cessPercent}% of income tax and surcharge`, c.cess);
  line('Tax payable', c.grossTax, { bold: true });
  if (c.relief89)
    line('Less: relief u/s 89 (Form 10E)', c.relief89);
  line('Tax payable rounded off u/s 288B', c.taxPayable, { bold: true, fill: true });
  line(`Income tax deducted${tax.annual.tdsPeriod ? ` (${tax.annual.tdsPeriod})` : ''}`, c.tdsDeducted);
  if (c.previousEmployerTds)
    line('Tax deducted by previous employer', c.previousEmployerTds);
  line(c.balance >= 0 ? 'Balance tax to be recovered' : 'Tax deducted in excess (refund through the return)', Math.abs(c.balance), { bold: true, fill: true });
  if (tax.recovery) {
    line(tax.recovery.months.length === 1
      ? `Recover ${formatRupees(tax.recovery.perMonth)} from the ${tax.recovery.months[0]} salary`
      : `Recover ${formatRupees(tax.recovery.perMonth)} a month from the salaries of ${tax.recovery.months.join(', ')}`);
  }
  r++;

  const salaryBase = [
    ['B.P', tax.annual.totals.basic],
    ...(item.declarations.npaInSalary ? [['NPA', tax.annual.totals.npa] as [string, number]] : []),
    ['D.A', tax.annual.totals.da],
  ] as [string, number][];
  for (const [label, amount] of salaryBase)
    line(`      ${label}`, amount, { sub: true });
  const total = salaryBase.reduce((sum, [, amount]) => sum + amount, 0);
  line(`      TOTAL (14% = ${formatRupees(Math.round(total * 0.14))}, the 80CCD(2) limit)`, total, { sub: true, bold: true });
  r++;

  text('Notes', BOLD);
  for (const note of [...tax.notes, ...c.notes])
    text(`• ${note}`);
  r += 2;
  const signatures = statement.signatures.length ? statement.signatures : [...TEMPLATE_LAYOUT.signatures];
  const signatureRow = sheet.getRow(r);
  signatureRow.getCell(3).value = signatures[signatures.length - 1];
  signatureRow.getCell(3).font = BOLD;
  return sheet;
}

/** "Item | Value | Notes"; with several employees, one value column each. */
export function addDeclarationsSheet(workbook: Workbook, entries: { label: string, declarations: Declarations }[], name = 'Declarations'): Worksheet {
  const sheet = workbook.addWorksheet(name);
  sheet.getColumn(1).width = 70;
  entries.forEach((_, index) => {
    sheet.getColumn(index + 2).width = 18;
  });
  sheet.getColumn(entries.length + 2).width = 80;
  const header = sheet.getRow(1);
  ['Item', ...entries.map(entry => entry.label), 'Notes'].forEach((value, index) => {
    header.getCell(index + 1).value = value;
    styleCell(header.getCell(index + 1), { font: BOLD, border: true, fill: HEADING_FILL });
  });
  DECLARATION_FIELDS.forEach((field, index) => {
    const row = sheet.getRow(index + 2);
    row.getCell(1).value = field.label;
    styleCell(row.getCell(1), { border: true, wrap: true });
    entries.forEach((entry, column) => {
      const value = entry.declarations[field.key];
      const cell = row.getCell(column + 2);
      cell.value = field.kind === 'amount' ? Number(value ?? 0) : describeValue(field, value) || null;
      styleCell(cell, { border: true, numFmt: field.kind === 'amount' ? INDIAN_WHOLE : undefined, align: 'right' });
    });
    row.getCell(entries.length + 2).value = `${field.help}${field.regimes.length === 1 ? ' (old regime only)' : ''}`;
    styleCell(row.getCell(entries.length + 2), { wrap: true });
  });
  return sheet;
}

function addSummarySheet(workbook: Workbook, items: ExportItem[]): Worksheet {
  const sheet = workbook.addWorksheet('Summary');
  const headings = ['Employee', 'Designation', 'Year', 'Regime', 'Gross salary', 'Total income (288A)', 'Tax payable (288B)', 'Tax deducted', 'Balance (+ recover / − excess)', 'Recover a month', 'Other regime would be'];
  headings.forEach((heading, index) => {
    const cell = sheet.getRow(1).getCell(index + 1);
    cell.value = heading;
    styleCell(cell, { font: BOLD, border: true, fill: HEADING_FILL, wrap: true });
    sheet.getColumn(index + 1).width = index < 2 ? 28 : 16;
  });
  items.forEach(({ statement, tax }, index) => {
    const c = tax.chosen;
    const values = [statement.employeeName, statement.designation, c.fy, c.regime === 'new' ? 'New' : 'Old', Math.round(tax.annual.totals.gross * 100) / 100, c.taxableIncome, c.taxPayable, c.tdsDeducted + c.previousEmployerTds, c.balance, tax.recovery?.perMonth ?? 0, tax.alternative.taxPayable];
    values.forEach((value, column) => {
      const cell = sheet.getRow(index + 2).getCell(column + 1);
      cell.value = value;
      styleCell(cell, { border: true, numFmt: typeof value === 'number' ? INDIAN_WHOLE : undefined, align: typeof value === 'number' ? 'right' : 'left' });
    });
  });
  // Totals under the amounts (Gross salary onwards), as formulas so they follow any edits.
  const totalRow = sheet.getRow(items.length + 2);
  headings.forEach((_, column) => {
    const cell = totalRow.getCell(column + 1);
    if (column === 0)
      cell.value = `Total, ${items.length} employees`;
    else if (column >= 4) {
      const letter = columnLetter(column);
      const result = items.reduce((sum, _, index) => sum + Number(sheet.getRow(index + 2).getCell(column + 1).value ?? 0), 0);
      cell.value = { formula: `SUM(${letter}2:${letter}${items.length + 1})`, result };
    }
    styleCell(cell, { font: BOLD, border: true, numFmt: column >= 4 ? INDIAN_WHOLE : undefined, align: column >= 4 ? 'right' : 'left' });
  });
  return sheet;
}

function addReadMeSheet(workbook: Workbook): Worksheet {
  const sheet = workbook.addWorksheet('Read me');
  sheet.getColumn(1).width = 16;
  sheet.getColumn(2).width = 12;
  sheet.getColumn(3).width = 90;
  const rows: [string, string, string][] = [
    ['Salary statement format', '', 'One sheet per employee, or several employees one below the other in a sheet. Keep each block\u2019s headings in one row; months go below them, then arrear rows, then a TOTAL row.'],
    ['', '', 'Upload the workbook at income-tax.amaanabbasi.me/payroll. It is read in your browser and never uploaded.'],
    ['Heading', 'Filled by', 'What it holds'],
    ...COLUMNS.map(column => [column.header, column.source === 'formula' ? `formula ${column.formula ? `=${column.formula}` : ''}` : 'typed in', `${column.label}${column.required ? ' (required)' : ''}. ${column.description}`] as [string, string, string]),
    ['', '', ''],
    ['Declarations', '', 'Optional. Fill the Declarations sheet for the old regime, other income, a previous employer or relief u/s 89. Leave it at the defaults for the new regime on salary alone.'],
  ];
  rows.forEach((values, index) => {
    const row = sheet.getRow(index + 1);
    values.forEach((value, column) => {
      row.getCell(column + 1).value = value;
      styleCell(row.getCell(column + 1), { font: index === 0 || index === 2 ? BOLD : FONT, wrap: true });
    });
  });
  return sheet;
}

async function toBuffer(workbook: Workbook): Promise<ArrayBuffer> {
  const data = await workbook.xlsx.writeBuffer();
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data as unknown as ArrayBufferLike);
  return bytes.slice().buffer;
}

async function newWorkbook(): Promise<Workbook> {
  const ExcelJS = await loadExcel();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Salary & Tax Desk';
  workbook.created = new Date();
  return workbook;
}

/** A filled-in example in the office layout, with a Declarations sheet and a Read me. */
export async function buildTemplateWorkbook(): Promise<ArrayBuffer> {
  const workbook = await newWorkbook();
  addStatementSheet(workbook, sampleStatement(), 'Sheet1');
  addDeclarationsSheet(workbook, [{ label: 'Value', declarations: DEFAULT_DECLARATIONS }]);
  addReadMeSheet(workbook);
  return toBuffer(workbook);
}

/** Tax sheets, statements, declarations and, for several employees, a summary. */
export async function buildExportWorkbook(items: ExportItem[]): Promise<ArrayBuffer> {
  const workbook = await newWorkbook();
  const used = new Set<string>();
  if (items.length > 1)
    addSummarySheet(workbook, items);
  for (const item of items) {
    const base = items.length > 1 ? shortName(item.statement) : '';
    addTaxSheet(workbook, item, sheetName(base ? `${base} - Tax` : 'Income tax', used));
    // The statement holds the rows as drawn; projected months only feed the tax estimate.
    addStatementSheet(workbook, item.statement, sheetName(base ? `${base} - Salary` : item.statement.sheetName || 'Salary statement', used));
  }
  addDeclarationsSheet(workbook, items.map(item => ({ label: items.length > 1 ? item.statement.employeeName : 'Value', declarations: item.declarations })), sheetName('Declarations', used));
  return toBuffer(workbook);
}

export function exportItem(statement: SalaryStatement, declarations: Declarations): ExportItem {
  return { statement, declarations, tax: computeStatementTax(statement, declarations) };
}
