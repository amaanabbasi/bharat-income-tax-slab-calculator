/** A sheet reduced to plain values, so parsing does not depend on the Excel library. */

export type CellValue = number | string | boolean | Date | null;

export interface GridCell {
  value: CellValue;
  formula?: string;
  /** A formula saved without a calculated result (Excel always saves one; some tools don't). */
  noResult?: boolean;
  /** Excel error such as #REF! or #VALUE!. */
  error?: string;
}

export interface SheetGrid {
  name: string;
  hidden: boolean;
  /** rows[r][c], zero-based. */
  rows: GridCell[][];
}

export function columnLetter(index: number): string {
  let n = index + 1;
  let letters = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

/** Zero-based row and column → "A1". */
export function cellRef(row: number, col: number): string {
  return `${columnLetter(col)}${row + 1}`;
}

export function cellText(cell: GridCell | undefined): string {
  const value = cell?.value;
  if (value === null || value === undefined)
    return '';
  if (value instanceof Date)
    return value.toISOString().slice(0, 10);
  return String(value).replace(/\s+/g, ' ').trim();
}

const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

export function excelSerialToDate(serial: number): Date {
  return new Date(EXCEL_EPOCH + Math.round(serial) * 86400000);
}
