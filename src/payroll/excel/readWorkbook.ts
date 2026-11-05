import type { Cell, Worksheet } from 'exceljs';
import { type CellValue, type GridCell, type SheetGrid } from './grid';
import { type Issue } from '../model';

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
// A whole office in one sheet runs to a few thousand rows.
const MAX_ROWS = 8000;
const MAX_COLUMNS = 60;

/** ExcelJS is large, so it is only fetched when a file is read or written. */
export async function loadExcel(): Promise<typeof import('exceljs')> {
  const loaded = await import('exceljs');
  return ((loaded as { default?: typeof import('exceljs') }).default ?? loaded) as typeof import('exceljs');
}

type FileKind = 'xlsx' | 'ole' | 'csv' | 'unknown';

function detectKind(fileName: string, bytes: Uint8Array): FileKind {
  if (bytes[0] === 0x50 && bytes[1] === 0x4B)
    return 'xlsx';
  // Old .xls files and password-protected .xlsx files are both OLE compound documents.
  if (bytes[0] === 0xD0 && bytes[1] === 0xCF && bytes[2] === 0x11 && bytes[3] === 0xE0)
    return 'ole';
  if (/\.(csv|txt)$/i.test(fileName))
    return 'csv';
  return 'unknown';
}

export async function readGrids(fileName: string, buffer: ArrayBuffer): Promise<{ grids: SheetGrid[], issues: Issue[] }> {
  const bytes = new Uint8Array(buffer);
  if (bytes.byteLength === 0)
    return fail('The file is empty.', 'Check that it was saved before uploading.');
  if (bytes.byteLength > MAX_FILE_BYTES)
    return fail(`The file is ${(bytes.byteLength / 1048576).toFixed(1)} MB; the limit is 10 MB.`, 'A salary statement is usually a few KB. Remove images or extra sheets and save again.');

  switch (detectKind(fileName, bytes)) {
    case 'ole':
      return /\.xlsx$/i.test(fileName)
        ? fail('This workbook is password-protected, so it can’t be read.', 'Open it in Excel, remove the password (File → Info → Protect Workbook → Encrypt with Password, clear it), save and upload again.')
        : fail('This is an old-style .xls workbook.', 'Open it in Excel and use File → Save As → “Excel Workbook (.xlsx)”, then upload the .xlsx file.');
    case 'csv':
      return { grids: [csvGrid(fileName, new TextDecoder().decode(bytes))], issues: [] };
    case 'unknown':
      return fail(`“${fileName}” isn’t an Excel file.`, 'Upload the salary statement as .xlsx (or .csv). Use “Download template” for the expected layout.');
    case 'xlsx':
      break;
  }

  const ExcelJS = await loadExcel();
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  }
  catch {
    return fail('The workbook couldn’t be opened; it may be damaged or not really an Excel file.', 'Open it in Excel, check it looks right, save it again as .xlsx and upload that copy.');
  }
  return { grids: workbook.worksheets.map(worksheetGrid), issues: [] };
}

function fail(message: string, fix: string): { grids: SheetGrid[], issues: Issue[] } {
  return { grids: [], issues: [{ severity: 'error', message, fix }] };
}

function worksheetGrid(worksheet: Worksheet): SheetGrid {
  const rows: GridCell[][] = [];
  const rowCount = Math.min(worksheet.rowCount, MAX_ROWS);
  const columnCount = Math.min(worksheet.columnCount, MAX_COLUMNS);
  for (let r = 1; r <= rowCount; r++) {
    const row = worksheet.getRow(r);
    const cells: GridCell[] = [];
    for (let c = 1; c <= columnCount; c++)
      cells.push(gridCell(row.getCell(c)));
    rows.push(cells);
  }
  return { name: worksheet.name, hidden: worksheet.state !== 'visible', rows };
}

function gridCell(cell: Cell): GridCell {
  // Merged ranges repeat the first cell's value; keep it only once.
  if (cell.isMerged && cell.master && cell.master.address !== cell.address)
    return { value: null };
  const raw = cell.value as unknown;
  if (raw === null || raw === undefined)
    return { value: null };
  if (typeof raw === 'number' || typeof raw === 'string' || typeof raw === 'boolean' || raw instanceof Date)
    return { value: raw };
  if (typeof raw === 'object') {
    const value = raw as Record<string, unknown>;
    if ('formula' in value || 'sharedFormula' in value) {
      const formula = cell.formula || undefined;
      // cell.result keeps a saved 0, which cell.value.result drops.
      const result = cell.result as unknown;
      if (result === undefined || result === null)
        return { value: null, formula, noResult: true };
      if (typeof result === 'object' && !(result instanceof Date) && 'error' in (result as object))
        return { value: null, formula, error: String((result as { error: unknown }).error) };
      return { value: result as CellValue, formula };
    }
    if ('richText' in value && Array.isArray(value.richText))
      return { value: value.richText.map(part => (part as { text?: string }).text ?? '').join('') };
    if ('text' in value)
      return { value: String(value.text) };
    if ('error' in value)
      return { value: null, error: String(value.error) };
  }
  return { value: String(raw) };
}

/** Minimal CSV reader: quoted fields, doubled quotes, commas, CRLF. */
function csvGrid(fileName: string, text: string): SheetGrid {
  const rows: GridCell[][] = [];
  let field = '';
  let row: string[] = [];
  let quoted = false;
  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    rows.push(row.map(cellFromText));
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      }
      else if (char === '"') {
        quoted = false;
      }
      else {
        field += char;
      }
    }
    else if (char === '"') {
      quoted = true;
    }
    else if (char === ',') {
      pushField();
    }
    else if (char === '\n') {
      pushRow();
    }
    else if (char !== '\r') {
      field += char;
    }
    if (rows.length >= MAX_ROWS)
      break;
  }
  if (field || row.length)
    pushRow();
  return { name: fileName.replace(/\.(csv|txt)$/i, ''), hidden: false, rows };
}

function cellFromText(text: string): GridCell {
  const trimmed = text.trim();
  if (!trimmed)
    return { value: null };
  const numeric = trimmed.replace(/,/g, '');
  if (/^-?\d+(\.\d+)?$/.test(numeric))
    return { value: Number(numeric) };
  return { value: trimmed };
}
