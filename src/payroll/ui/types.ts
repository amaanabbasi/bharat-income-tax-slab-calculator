import type { Issue } from '../model';
import type { FinancialYear } from '../rules/taxRules';

export type PanelView = 'tax' | 'slips' | 'statement' | 'declarations' | 'compare';

export interface PanelState {
  view: PanelView;
  statementId: string;
  /** Selected pay slip (see PaySlip.key). */
  slipKey?: string;
}

export interface LoadedFile {
  id: string;
  name: string;
  size: number;
  statementIds: string[];
  issues: Issue[];
  skippedSheets: string[];
  /** Earlier statements for the same employee and year that this file replaced. */
  replaced: string[];
}

export type Action =
  | { kind: 'open', view: PanelView, statementId: string, slipKey?: string, label: string }
  | { kind: 'export', statementIds: string[], label: string }
  | { kind: 'print', what: 'tax' | 'slips', statementIds: string[], label: string }
  | { kind: 'template', label: string }
  | { kind: 'sample', label: string }
  | { kind: 'upload', label: string }
  /** Runs a request as if it had been typed. */
  | { kind: 'say', text: string, label: string };

export type Block =
  | { type: 'text', text: string }
  | { type: 'file', fileId: string }
  | { type: 'tax', statementId: string }
  | { type: 'slips', statementId: string }
  | { type: 'compare', statementId: string }
  | { type: 'employees', statementIds: string[] }
  | { type: 'format' }
  | { type: 'rules', fy: FinancialYear }
  | { type: 'help' }
  | { type: 'actions', actions: Action[] };

export type Message =
  | { id: string, role: 'user', text?: string, files?: { name: string, size: number }[] }
  | { id: string, role: 'assistant', blocks: Block[], pending?: string };

export interface PrintJob {
  what: 'tax' | 'slips' | 'slip' | 'statement';
  /** One statement, or every employee's for "print all". */
  statementIds: string[];
  slipKey?: string;
}
