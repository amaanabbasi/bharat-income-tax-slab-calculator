import { type Declarations, fieldByLabel, parseDeclarationValue } from '../engine/declarations';
import { type Issue, type SalaryStatement } from '../model';
import { type SheetGrid, cellRef, cellText } from './grid';

const normalise = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '');
const IGNORED_HEADERS = ['notes', 'note', 'help', 'remarks', 'description', 'details', 'explanation'];
const SHARED_HEADERS = ['value', 'values', 'amount', 'amounts', 'declaration', 'declared'];

/** A sheet named "Declarations", or one whose first column lists several declaration items. */
export function looksLikeDeclarations(grid: SheetGrid): boolean {
  if (/declar/i.test(grid.name))
    return true;
  return grid.rows.slice(0, 60).filter(row => fieldByLabel(cellText(row[0]))).length >= 3;
}

/**
 * Reads "Item | Value" rows. With one Value column the values apply to every statement in
 * the file; for several employees, head each value column with the sheet or employee name.
 */
export function parseDeclarationsSheet(grid: SheetGrid, statements: SalaryStatement[]): { byStatement: Record<string, Partial<Declarations>>, issues: Issue[] } {
  const issues: Issue[] = [];
  const byStatement: Record<string, Partial<Declarations>> = {};
  const labelCol = [0, 1, 2].find(col => grid.rows.filter(row => fieldByLabel(cellText(row[col]))).length >= 1) ?? 0;
  const firstLabelRow = grid.rows.findIndex(row => fieldByLabel(cellText(row[labelCol])));
  if (firstLabelRow < 0) {
    issues.push({ severity: 'warning', sheet: grid.name, message: `The “${grid.name}” sheet has no items I recognise, so it was skipped.`, fix: 'Use the Declarations sheet from the template: item names in column A, values in column B.' });
    return { byStatement, issues };
  }

  const headerRow = firstLabelRow > 0 ? grid.rows[firstLabelRow - 1] : [];
  const width = Math.max(...grid.rows.map(row => row.length));
  const valueColumns: { col: number, targets: SalaryStatement[] }[] = [];
  for (let col = labelCol + 1; col < width; col++) {
    const heading = normalise(cellText(headerRow[col]));
    if (IGNORED_HEADERS.includes(heading))
      continue;
    const hasValues = grid.rows.slice(firstLabelRow).some(row => cellText(row[col]));
    if (!hasValues)
      continue;
    if (!heading || SHARED_HEADERS.includes(heading)) {
      valueColumns.push({ col, targets: statements });
      continue;
    }
    const match = statements.filter(statement => [statement.sheetName, statement.employeeName].some((name) => {
      const wanted = normalise(name);
      return wanted && (wanted === heading || wanted.includes(heading) || heading.includes(wanted));
    }));
    if (match.length)
      valueColumns.push({ col, targets: match });
    else
      issues.push({ severity: 'warning', sheet: grid.name, cell: cellRef(firstLabelRow - 1, col), message: `Declarations column “${cellText(headerRow[col])}” doesn’t match any employee sheet, so it was skipped.`, fix: 'Head the column with the employee’s sheet name or name, or “Value” to apply it to everyone.' });
  }
  if (valueColumns.length === 1 && valueColumns[0].targets.length > 1)
    issues.push({ severity: 'info', sheet: grid.name, message: `The Declarations sheet has one value column, so it applies to all ${valueColumns[0].targets.length} employees in this file.` });

  const unknown: string[] = [];
  for (let row = firstLabelRow; row < grid.rows.length; row++) {
    const label = cellText(grid.rows[row][labelCol]);
    if (!label)
      continue;
    const field = fieldByLabel(label);
    if (!field) {
      unknown.push(`“${label}”`);
      continue;
    }
    for (const { col, targets } of valueColumns) {
      const cell = grid.rows[row][col];
      if (!cellText(cell))
        continue;
      const parsed = parseDeclarationValue(field, cell.value);
      if (!parsed.ok) {
        issues.push({ severity: 'warning', sheet: grid.name, cell: cellRef(row, col), message: `${field.label}: ${parsed.reason}, so it was left at the default.`, fix: field.help });
        continue;
      }
      for (const statement of targets)
        byStatement[statement.id] = { ...byStatement[statement.id], [field.key]: parsed.value };
    }
  }
  if (unknown.length)
    issues.push({ severity: 'info', sheet: grid.name, message: `Skipped Declarations rows I don’t recognise: ${unknown.slice(0, 5).join(', ')}${unknown.length > 5 ? '…' : ''}.`, fix: 'Download the template to see the item names it understands.' });
  return { byStatement, issues };
}
