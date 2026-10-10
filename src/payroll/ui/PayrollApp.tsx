'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { type Intent, parseIntent } from './commands';
import Composer, { type Suggestion } from './Composer';
import { SlipCard, StatementTable, TaxDocument } from './documents';
import { saveWorkbook } from './download';
import { Icon } from './icons';
import { AssistantMessage, type DeskContext, UserMessage } from './Messages';
import Panel from './Panel';
import type { Action, Block, LoadedFile, Message, PanelView, PanelState, PrintJob } from './types';
import { DEFAULT_DECLARATIONS, type Declarations } from '../engine/declarations';
import { buildSlip } from '../engine/slip';
import { type StatementTax, computeStatementTax } from '../engine/statementTax';
import { buildExportWorkbook, buildTemplateWorkbook } from '../excel/exportWorkbook';
import { importFile } from '../excel/importFile';
import { MONTH_FULL_NAMES, type SalaryStatement } from '../model';
import type { FinancialYear } from '../rules/taxRules';

let sequence = 0;
const uid = () => `id${Date.now().toString(36)}${(sequence++).toString(36)}`;

interface Upload {
  name: string;
  size: number;
  read: () => Promise<ArrayBuffer>;
}

function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12)
    return 'Good morning.';
  if (hour >= 12 && hour < 17)
    return 'Good afternoon.';
  if (hour >= 17 && hour < 22)
    return 'Good evening.';
  return 'Working late?';
}

const shortName = (name: string) => name.replace(/^(dr|mr|mrs|ms|shri|smt|sri|prof)\.?\s+/i, '');
const isWide = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const saved = document.documentElement.getAttribute('data-desk-theme');
    setDark(saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches);
  }, []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute('data-desk-theme', next ? 'dark' : 'light');
    try {
      localStorage.setItem('desk-theme', next ? 'dark' : 'light');
    }
    catch {}
  };
  return (
    <button type="button" onClick={toggle} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} className="grid size-9 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink">
      <Icon name={dark ? 'sun' : 'moon'} className="size-[18px]" />
    </button>
  );
}

const STARTERS: Suggestion[] = [
  { text: 'Try a sample statement', icon: 'sparkle' },
  { text: 'Download the template', icon: 'download' },
  { text: 'What format does the file need?', icon: 'book' },
  { text: 'How is income tax worked out?', icon: 'help' },
];

export default function PayrollApp() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [files, setFiles] = useState<Record<string, LoadedFile>>({});
  const [statements, setStatements] = useState<Record<string, SalaryStatement>>({});
  const [order, setOrder] = useState<string[]>([]);
  const [declarations, setDeclarations] = useState<Record<string, Declarations>>({});
  const [fromFile, setFromFile] = useState<Record<string, Declarations>>({});
  const [panel, setPanel] = useState<PanelState | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [printJob, setPrintJob] = useState<PrintJob | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [greeting, setGreeting] = useState('Hello.');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastUserRef = useRef<HTMLDivElement>(null);
  const uploadRef = useRef<(files: File[]) => void>(() => {});

  const taxes = useMemo(() => {
    const result: Record<string, StatementTax> = {};
    for (const id of order)
      result[id] = computeStatementTax(statements[id], declarations[id] ?? DEFAULT_DECLARATIONS);
    return result;
  }, [order, statements, declarations]);

  const current = activeId && order.includes(activeId) ? activeId : order[0];
  const started = messages.length > 0;
  const lastUserIndex = messages.findLastIndex(message => message.role === 'user');

  useEffect(() => setGreeting(greetingFor(new Date().getHours())), []);

  // Pin the latest request near the top, again once a file's reply has arrived below it.
  useEffect(() => {
    if (lastUserIndex > 0 && !busy)
      lastUserRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [lastUserIndex, busy]);

  useEffect(() => {
    if (!printJob)
      return;
    const done = () => setPrintJob(null);
    window.addEventListener('afterprint', done);
    const timer = window.setTimeout(() => window.print(), 80);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('afterprint', done);
    };
  }, [printJob]);

  // Drop files anywhere on the page.
  useEffect(() => {
    let depth = 0;
    const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes('Files');
    const enter = (event: DragEvent) => {
      if (!hasFiles(event))
        return;
      event.preventDefault();
      depth += 1;
      setDragging(true);
    };
    const over = (event: DragEvent) => {
      if (!hasFiles(event))
        return;
      event.preventDefault();
      if (event.dataTransfer)
        event.dataTransfer.dropEffect = 'copy';
    };
    const leave = (event: DragEvent) => {
      if (!hasFiles(event))
        return;
      depth = Math.max(0, depth - 1);
      if (!depth)
        setDragging(false);
    };
    const drop = (event: DragEvent) => {
      if (!hasFiles(event))
        return;
      event.preventDefault();
      depth = 0;
      setDragging(false);
      const dropped = Array.from(event.dataTransfer?.files ?? []);
      if (dropped.length)
        uploadRef.current(dropped);
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
    };
  }, []);

  const say = (blocks: Block[]) => setMessages(list => [...list, { id: uid(), role: 'assistant', blocks }]);
  const userSays = (text?: string, uploaded?: { name: string, size: number }[]) =>
    setMessages(list => [...list, { id: uid(), role: 'user', text, files: uploaded }]);

  const notify = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(shown => (shown === text ? null : shown)), 3500);
  };

  const openPanel = (view: PanelView, statementId: string, slipKey?: string) => {
    setActiveId(statementId);
    setPanel({ view, statementId, slipKey });
  };

  async function processUploads(uploads: Upload[], options: { text?: string, echo: boolean }) {
    if (busy || !uploads.length)
      return;
    setBusy(true);
    if (options.echo)
      userSays(options.text, uploads.map(upload => ({ name: upload.name, size: upload.size })));
    const pendingId = uid();
    setMessages(list => [...list, { id: pendingId, role: 'assistant', blocks: [], pending: `Reading ${uploads.length === 1 ? uploads[0].name : `${uploads.length} files`}…` }]);

    const newFiles: Record<string, LoadedFile> = {};
    const newStatements: Record<string, SalaryStatement> = {};
    const newDeclarations: Record<string, Declarations> = {};
    const added: string[] = [];
    const removed = new Set<string>();
    const blocks: Block[] = [];
    const lookup = (id: string) => newStatements[id] ?? statements[id];

    for (const upload of uploads) {
      const fileId = uid();
      try {
        const result = await importFile(upload.name, await upload.read(), fileId);
        const replaced: string[] = [];
        for (const statement of result.statements) {
          // A second upload for the same employee and year replaces the first.
          for (const id of [...order, ...added]) {
            const other = lookup(id);
            if (!removed.has(id) && other && other.employeeName.trim().toLowerCase() === statement.employeeName.trim().toLowerCase() && other.financialYear === statement.financialYear) {
              removed.add(id);
              replaced.push(statement.employeeName);
            }
          }
          newStatements[statement.id] = statement;
          newDeclarations[statement.id] = { ...DEFAULT_DECLARATIONS, ...result.declarations[statement.id] };
          added.push(statement.id);
        }
        newFiles[fileId] = { id: fileId, name: upload.name, size: upload.size, statementIds: result.statements.map(statement => statement.id), issues: result.issues, skippedSheets: result.skippedSheets, replaced };
      }
      catch {
        newFiles[fileId] = {
          id: fileId,
          name: upload.name,
          size: upload.size,
          statementIds: [],
          issues: [{ severity: 'error', message: `“${upload.name}” couldn’t be read.`, fix: 'Open it in Excel, save it again as .xlsx and upload that copy.' }],
          skippedSheets: [],
          replaced: [],
        };
      }
      blocks.push({ type: 'file', fileId });
    }

    const kept = added.filter(id => !removed.has(id));
    setFiles(previous => ({ ...previous, ...newFiles }));
    setStatements(previous => ({ ...previous, ...newStatements }));
    setOrder(previous => [...previous.filter(id => !removed.has(id)), ...kept]);
    setDeclarations(previous => ({ ...previous, ...newDeclarations }));
    setFromFile(previous => ({ ...previous, ...newDeclarations }));

    if (kept.length === 1)
      blocks.push({ type: 'tax', statementId: kept[0] }, { type: 'slips', statementId: kept[0] });
    else if (kept.length > 1)
      blocks.push({ type: 'text', text: `**${kept.length} employees** read. Pick one to see the full computation and pay slips:` }, { type: 'employees', statementIds: kept });
    else
      blocks.push({ type: 'actions', actions: [{ kind: 'template', label: 'Download the template' }, { kind: 'say', text: 'What format does the file need?', label: 'What format does it need?' }] });

    setMessages(list => list.map(message => (message.id === pendingId ? { id: pendingId, role: 'assistant', blocks } : message)));
    if (kept.length) {
      setActiveId(kept[0]);
      if (isWide())
        setPanel({ view: 'tax', statementId: kept[0] });
      else if (panel && removed.has(panel.statementId))
        setPanel(null);
    }
    setBusy(false);
  }

  const handleFiles = (list: File[]) => processUploads(list.map(file => ({ name: file.name, size: file.size, read: () => file.arrayBuffer() })), { echo: true });
  uploadRef.current = handleFiles;

  async function loadSample(echo: boolean) {
    const buffer = await buildTemplateWorkbook();
    await processUploads([{ name: 'Sample salary statement.xlsx', size: buffer.byteLength, read: async () => buffer }], { echo, text: 'Try a sample statement' });
  }

  async function downloadTemplate() {
    try {
      saveWorkbook(await buildTemplateWorkbook(), 'Salary statement template.xlsx');
      notify('Downloading the template');
    }
    catch {
      notify('The template couldn’t be built; please try again.');
    }
  }

  async function exportIds(ids: string[]) {
    const items = ids.filter(id => statements[id] && taxes[id]).map(id => ({ statement: statements[id], declarations: declarations[id], tax: taxes[id] }));
    if (!items.length)
      return;
    const fy = items[0].tax.fy;
    const name = items.length === 1 ? `Income tax ${fy} - ${items[0].statement.employeeName}.xlsx` : `Income tax ${fy} - ${items.length} employees.xlsx`;
    try {
      saveWorkbook(await buildExportWorkbook(items), name);
      notify(`Downloading ${name}`);
    }
    catch {
      notify('The workbook couldn’t be built; please try again.');
    }
  }

  const reset = () => {
    setMessages([]);
    setFiles({});
    setStatements({});
    setOrder([]);
    setDeclarations({});
    setFromFile({});
    setPanel(null);
    setActiveId(null);
    window.scrollTo({ top: 0 });
  };

  const needsData = () => say([
    { type: 'text', text: 'There’s no salary statement loaded yet. Upload one with **Upload .xlsx** (or drop it anywhere on the page), or try the sample first.' },
    { type: 'actions', actions: [{ kind: 'upload', label: 'Upload a statement' }, { kind: 'sample', label: 'Try the sample' }, { kind: 'template', label: 'Download the template' }] },
  ]);

  function respond(intent: Intent) {
    const fallbackFy: FinancialYear = current ? taxes[current]?.fy ?? '2025-26' : '2025-26';
    switch (intent.kind) {
      case 'help':
        return say([{ type: 'help' }]);
      case 'reset':
        return reset();
      case 'sample':
        return void loadSample(false);
      case 'template':
        void downloadTemplate();
        return say([{ type: 'text', text: 'Downloading **Salary statement template.xlsx**: the office layout with made-up figures, a Declarations sheet and a Read me. Type your figures over the sample ones (the formulas fill in the rest) and upload it here.' }]);
      case 'format':
        return say([{ type: 'format' }]);
      case 'rules':
        return say([{ type: 'rules', fy: fallbackFy }]);
      case 'unknown':
        return say([{ type: 'text', text: 'I didn’t catch that.' }, { type: 'help' }]);
      default:
        break;
    }
    const target = intent.employeeId ?? current;
    if (!target)
      return needsData();
    const statement = statements[target];
    switch (intent.kind) {
      case 'tax':
        if (intent.regime && intent.regime !== declarations[target]?.regime) {
          setDeclarations(previous => ({ ...previous, [target]: { ...previous[target], regime: intent.regime as Declarations['regime'] } }));
          say([{ type: 'text', text: `Switched ${statement.employeeName} to the **${intent.regime} regime**.` }, { type: 'tax', statementId: target }]);
        }
        else {
          say([{ type: 'tax', statementId: target }]);
        }
        return openPanel('tax', target);
      case 'compare':
        say([{ type: 'compare', statementId: target }]);
        return openPanel('compare', target);
      case 'slip': {
        const row = intent.month ? statement.rows.find(item => item.kind === 'month' && item.month === intent.month) : undefined;
        if (intent.month && !row)
          say([{ type: 'text', text: `There’s no ${MONTH_FULL_NAMES[intent.month - 1]} row in ${statement.employeeName}’s statement. These are the slips there are:` }, { type: 'slips', statementId: target }]);
        else
          say([{ type: 'slips', statementId: target }]);
        return openPanel('slips', target, row ? buildSlip(row).key : undefined);
      }
      case 'declarations':
        say([{ type: 'text', text: `Opened the **declarations** for ${statement.employeeName}. Set the regime, rent, 80C, health insurance, other income or a previous employer; the tax recalculates as you type.` }]);
        return openPanel('declarations', target);
      case 'statement':
        say([{ type: 'text', text: `Here’s ${statement.employeeName}’s salary statement as read from the file: ${statement.rows.length} rows.` }]);
        return openPanel('statement', target);
      case 'export': {
        const ids = intent.employeeId ? [intent.employeeId] : order;
        void exportIds(ids);
        return say([{ type: 'text', text: ids.length === 1
          ? `Downloading the Excel workbook for ${statement.employeeName}: the tax computation in the office layout, the salary statement and the declarations.`
          : `Downloading one workbook for all ${ids.length} employees: a summary, then each employee’s tax computation and salary statement, and the declarations.` }]);
      }
      case 'employee':
        say([{ type: 'tax', statementId: target }]);
        return openPanel('tax', target);
    }
  }

  const handleText = (text: string) => {
    userSays(text);
    respond(parseIntent(text, order.map(id => ({ id, name: statements[id].employeeName }))));
  };

  const run = (action: Action) => {
    switch (action.kind) {
      case 'open':
        return openPanel(action.view, action.statementId, action.slipKey);
      case 'export':
        return void exportIds(action.statementIds);
      case 'print':
        return setPrintJob({ what: action.what, statementId: action.statementId });
      case 'template':
        return void downloadTemplate();
      case 'sample':
        return void loadSample(true);
      case 'upload':
        return fileInputRef.current?.click();
      case 'say':
        return handleText(action.text);
    }
  };

  const onSkill = (skill: 'slips' | 'tax') => {
    if (!current) {
      fileInputRef.current?.click();
      return;
    }
    userSays(skill === 'tax' ? 'Income tax' : 'Salary slips');
    say([{ type: skill, statementId: current }]);
    openPanel(skill === 'tax' ? 'tax' : 'slips', current);
  };

  const suggestions = useMemo<Suggestion[]>(() => {
    if (!current)
      return STARTERS;
    const statement = statements[current];
    const lastMonth = [...statement.rows].reverse().find(row => row.kind === 'month' && row.values.gross > 0);
    const list: Suggestion[] = [
      { text: `Income tax for ${shortName(statement.employeeName)}`, icon: 'calculator' },
      ...(lastMonth?.month ? [{ text: `Pay slip for ${MONTH_FULL_NAMES[lastMonth.month - 1]}`, icon: 'receipt' as const }] : []),
      { text: 'Compare old and new regime', icon: 'scale' },
      { text: 'Edit declarations', icon: 'sliders' },
      { text: 'Show the statement', icon: 'table' },
      { text: order.length > 1 ? 'Download everything as Excel' : 'Download Excel', icon: 'download' },
      { text: 'How is income tax worked out?', icon: 'help' },
    ];
    for (const id of order.filter(other => other !== current).slice(0, 4))
      list.push({ text: `Income tax for ${shortName(statements[id].employeeName)}`, icon: 'users' });
    return list;
  }, [current, order, statements]);

  const ctx: DeskContext = { files, statements, taxes, run };
  const panelStatement = panel ? statements[panel.statementId] : undefined;
  const panelTax = panel ? taxes[panel.statementId] : undefined;
  const printStatement = printJob ? statements[printJob.statementId] : undefined;
  const printTax = printJob ? taxes[printJob.statementId] : undefined;

  const composer = (placement: 'below' | 'above') => (
    <Composer
      inputRef={inputRef}
      fileInputRef={fileInputRef}
      busy={busy}
      hasData={order.length > 0}
      placement={placement}
      suggestions={suggestions}
      onSubmit={handleText}
      onFiles={handleFiles}
      onSkill={onSkill}
    />
  );

  return (
    <>
      <div className="desk-screen">
        <header className="sticky top-0 z-40 border-b border-line/80 bg-bg/80 backdrop-blur-md">
          <nav className="mx-auto flex h-14 max-w-[1440px] items-center justify-between px-4 sm:px-5" aria-label="Main">
            <button type="button" onClick={reset} className="flex items-center gap-2.5 text-[15px] font-medium text-ink">
              <span aria-hidden className="grid size-7 place-items-center rounded-lg bg-accent font-display text-[15px] font-semibold text-accent-ink">₹</span>
              Salary &amp; Tax Desk
            </button>
            <div className="flex items-center gap-1">
              <a href="/" className="hidden rounded-lg px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-ink sm:block">Slab calculator</a>
              <button type="button" onClick={() => void downloadTemplate()} className="hidden items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-ink sm:inline-flex">
                <Icon name="download" className="size-3.5" />
                Template
              </button>
              <ThemeToggle />
              {started && (
                <button type="button" onClick={reset} className="ml-1 inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-sm font-medium text-bg transition-opacity hover:opacity-85">
                  <Icon name="edit" className="size-3.5" />
                  New chat
                </button>
              )}
            </div>
          </nav>
        </header>

        {!started
          ? (
            <main id="top" className="relative isolate">
              <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[90vh] overflow-hidden">
                <div className="absolute left-1/2 top-[10%] -translate-x-1/2">
                  <div className="h-[380px] w-[min(720px,90vw)] animate-drift rounded-full bg-accent-bright/[0.13] blur-[90px]" />
                </div>
                <div className="absolute left-[16%] top-[34%]">
                  <div className="h-[300px] w-[min(520px,70vw)] animate-drift rounded-full bg-glow-cool/[0.10] blur-[100px] [animation-delay:-9s]" />
                </div>
              </div>
              <div className="mx-auto flex min-h-[calc(100svh-3.5rem)] w-full max-w-3xl flex-col justify-center px-5 py-12">
                <div className="animate-rise text-center">
                  <span className="mb-8 inline-flex items-center gap-2 rounded-full border border-line bg-surface/70 px-3.5 py-1.5 text-[13px] text-muted backdrop-blur">
                    <span className="relative flex size-2">
                      <span className="absolute inline-flex size-full animate-pulse-ring rounded-full bg-accent-bright" />
                      <span className="relative inline-flex size-2 rounded-full bg-accent-bright" />
                    </span>
                    Rules for FY 2024-25 to tax year 2026-27
                  </span>
                  <p className="font-display text-2xl text-muted sm:text-[28px]">{greeting}</p>
                  <h1 className="mx-auto mt-1 max-w-2xl text-balance font-display text-[42px] leading-[1.06] tracking-tight text-ink sm:text-6xl">
                    Pay slips and income tax from one salary statement.
                  </h1>
                  <p className="mx-auto mt-6 max-w-2xl text-balance text-lg leading-relaxed text-muted">
                    Upload the salary statement Excel. You get a pay slip for every month and the full tax computation, with each slab, the rebate, surcharge, cess and the balance to recover worked out and explained.
                  </p>
                </div>
                <div className="mt-10 animate-rise [animation-delay:120ms]">{composer('below')}</div>
                <div className="mt-4 flex animate-rise flex-wrap justify-center gap-2 [animation-delay:200ms]">
                  {STARTERS.map(item => (
                    <button
                      key={item.text}
                      type="button"
                      onClick={() => handleText(item.text)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface/60 px-3 py-1.5 text-[13.5px] text-muted transition-colors hover:bg-surface hover:text-ink"
                    >
                      <Icon name={item.icon} className="size-3.5" />
                      {item.text}
                    </button>
                  ))}
                </div>
                <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-muted/90">
                  <Icon name="lock" className="size-3" />
                  Files are read in your browser and never uploaded. No AI, no sign-in.
                </p>
              </div>
            </main>
            )
          : (
            <div className={panel && panelStatement && panelTax ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.12fr)]' : ''}>
              <main className="mx-auto flex min-h-[calc(100svh-3.5rem)] w-full max-w-3xl flex-col px-4 pt-6 sm:px-5">
                <div className="flex-1 space-y-7 pb-8">
                  {messages.map((message, index) => message.role === 'user'
                    ? (
                      <div key={message.id} ref={index === lastUserIndex ? lastUserRef : undefined} className="scroll-mt-20">
                        <UserMessage message={message} />
                      </div>
                      )
                    : <AssistantMessage key={message.id} message={message} ctx={ctx} />)}
                </div>
                <div className="sticky bottom-0 z-20 pb-4 pt-2">
                  <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-8 bottom-0 -z-10 bg-gradient-to-t from-bg via-bg/95 to-transparent" />
                  {composer('above')}
                  <p className="mt-2 text-center text-[11.5px] text-muted/90">Read on this device only. Check figures before filing.</p>
                </div>
              </main>
              {panel && panelStatement && panelTax && (
                <aside
                  aria-label="Document"
                  className="fixed inset-0 z-50 lg:sticky lg:top-14 lg:z-auto lg:h-[calc(100svh-3.5rem)] lg:border-l lg:border-line"
                >
                  <Panel
                    panel={panel}
                    statements={order.map(id => statements[id])}
                    statement={panelStatement}
                    tax={panelTax}
                    declarations={declarations[panel.statementId] ?? DEFAULT_DECLARATIONS}
                    onChange={next => openPanel(next.view, next.statementId, next.slipKey)}
                    onClose={() => setPanel(null)}
                    onDeclarations={next => setDeclarations(previous => ({ ...previous, [panel.statementId]: next }))}
                    onResetDeclarations={() => setDeclarations(previous => ({ ...previous, [panel.statementId]: fromFile[panel.statementId] ?? DEFAULT_DECLARATIONS }))}
                    onExport={() => void exportIds([panel.statementId])}
                    onPrint={(what, slipKey) => setPrintJob({ what, statementId: panel.statementId, slipKey })}
                  />
                </aside>
              )}
            </div>
            )}

        {dragging && (
          <div className="pointer-events-none fixed inset-0 z-[60] grid place-items-center bg-bg/80 backdrop-blur-sm">
            <div className="rounded-3xl border-2 border-dashed border-accent-bright/70 bg-surface px-10 py-8 text-center shadow-composer">
              <Icon name="file" className="mx-auto size-8 text-accent-text" />
              <p className="mt-3 font-display text-2xl text-ink">Drop to read</p>
              <p className="mt-1 text-sm text-muted">Salary statements (.xlsx) are read on this device, never uploaded.</p>
            </div>
          </div>
        )}

        {toast && (
          <div role="status" className="fixed bottom-5 left-1/2 z-[70] -translate-x-1/2 animate-rise rounded-full bg-ink px-4 py-2 text-sm text-bg shadow-composer">
            {toast}
          </div>
        )}
      </div>

      <div className="desk-print">
        {printJob && printStatement && printTax && (
          <>
            {printJob.what === 'statement' && <style>{'@page { size: A4 landscape; }'}</style>}
            {printJob.what === 'tax' && <div className="print-page"><TaxDocument statement={printStatement} tax={printTax} /></div>}
            {printJob.what === 'statement' && <div className="print-page"><StatementTable statement={printStatement} tax={printTax} /></div>}
            {printJob.what === 'slip' && (() => {
              const slips = printStatement.rows.map(buildSlip);
              const slip = slips.find(item => item.key === printJob.slipKey) ?? slips[slips.length - 1];
              return <div className="print-page"><SlipCard statement={printStatement} slip={slip} /></div>;
            })()}
            {printJob.what === 'slips' && printStatement.rows.map(row => (
              <div key={`${row.sheetRow}-${row.label}`} className="print-page">
                <SlipCard statement={printStatement} slip={buildSlip(row)} />
              </div>
            ))}
          </>
        )}
      </div>
    </>
  );
}
