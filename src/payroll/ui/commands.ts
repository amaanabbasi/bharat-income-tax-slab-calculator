import { MONTH_FULL_NAMES } from '../model';
import type { Regime } from '../rules/taxRules';

/** What a typed request asks for. There is no AI here: requests are matched by keywords. */
export type Intent =
  | { kind: 'help' }
  | { kind: 'reset' }
  | { kind: 'sample' }
  | { kind: 'template' }
  | { kind: 'format' }
  | { kind: 'rules' }
  | { kind: 'tax', employeeId?: string, regime?: Regime }
  | { kind: 'slip', employeeId?: string, month?: number, all: boolean }
  | { kind: 'compare', employeeId?: string }
  | { kind: 'declarations', employeeId?: string }
  | { kind: 'statement', employeeId?: string }
  | { kind: 'export', employeeId?: string }
  | { kind: 'employee', employeeId: string }
  | { kind: 'unknown' };

const TITLES = new Set(['dr', 'mr', 'mrs', 'ms', 'miss', 'shri', 'smt', 'sri', 'prof']);

function findEmployee(text: string, employees: { id: string, name: string }[]): string | undefined {
  const words = new Set(text.toLowerCase().split(/[^a-z]+/).filter(Boolean));
  let best: { id: string, hits: number } | undefined;
  for (const employee of employees) {
    const parts = employee.name.toLowerCase().split(/[^a-z]+/).filter(part => part.length >= 3 && !TITLES.has(part));
    const hits = parts.filter(part => words.has(part)).length;
    if (hits && (!best || hits > best.hits))
      best = { id: employee.id, hits };
  }
  return best?.id;
}

/** "mar", "march" and "sept" all count; a word must be the start of a month name. */
function findMonth(text: string): number | undefined {
  for (const word of text.toLowerCase().split(/[^a-z]+/)) {
    const index = word.length >= 3 ? MONTH_FULL_NAMES.findIndex(name => name.toLowerCase().startsWith(word)) : -1;
    if (index >= 0)
      return index + 1;
  }
  return undefined;
}

export function parseIntent(input: string, employees: { id: string, name: string }[]): Intent {
  const text = input.trim().toLowerCase();
  const employeeId = findEmployee(text, employees);
  const has = (pattern: RegExp) => pattern.test(text);

  if (has(/^(new chat|reset|clear|start over|start again)\b/))
    return { kind: 'reset' };
  if (has(/^(help|\?|commands|what can you do|what do you do|how does this work)/))
    return { kind: 'help' };
  if (has(/\b(template|blank (sheet|file|format)|empty (sheet|file))\b/))
    return { kind: 'template' };
  if (has(/\b(sample|demo|example)\b/))
    return { kind: 'sample' };
  if (has(/\b(format|columns?|headings?|headers?|layout)\b/) || has(/what (file|excel|sheet)/))
    return { kind: 'format' };
  if (has(/\bhow\b.*\b(tax|calculated|worked out|computed)\b/) || has(/\b(rules|slab rates|explain|tax slabs?)\b/))
    return { kind: 'rules' };
  if (has(/\b(compare|comparison|which regime|old (vs|or|and) new|new (vs|or|and) old|better regime)\b/))
    return { kind: 'compare', employeeId };
  if (has(/\b(declar\w*|deductions?|rent|80c|80d|80ccd|hra exemption|investments?|other income|previous employer|relief|settings?)\b/))
    return { kind: 'declarations', employeeId };
  if (has(/\b(export|download|excel|xlsx|save)\b/))
    return { kind: 'export', employeeId };
  if (has(/\b(slips?|payslips?|pay ?slip|net pay|take.?home)\b/))
    return { kind: 'slip', employeeId, month: findMonth(text), all: has(/\b(all|every|each|print)\b/) };
  if (has(/\b(statement|annual salary|salary sheet|all months|table)\b/))
    return { kind: 'statement', employeeId };
  if (has(/\b(tax|tds|computation|income.?tax|regime|form ?16)\b/))
    return { kind: 'tax', employeeId, regime: has(/\bold\b/) ? 'old' : has(/\bnew\b/) ? 'new' : undefined };
  if (employeeId)
    return { kind: 'employee', employeeId };
  return { kind: 'unknown' };
}
