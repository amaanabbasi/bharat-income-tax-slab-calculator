import {
  COLUMNS,
  type ColumnKey,
  EARNING_KEYS,
  NPA_CEILING,
  PAY_KEYS,
  type PayKey,
  TOTAL_LABELS,
  columnSpec,
} from '../format/salaryStatement';
import { formatAmount } from '../engine/money';
import {
  type Issue,
  MONTH_FULL_NAMES,
  type SalaryStatement,
  type Severity,
  type StatementRow,
  emptyPayValues,
  monthLabel,
} from '../model';
import { fyFromStartYear } from '../rules/taxRules';
import { type CellValue, type GridCell, type SheetGrid, cellRef, cellText, excelSerialToDate } from './grid';

const normalise = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '');

export function levenshtein(a: string, b: string): number {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = previous[j];
      previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return previous[b.length];
}

interface ColumnGuess {
  key: ColumnKey;
  /** False when the heading was matched despite a spelling difference. */
  exact: boolean;
  distance: number;
}

/** Matches a heading to a column of the format, tolerating small spelling mistakes. */
export function guessColumn(text: string): ColumnGuess | null {
  const wanted = normalise(text);
  if (!wanted)
    return null;
  let best: ColumnGuess | null = null;
  for (const spec of COLUMNS) {
    for (const name of [spec.header, ...spec.aliases]) {
      const candidate = normalise(name);
      if (wanted === candidate)
        return { key: spec.key, exact: true, distance: 0 };
      // A known heading followed by a rate or unit, e.g. "DA (58%)" or "Gross Pay (Rs)".
      if (wanted.startsWith(candidate)) {
        const rest = wanted.slice(candidate.length);
        if (candidate.length >= 4 || /^\d+$/.test(rest) || ['rs', 'inr', 'amt', 'amount'].includes(rest)) {
          if (!best || !best.exact)
            best = { key: spec.key, exact: true, distance: 0 };
          continue;
        }
      }
      // Two- and three-letter headings (DA, NA, HRA…) differ by one letter from each other.
      if (wanted.length <= 3 || candidate.length <= 3)
        continue;
      const distance = levenshtein(wanted, candidate);
      const allowed = Math.max(wanted.length, candidate.length) <= 6 ? 1 : 2;
      if (distance <= allowed && (!best || (!best.exact && distance < best.distance)))
        best = { key: spec.key, exact: false, distance };
    }
  }
  return best;
}

interface HeaderCell extends ColumnGuess {
  col: number;
  text: string;
}

function findHeaderRow(grid: SheetGrid): { row: number, cells: HeaderCell[] } | null {
  let best: { row: number, cells: HeaderCell[], distinct: number } | null = null;
  for (let row = 0; row < Math.min(grid.rows.length, 60); row++) {
    const cells: HeaderCell[] = [];
    grid.rows[row].forEach((cell, col) => {
      const text = typeof cell.value === 'string' ? cellText(cell) : '';
      if (!text || text.length > 60)
        return;
      const guess = guessColumn(text);
      if (guess)
        cells.push({ ...guess, col, text });
    });
    const keys = new Set(cells.map(cell => cell.key));
    if (keys.size >= 4 && (keys.has('month') || keys.has('basic')) && (!best || keys.size > best.distinct))
      best = { row, cells, distinct: keys.size };
  }
  return best;
}

interface NumberRead {
  value: number;
  blank: boolean;
  problem?: 'text' | 'noResult' | 'error';
  detail?: string;
}

function readNumber(cell: GridCell | undefined): NumberRead {
  if (!cell || cell.value === null || cell.value === '') {
    if (cell?.noResult)
      return { value: 0, blank: false, problem: 'noResult' };
    if (cell?.error)
      return { value: 0, blank: false, problem: 'error', detail: cell.error };
    return { value: 0, blank: true };
  }
  const value = cell.value;
  if (typeof value === 'number')
    return { value, blank: false };
  if (typeof value === 'boolean' || value instanceof Date)
    return { value: 0, blank: false, problem: 'text', detail: cellText(cell) };
  const text = value.trim();
  if (!text)
    return { value: 0, blank: true };
  if (['-', '–', '—', 'nil', 'na', 'n/a'].includes(text.toLowerCase()))
    return { value: 0, blank: false };
  const cleaned = text.replace(/[₹,\s]|rs\.?/gi, '');
  const bracketed = /^\(.*\)$/.test(cleaned);
  const parsed = Number(bracketed ? cleaned.slice(1, -1) : cleaned);
  if (cleaned && Number.isFinite(parsed))
    return { value: bracketed ? -parsed : parsed, blank: false };
  return { value: 0, blank: false, problem: 'text', detail: text };
}

function monthFromName(word: string): number | null {
  const lower = word.toLowerCase().replace(/\.$/, '');
  if (lower.length < 3)
    return null;
  const index = MONTH_FULL_NAMES.findIndex(name => name.toLowerCase().startsWith(lower));
  return index >= 0 ? index + 1 : null;
}

function fullYear(text: string): number {
  const year = Number(text);
  return text.length === 2 ? 2000 + year : year;
}

/** Month cell → calendar month (and year when the cell has one). */
export function parseMonth(value: CellValue): { month: number, year?: number } | null {
  if (value instanceof Date)
    return { month: value.getUTCMonth() + 1, year: value.getUTCFullYear() };
  if (typeof value === 'number' && value > 20000 && value < 80000) {
    const date = excelSerialToDate(value);
    return { month: date.getUTCMonth() + 1, year: date.getUTCFullYear() };
  }
  if (typeof value !== 'string')
    return null;
  const text = value.trim().toLowerCase();
  const named = text.match(/^([a-z]{3,9}\.?)[\s\-'’.,/]*(\d{2}|\d{4})?$/);
  if (named) {
    const month = monthFromName(named[1]);
    if (month)
      return { month, year: named[2] ? fullYear(named[2]) : undefined };
  }
  const numericMonthFirst = text.match(/^(\d{1,2})[/\-.](\d{2}|\d{4})$/);
  if (numericMonthFirst && Number(numericMonthFirst[1]) >= 1 && Number(numericMonthFirst[1]) <= 12)
    return { month: Number(numericMonthFirst[1]), year: fullYear(numericMonthFirst[2]) };
  const numericYearFirst = text.match(/^(\d{4})[/\-.](\d{1,2})$/);
  if (numericYearFirst && Number(numericYearFirst[2]) >= 1 && Number(numericYearFirst[2]) <= 12)
    return { month: Number(numericYearFirst[2]), year: Number(numericYearFirst[1]) };
  return null;
}

function isTotalRow(cells: GridCell[], monthCol: number): boolean {
  for (let col = 0; col <= Math.min(cells.length - 1, monthCol + 1); col++) {
    const text = normalise(cellText(cells[col]));
    if (text && TOTAL_LABELS.some(label => text === normalise(label) || text.startsWith('total')))
      return true;
  }
  return false;
}

function list(refs: string[], max = 4): string {
  return refs.length <= max ? refs.join(', ') : `${refs.slice(0, max).join(', ')} and ${refs.length - max} more`;
}

export interface StatementParse {
  /** False when the sheet has no salary-statement headings at all (e.g. a notes sheet). */
  looksLikeStatement: boolean;
  /** Null when there are errors that must be fixed first. */
  statement: SalaryStatement | null;
  issues: Issue[];
}

export function parseStatementSheet(grid: SheetGrid, options: { id: string, fileName: string, today?: Date }): StatementParse {
  const issues: Issue[] = [];
  const add = (severity: Severity, message: string, fix?: string, cell?: string) =>
    issues.push({ severity, message, fix, sheet: grid.name, cell });

  const header = findHeaderRow(grid);
  if (!header)
    return { looksLikeStatement: false, statement: null, issues };
  const headerRowNumber = header.row + 1;

  // Columns
  const columnOf = new Map<ColumnKey, number>();
  for (const spec of COLUMNS) {
    const candidates = header.cells
      .filter(cell => cell.key === spec.key)
      .sort((a, b) => Number(b.exact) - Number(a.exact) || a.distance - b.distance || a.col - b.col);
    if (!candidates.length)
      continue;
    const [chosen, ...extra] = candidates;
    columnOf.set(spec.key, chosen.col);
    if (!chosen.exact) {
      add('warning', `Heading “${chosen.text}” in ${cellRef(header.row, chosen.col)} looks like a misspelling of “${spec.header}”, so it was read as ${spec.label}.`,
        `Change the heading to “${spec.header}” so there’s no doubt.`, cellRef(header.row, chosen.col));
    }
    for (const other of extra) {
      add('warning', `“${other.text}” in ${cellRef(header.row, other.col)} is a second ${spec.header} column, so it was ignored.`,
        `Keep one “${spec.header}” column, or rename the other one.`, cellRef(header.row, other.col));
    }
  }
  const usedColumns = new Set(columnOf.values());
  grid.rows[header.row].forEach((cell, col) => {
    const text = cellText(cell);
    if (!text || usedColumns.has(col) || header.cells.some(guess => guess.col === col))
      return;
    if (/nps/i.test(text)) {
      add('warning', `Column “${text}” (${cellRef(header.row, col)}) doesn’t say whose NPS share it is, so it was skipped.`,
        'Head the employee share “NPS(10%)” and the Government share “NPS(14%)”.', cellRef(header.row, col));
      return;
    }
    add('warning', `Column “${text}” (${cellRef(header.row, col)}) isn’t part of the salary statement format, so it was skipped.`,
      'If it is taxable pay, move the amounts into “Others”. Deductions other than I.T., CGHS, GIS and NPS can be left out.', cellRef(header.row, col));
  });

  const missingRequired = COLUMNS.filter(spec => spec.required && !columnOf.has(spec.key));
  for (const spec of missingRequired) {
    add('error', `Column “${spec.header}” (${spec.label}) is missing from the headings in row ${headerRowNumber}.`,
      `Add a column headed “${spec.header}” in row ${headerRowNumber}. ${spec.description}`);
  }
  const quietlyZero: string[] = [];
  for (const spec of COLUMNS) {
    if (spec.required || columnOf.has(spec.key))
      continue;
    if (spec.key === 'gross')
      add('info', 'There’s no “GROSS PAY” column, so gross pay was added up from the pay columns.');
    else if (['incomeTax', 'npsGovt', 'npsEmployee', 'hra'].includes(spec.key))
      add('warning', `Column “${spec.header}” (${spec.label}) wasn’t found, so it counts as zero.`, `If it’s there under another heading, rename that heading to “${spec.header}”.`);
    else
      quietlyZero.push(spec.header);
  }
  if (quietlyZero.length)
    add('info', `Optional columns not in this sheet, counted as zero: ${quietlyZero.join(', ')}.`);
  if (missingRequired.length)
    return { looksLikeStatement: true, statement: null, issues };

  // Details above the table
  const textAbove: { text: string, row: number, col: number }[] = [];
  for (let row = 0; row < header.row; row++) {
    grid.rows[row].forEach((cell, col) => {
      const text = typeof cell.value === 'string' ? cellText(cell) : '';
      if (text)
        textAbove.push({ text, row, col });
    });
  }
  const labelled = (pattern: RegExp) => {
    for (const item of textAbove) {
      const match = item.text.match(pattern);
      if (!match)
        continue;
      const inline = (match[1] ?? match[2])?.trim();
      if (inline)
        return { value: inline, item };
      const next = textAbove.find(other => other.row === item.row && other.col > item.col);
      if (next)
        return { value: next.text, item };
    }
    return null;
  };
  // A bare "Name" needs a colon, so "Name of the Institute" isn't taken for the employee.
  const name = labelled(/^(?:name\s*of\s*(?:the\s*)?employee|employee'?s?\s*name)\s*[:\-–]?\s*(.*)$|^name\s*[:\-–]\s*(.*)$/i);
  const designation = labelled(/^(?:designation|post\b)\s*[:\-–]?\s*(.*)$/i);
  const titleItem = textAbove.find(item => /statement\s+of\s+(?:salary|pay)|salary\s+statement|for\s+the\s+(?:financial\s+)?year/i.test(item.text));
  const organisationItem = textAbove.find(item => item !== titleItem && item !== name?.item && item !== designation?.item
    && item.row < (titleItem?.row ?? name?.item.row ?? header.row) && !/^(?:name|designation)/i.test(item.text));

  let startYear: number | null = null;
  const yearMatch = titleItem?.text.match(/(20\d{2})\s*[-–/]\s*(\d{2}|20\d{2})/);
  if (yearMatch)
    startYear = Number(yearMatch[1]);

  // Rows
  const monthCol = columnOf.get('month') as number;
  const rows: (StatementRow & { typedYear?: number, cell: string })[] = [];
  const badNumbers: string[] = [];
  const noResults: string[] = [];
  const errorCells: string[] = [];
  const blankGrossRows: string[] = [];
  let totalRow = -1;
  let blankRun = 0;
  for (let row = header.row + 1; row < Math.min(grid.rows.length, header.row + 200); row++) {
    const cells = grid.rows[row] ?? [];
    if (isTotalRow(cells, monthCol)) {
      totalRow = row;
      break;
    }
    const values = emptyPayValues();
    const reads = new Map<PayKey, NumberRead>();
    for (const key of PAY_KEYS) {
      const col = columnOf.get(key);
      if (col === undefined)
        continue;
      const read = readNumber(cells[col]);
      reads.set(key, read);
      values[key] = read.value;
    }
    const label = cellText(cells[monthCol]);
    const hasNumbers = Array.from(reads.values()).some(read => !read.blank && !read.problem);
    if (!label && !hasNumbers) {
      blankRun += 1;
      // Two empty rows after the table: what follows is notes or signatures.
      if (blankRun >= 2 && rows.length)
        break;
      continue;
    }
    blankRun = 0;
    const month = parseMonth(cells[monthCol]?.value ?? null);
    const hasProblems = Array.from(reads.values()).some(read => read.problem);
    // A label with nothing beside it (a note, an empty arrear line) adds nothing.
    if (!month && !hasNumbers && !hasProblems)
      continue;
    reads.forEach((read, key) => {
      const ref = cellRef(row, columnOf.get(key) as number);
      if (read.problem === 'text')
        badNumbers.push(`${ref} (“${read.detail}”)`);
      else if (read.problem === 'noResult')
        noResults.push(ref);
      else if (read.problem === 'error')
        errorCells.push(`${ref} (${read.detail})`);
    });
    const earnings = EARNING_KEYS.reduce((sum, key) => sum + values[key], 0);
    if (!columnOf.has('gross') || reads.get('gross')?.blank) {
      if (columnOf.has('gross') && earnings)
        blankGrossRows.push(cellRef(row, columnOf.get('gross') as number));
      values.gross = earnings;
    }
    const base = {
      sheetRow: row + 1,
      values,
      taxPending: reads.get('incomeTax')?.blank ?? true,
      cell: cellRef(row, monthCol),
    };
    if (month)
      rows.push({ ...base, kind: 'month', month: month.month, typedYear: month.year, label: '' });
    else
      rows.push({ ...base, kind: 'arrear', label: label || `Row ${row + 1}` });
    if (!label)
      add('warning', `Row ${row + 1} has amounts but no month or label, so it was counted as an arrear row.`, `Type the month (e.g. Mar-25) or a label such as “DA ARR” in ${cellRef(row, monthCol)}.`, cellRef(row, monthCol));
  }

  if (badNumbers.length)
    add('error', `These cells should hold amounts but contain text: ${list(badNumbers)}.`, 'Type plain numbers (commas and ₹ are fine). Leave a cell empty, or type 0, if there is nothing to pay.');
  if (noResults.length)
    add('error', `${list(noResults)} ${noResults.length === 1 ? 'has a formula' : 'have formulas'} with no saved result.`, 'Open the file in Excel, press Ctrl+Alt+F9 to recalculate, save, and upload it again.');
  if (errorCells.length)
    add('error', `Formula errors in ${list(errorCells)}.`, 'Fix those formulas in Excel so they show numbers, save, and upload again.');
  if (blankGrossRows.length)
    add('info', `GROSS PAY was empty in ${list(blankGrossRows)}, so it was added up from the pay columns.`);

  const monthRows = rows.filter(row => row.kind === 'month');
  if (!monthRows.length) {
    add('error', `No month rows were found under the headings in row ${headerRowNumber}.`, 'Put one row per month below the headings (Mar-25, Apr-25, …), with the month as a date or text like “Mar 2025”.');
    return { looksLikeStatement: true, statement: null, issues };
  }

  // Which pay year: from the title, else from the first month.
  const first = monthRows[0];
  const startMonth = first.month === 4 ? 4 : 3;
  if (startYear === null) {
    if (first.typedYear)
      startYear = (first.month as number) >= startMonth ? first.typedYear : first.typedYear - 1;
    else {
      const today = options.today ?? new Date();
      startYear = today.getUTCMonth() + 1 >= startMonth ? today.getUTCFullYear() : today.getUTCFullYear() - 1;
    }
    add('info', `The title doesn’t say which year this is, so it was read as ${fyFromStartYear(startYear)} from the months.`, 'Write the year in the title, e.g. “Statement of Salary for the year 2025-26”.');
  }
  const financialYear = fyFromStartYear(startYear);
  for (const row of monthRows) {
    const expectedYear = (row.month as number) >= startMonth ? startYear : startYear + 1;
    if (row.typedYear && row.typedYear !== expectedYear) {
      add('warning', `${row.cell} reads ${MONTH_FULL_NAMES[(row.month as number) - 1]} ${row.typedYear}, but this statement is for ${financialYear}, so it was read as ${MONTH_FULL_NAMES[(row.month as number) - 1]} ${expectedYear}.`,
        `Correct the year in ${row.cell} to ${expectedYear}.`, row.cell);
    }
    row.year = expectedYear;
    row.label = monthLabel(expectedYear, row.month as number);
  }
  const seen = new Map<string, string[]>();
  for (const row of monthRows)
    seen.set(row.label, [...(seen.get(row.label) ?? []), `row ${row.sheetRow}`]);
  seen.forEach((where, label) => {
    if (where.length > 1)
      add('warning', `${label} appears ${where.length} times (${where.join(', ')}); all of them were counted.`, 'If one of them is an arrear, label it (e.g. “DA ARR”) instead of giving it a month.');
  });

  // Cross-checks against the template's formulas
  const mismatch = (key: PayKey, factor: number) => {
    const col = columnOf.get(key);
    if (col === undefined)
      return;
    const off: string[] = [];
    for (const row of rows) {
      const base = row.values.basic + row.values.npa + row.values.da;
      const read = grid.rows[(row.sheetRow as number) - 1]?.[col];
      if (!base || readNumber(read).blank)
        continue;
      const expected = Math.round(base * factor);
      if (Math.abs(row.values[key] - expected) > 1)
        off.push(`${cellRef((row.sheetRow as number) - 1, col)} (${formatAmount(row.values[key])}, expected ${formatAmount(expected)})`);
    }
    if (off.length) {
      const spec = columnSpec(key);
      add('warning', `${spec.header} isn’t ${Math.round(factor * 100)}% of (Pay Band + NPA + DA) in ${list(off, 3)}. The sheet’s figures were used.`,
        `Check the formula there; the template uses =${spec.formula}.`);
    }
  };
  mismatch('npsEmployee', 0.1);
  mismatch('npsGovt', 0.14);
  const grossCol = columnOf.get('gross');
  if (grossCol !== undefined) {
    const off: string[] = [];
    for (const row of rows) {
      const earnings = EARNING_KEYS.reduce((sum, key) => sum + row.values[key], 0);
      if (Math.abs(row.values.gross - earnings) > 1)
        off.push(`${cellRef((row.sheetRow as number) - 1, grossCol)} (${formatAmount(row.values.gross)} vs ${formatAmount(earnings)})`);
    }
    if (off.length)
      add('warning', `GROSS PAY doesn’t equal the sum of the pay columns in ${list(off, 3)}. The GROSS PAY figures were used.`, 'Check that GROSS PAY is =SUM(Pay Band:Others) on each row.');
  }
  const overCap = monthRows.filter(row => row.values.npa > 0 && row.values.basic + row.values.npa > NPA_CEILING + 1);
  if (overCap.length)
    add('warning', `Pay Band + NPA is above ₹${formatAmount(NPA_CEILING)} in ${list(overCap.map(row => row.label))}.`, `NPA is capped so that basic pay + NPA does not exceed ₹${formatAmount(NPA_CEILING)}.`);
  const negative = monthRows.filter(row => EARNING_KEYS.some(key => row.values[key] < 0));
  if (negative.length)
    add('warning', `Negative pay in ${list(negative.map(row => row.label))}.`, 'Put recoveries and adjustments in their own labelled row (e.g. “Inc. Arrear”), not in a month row.');

  // TOTAL row
  if (totalRow >= 0) {
    for (const key of PAY_KEYS) {
      const col = columnOf.get(key);
      if (col === undefined)
        continue;
      const read = readNumber(grid.rows[totalRow][col]);
      if (read.blank || read.problem)
        continue;
      const sum = rows.reduce((total, row) => total + row.values[key], 0);
      if (Math.abs(read.value - sum) > 1) {
        const ref = cellRef(totalRow, col);
        add('warning', `The TOTAL row shows ${formatAmount(read.value)} for ${columnSpec(key).header} (${ref}), but the rows above add up to ${formatAmount(sum)}. The rows were used.`,
          `Check that the SUM in ${ref} covers every month and arrear row.`, ref);
      }
    }
  }
  else {
    add('info', 'No TOTAL row was found, so the totals were added up from the rows.');
  }

  // Months still to come
  const noPayYet = monthRows.filter(row => !EARNING_KEYS.some(key => row.values[key] !== 0));
  if (noPayYet.length)
    add('info', `No salary yet for ${list(noPayYet.map(row => row.label), 6)}. Months after the last one paid are projected from it for the tax estimate (this can be turned off in Declarations).`);
  const pending = monthRows.filter(row => row.taxPending && EARNING_KEYS.some(key => row.values[key] !== 0));
  if (pending.length && columnOf.has('incomeTax'))
    add('info', `I.T. Ded. is blank for ${list(pending.map(row => row.label), 6)}, so no tax counts as deducted in ${pending.length === 1 ? 'that month' : 'those months'} yet.`);

  if (issues.some(issue => issue.severity === 'error'))
    return { looksLikeStatement: true, statement: null, issues };

  if (!name)
    add('warning', `“Name of employee:” wasn’t found above the table, so the sheet name “${grid.name}” is used as the name.`, 'Write “Name of employee:  <name>” above the headings (cell A7 in the template).');

  // Signatures below the table
  const signatures: string[] = [];
  if (totalRow >= 0) {
    for (let row = totalRow + 1; row < Math.min(grid.rows.length, totalRow + 10); row++) {
      for (const cell of grid.rows[row]) {
        const text = typeof cell.value === 'string' ? cellText(cell) : '';
        if (text && !/^[\d,.\s₹-]+$/.test(text))
          signatures.push(text);
      }
    }
  }

  const statement: SalaryStatement = {
    id: options.id,
    fileName: options.fileName,
    sheetName: grid.name,
    organisation: organisationItem?.text ?? '',
    title: titleItem?.text ?? `Statement of Salary for the year ${financialYear}`,
    financialYear,
    employeeName: name?.value ?? grid.name,
    designation: designation?.value ?? '',
    rows: rows.map(({ typedYear: _typedYear, cell: _cell, ...row }) => row),
    columns: Array.from(columnOf.keys()),
    signatures,
    startMonth,
  };
  return { looksLikeStatement: true, statement, issues };
}
