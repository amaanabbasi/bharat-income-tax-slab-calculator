import { looksLikeDeclarations, parseDeclarationsSheet } from './parseDeclarations';
import { parseStatementSheet } from './parseStatement';
import { readGrids } from './readWorkbook';
import { type Declarations } from '../engine/declarations';
import { COLUMNS } from '../format/salaryStatement';
import { type Issue, type SalaryStatement } from '../model';

export interface ImportedFile {
  fileName: string;
  statements: SalaryStatement[];
  /** Declarations read from the file, by statement id. */
  declarations: Record<string, Partial<Declarations>>;
  issues: Issue[];
  /** Sheets that aren't salary statements (notes, summaries…). */
  skippedSheets: string[];
}

export async function importFile(fileName: string, buffer: ArrayBuffer, fileId: string, today?: Date): Promise<ImportedFile> {
  const { grids, issues } = await readGrids(fileName, buffer);
  const result: ImportedFile = { fileName, statements: [], declarations: {}, issues, skippedSheets: [] };
  if (!grids.length)
    return result;

  const declarationSheets = grids.filter(looksLikeDeclarations);
  let statementLike = 0;
  grids.forEach((grid, index) => {
    if (declarationSheets.includes(grid))
      return;
    const parsed = parseStatementSheet(grid, { id: `${fileId}:${index}`, fileName, today });
    result.issues.push(...parsed.issues);
    if (parsed.looksLikeStatement)
      statementLike += 1;
    else if (grid.rows.some(row => row.some(cell => cell.value !== null)))
      result.skippedSheets.push(grid.name);
    if (parsed.statement)
      result.statements.push(parsed.statement);
  });

  if (!statementLike) {
    const headings = COLUMNS.map(column => column.header).join(', ');
    result.issues.push({
      severity: 'error',
      message: `No salary statement found in “${fileName}”: none of its sheets has the column headings.`,
      fix: `The headings row should read: ${headings}. Download the template to start from the right layout.`,
    });
  }
  for (const grid of declarationSheets) {
    const parsed = parseDeclarationsSheet(grid, result.statements);
    result.issues.push(...parsed.issues);
    for (const [id, values] of Object.entries(parsed.byStatement))
      result.declarations[id] = { ...result.declarations[id], ...values };
  }
  return result;
}
