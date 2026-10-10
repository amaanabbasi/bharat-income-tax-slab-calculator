'use client';

import { Fragment, type ReactNode } from 'react';
import { balanceLabel, recoveryText } from './documents';
import { Icon, type IconName } from './icons';
import type { Action, Block, LoadedFile, Message } from './types';
import { formatRupees } from '../engine/money';
import { buildSlip } from '../engine/slip';
import type { StatementTax } from '../engine/statementTax';
import { slabLabel, rateLabel } from '../engine/tax';
import { COLUMNS } from '../format/salaryStatement';
import { type Issue, MONTH_NAMES, type SalaryStatement } from '../model';
import { getYearRules, type FinancialYear } from '../rules/taxRules';

export interface DeskContext {
  files: Record<string, LoadedFile>;
  statements: Record<string, SalaryStatement>;
  taxes: Record<string, StatementTax>;
  run: (action: Action) => void;
}

function bytes(size: number): string {
  return size < 1024 ? `${size} B` : size < 1048576 ? `${Math.round(size / 1024)} KB` : `${(size / 1048576).toFixed(1)} MB`;
}

/** **bold** and paragraphs; that's all the formatting replies need. */
function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split(/\n{2,}/).map(paragraph => (
        <p key={paragraph}>
          {paragraph.split(/(\*\*[^*]+\*\*)/).map((part, index) => part.startsWith('**') && part.endsWith('**')
            ? <strong key={index} className="font-semibold">{part.slice(2, -2)}</strong>
            : <Fragment key={index}>{part}</Fragment>)}
        </p>
      ))}
    </>
  );
}

const ACTION_ICONS: Record<Action['kind'], IconName> = {
  open: 'arrowUpRight',
  export: 'download',
  print: 'printer',
  template: 'download',
  sample: 'sparkle',
  upload: 'paperclip',
  say: 'arrowUpRight',
};

export function ActionButtons({ actions, run }: { actions: Action[], run: (action: Action) => void }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {actions.map((action, index) => (
        <button
          key={`${action.kind}-${action.label}`}
          type="button"
          onClick={() => run(action)}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[13px] transition-colors ${index === 0 && action.kind !== 'say'
            ? 'bg-ink font-medium text-bg hover:opacity-90'
            : 'border border-line bg-surface text-ink hover:bg-surface-2'}`}
        >
          <Icon name={action.kind === 'open' && action.view === 'slips' ? 'receipt' : ACTION_ICONS[action.kind]} className="size-3.5" />
          {action.label}
        </button>
      ))}
    </div>
  );
}

const ISSUE_TONE: Record<Issue['severity'], { icon: IconName, className: string }> = {
  error: { icon: 'error', className: 'text-bad' },
  warning: { icon: 'alert', className: 'text-warn' },
  info: { icon: 'info', className: 'text-muted' },
};

function IssueItem({ issue }: { issue: Issue }) {
  const tone = ISSUE_TONE[issue.severity];
  return (
    <li className="flex gap-2.5">
      <Icon name={tone.icon} className={`mt-[3px] size-4 shrink-0 ${tone.className}`} />
      <div className="min-w-0 text-[13.5px] leading-relaxed text-ink/90">
        <p>
          {issue.cell && (
            <code className="mr-1.5 whitespace-nowrap rounded-md bg-surface-2 px-1.5 py-0.5 font-body text-[12px] text-ink">
              {issue.sheet ? `${issue.sheet}!${issue.cell}` : issue.cell}
            </code>
          )}
          {issue.message}
        </p>
        {issue.fix && (
          <p className="mt-0.5 text-[12.5px] text-muted">
            <span className="font-medium text-ink/70">Fix: </span>
            {issue.fix}
          </p>
        )}
      </div>
    </li>
  );
}

function IssueList({ issues }: { issues: Issue[] }) {
  const important = issues.filter(issue => issue.severity !== 'info');
  const notes = issues.filter(issue => issue.severity === 'info');
  return (
    <div className="mt-3 space-y-3">
      {important.length > 0 && <ul className="space-y-2.5">{important.map(issue => <IssueItem key={`${issue.cell}-${issue.message}`} issue={issue} />)}</ul>}
      {notes.length > 0 && (
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-[13px] text-muted hover:text-ink">
            <Icon name="chevronRight" className="size-3.5 transition-transform group-open:rotate-90" />
            {`${notes.length} ${notes.length === 1 ? 'note' : 'notes'}`}
          </summary>
          <ul className="mt-2 space-y-2.5">{notes.map(issue => <IssueItem key={issue.message} issue={issue} />)}</ul>
        </details>
      )}
    </div>
  );
}

function FileReport({ file, ctx }: { file: LoadedFile, ctx: DeskContext }) {
  const statements = file.statementIds.map(id => ctx.statements[id]).filter(Boolean);
  const errors = file.issues.filter(issue => issue.severity === 'error').length;
  const warnings = file.issues.filter(issue => issue.severity === 'warning').length;
  const headline = !statements.length
    ? 'I couldn’t use this file yet. Here’s what to fix:'
    : errors
      ? `Read ${statements.length} of the statements; ${errors === 1 ? 'one sheet needs' : 'some sheets need'} fixing first.`
      : warnings
        ? `Read it. ${warnings === 1 ? 'One thing' : `${warnings} things`} to check before relying on it:`
        : 'Read it. Everything is in the expected format.';
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center gap-3">
        <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${statements.length ? 'bg-good/10 text-good' : 'bg-bad/10 text-bad'}`}>
          <Icon name="file" className="size-[18px]" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[14px] font-medium text-ink">{file.name}</p>
          <p className="text-[12px] text-muted">
            {`${bytes(file.size)} · ${statements.length ? `${statements.length} salary ${statements.length === 1 ? 'statement' : 'statements'}` : 'no statement read'}`}
          </p>
        </div>
      </div>
      {statements.length > 0 && (
        <ul className="mt-3 divide-y divide-line/70 rounded-xl border border-line/70">
          {statements.map((statement) => {
            const months = statement.rows.filter(row => row.kind === 'month').length;
            const arrears = statement.rows.length - months;
            const gross = statement.rows.reduce((sum, row) => sum + row.values.gross, 0);
            return (
              <li key={statement.id} className="px-3 py-2.5 text-[13px]">
                <p className="font-medium text-ink">{statement.employeeName}</p>
                <p className="text-muted">
                  {[statement.designation, `FY ${statement.financialYear}`, `${months} months${arrears ? ` + ${arrears} arrear ${arrears === 1 ? 'row' : 'rows'}` : ''}`, `gross ${formatRupees(gross)}`].filter(Boolean).join(' · ')}
                </p>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-[14px] text-ink">{headline}</p>
      <IssueList issues={file.issues} />
      {file.replaced.length > 0 && <p className="mt-3 text-[12.5px] text-muted">{`Replaced the earlier upload for ${file.replaced.join(', ')}.`}</p>}
      {statements.length > 0 && file.skippedSheets.length > 0 && <p className="mt-2 text-[12.5px] text-muted">{`Skipped sheets that aren’t salary statements: ${file.skippedSheets.join(', ')}.`}</p>}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string, value: number, accent?: boolean }) {
  return (
    <div className={`rounded-xl px-3 py-2.5 ${accent ? 'bg-accent/10' : 'bg-surface-2'}`}>
      <p className="text-[11.5px] leading-tight text-muted">{label}</p>
      <p className={`tabular mt-1 text-[16px] font-semibold ${accent ? 'text-accent-text' : 'text-ink'}`}>{formatRupees(value)}</p>
    </div>
  );
}

function TaxSummary({ id, ctx, compare }: { id: string, ctx: DeskContext, compare?: boolean }) {
  const statement = ctx.statements[id];
  const tax = ctx.taxes[id];
  if (!statement || !tax)
    return null;
  const c = tax.chosen;
  const other = tax.alternative;
  const difference = other.taxPayable - c.taxPayable;
  const otherName = other.regime === 'new' ? 'new' : 'old';
  const comparison = difference > 0
    ? `The ${otherName} regime would cost ${formatRupees(difference)} more with the current declarations.`
    : difference < 0
      ? `The ${otherName} regime would be ${formatRupees(-difference)} lower with the current declarations.`
      : 'Both regimes come to the same tax.';
  const recovery = recoveryText(tax);
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <p className="text-[12.5px] text-muted">{`${statement.employeeName} · ${c.rules.label} · ${c.regime === 'new' ? 'new regime' : 'old regime'}`}</p>
      <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
        <span className="tabular font-display text-[32px] leading-none text-ink">{formatRupees(c.taxPayable)}</span>
        <span className="text-[13.5px] text-muted">income tax for the year</span>
      </p>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Stat label="Total income" value={c.taxableIncome} />
        <Stat label="Deducted so far" value={c.tdsDeducted + c.previousEmployerTds} />
        <Stat label={balanceLabel(c)} value={Math.abs(c.balance)} accent />
      </div>
      <ul className="mt-3 space-y-1 text-[13px] text-ink/85">
        <li>{`Slabs: ${formatRupees(c.taxOnIncome)}${c.rebate.amount ? `, less ${formatRupees(c.rebate.amount)} rebate u/s 87A` : ''}${c.surcharge.amount ? `, plus ${c.surcharge.rate}% surcharge ${formatRupees(c.surcharge.amount)}` : ''}, plus 4% cess ${formatRupees(c.cess, 2)}.`}</li>
        {recovery && <li className="font-medium text-ink">{recovery}</li>}
        <li className="text-muted">{comparison}</li>
      </ul>
      <ActionButtons
        run={ctx.run}
        actions={[
          compare ? { kind: 'open', view: 'compare', statementId: id, label: 'Compare regimes' } : { kind: 'open', view: 'tax', statementId: id, label: 'Open full computation' },
          { kind: 'export', statementIds: [id], label: 'Download Excel' },
          { kind: 'print', what: 'tax', statementId: id, label: 'Print' },
        ]}
      />
    </div>
  );
}

function SlipsSummary({ id, ctx }: { id: string, ctx: DeskContext }) {
  const statement = ctx.statements[id];
  if (!statement)
    return null;
  const slips = statement.rows.map(buildSlip);
  const months = slips.filter(slip => slip.kind === 'month');
  const latest = [...months].reverse().find(slip => slip.gross > 0);
  const chip = (slip: (typeof slips)[number], index: number) => {
    const row = statement.rows[index];
    return row.kind === 'month' && row.month && row.year ? `${MONTH_NAMES[row.month - 1]} ’${String(row.year).slice(2)}` : slip.period;
  };
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <p className="text-[12.5px] text-muted">{`${statement.employeeName} · pay slips`}</p>
      <p className="mt-1 text-[14px] text-ink">
        {`${months.length} monthly ${months.length === 1 ? 'slip' : 'slips'}${slips.length > months.length ? ` and ${slips.length - months.length} for arrears` : ''}.`}
        {latest && ` Net pay for ${latest.period}: `}
        {latest && <strong className="tabular font-semibold">{formatRupees(latest.net)}</strong>}
        {latest && '.'}
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {slips.map((slip, index) => (
          <button
            key={slip.key}
            type="button"
            onClick={() => ctx.run({ kind: 'open', view: 'slips', statementId: id, slipKey: slip.key, label: slip.period })}
            className="rounded-lg border border-line bg-surface px-2.5 py-1 text-[12.5px] text-ink transition-colors hover:border-muted/40 hover:bg-surface-2"
          >
            {chip(slip, index)}
          </button>
        ))}
      </div>
      <ActionButtons run={ctx.run} actions={[{ kind: 'print', what: 'slips', statementId: id, label: 'Print all slips' }]} />
    </div>
  );
}

function Employees({ ids, ctx }: { ids: string[], ctx: DeskContext }) {
  const rows = ids.filter(id => ctx.statements[id] && ctx.taxes[id]);
  return (
    <div className="rounded-2xl border border-line bg-surface p-2 sm:p-3">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-[12px] text-muted">
            <th className="px-2 py-1.5 font-medium">Employee</th>
            <th className="px-2 py-1.5 text-right font-medium">Tax payable</th>
            <th className="px-2 py-1.5 text-right font-medium">Balance</th>
          </tr>
        </thead>
        <tbody className="tabular">
          {rows.map((id) => {
            const c = ctx.taxes[id].chosen;
            return (
              <tr key={id} className="cursor-pointer border-t border-line/70 hover:bg-surface-2" onClick={() => ctx.run({ kind: 'open', view: 'tax', statementId: id, label: '' })}>
                <td className="px-2 py-2 font-body">
                  <span className="font-medium text-ink">{ctx.statements[id].employeeName}</span>
                  <span className="block text-[12px] text-muted">{ctx.statements[id].designation}</span>
                </td>
                <td className="px-2 py-2 text-right">{formatRupees(c.taxPayable)}</td>
                <td className={`px-2 py-2 text-right ${c.balance > 0 ? 'text-accent-text' : 'text-muted'}`}>{c.balance >= 0 ? formatRupees(c.balance) : `−${formatRupees(-c.balance)}`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="px-2 pb-1">
        <ActionButtons run={ctx.run} actions={[{ kind: 'export', statementIds: rows, label: 'Download all as Excel' }]} />
      </div>
    </div>
  );
}

function FormatGuide({ run }: { run: (action: Action) => void }) {
  return (
    <div>
      <p>Each sheet is one employee’s salary for one year, laid out like the office statement:</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px]">
        <li>Office name at the top, then the title with the year: “Statement of Salary for the year 2025-26”.</li>
        <li>“Name of employee: …” and “Designation: …” above the table.</li>
        <li>A row of headings, then one row per month (March to February), then arrear rows such as “DA ARR”, then TOTAL.</li>
      </ul>
      <div className="mt-3 overflow-hidden rounded-xl border border-line bg-surface font-body">
        <table className="w-full text-[12.5px]">
          <tbody>
            {COLUMNS.map(column => (
              <tr key={column.key} className="border-t border-line/70 first:border-t-0">
                <td className="whitespace-nowrap px-3 py-1.5 font-medium text-ink">{column.header}</td>
                <td className="px-3 py-1.5 text-muted">
                  {column.description}
                  {column.required && <span className="ml-1 text-accent-text">Required.</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3">Headings with small spelling differences are still recognised, and I’ll say which ones to correct. A Declarations sheet is optional, for the old regime or other income.</p>
      <ActionButtons run={run} actions={[{ kind: 'template', label: 'Download the template' }, { kind: 'sample', label: 'Try the sample' }]} />
    </div>
  );
}

function RulesExplainer({ fy }: { fy: FinancialYear }) {
  const rules = getYearRules(fy);
  const fresh = rules.regimes.new;
  const old = rules.regimes.old;
  return (
    <div>
      <p>{`For ${rules.label} the tax is worked out in this order:`}</p>
      <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[15px]">
        <li>Gross salary: every pay column for every month and arrear row.</li>
        <li>{`Add the Government’s 14% NPS contribution (taxable salary, s.17(1)(viii)) and take off the standard deduction: ${formatRupees(fresh.standardDeduction)} in the new regime, ${formatRupees(old.standardDeduction)} in the old.`}</li>
        <li>Take off deductions. In both regimes: the Government NPS contribution up to 14% of basic pay + DA (80CCD(2)). In the old regime also HRA exemption, 80C (GIS, employee NPS, investments, up to ₹1,50,000), 80CCD(1B), 80D (CGHS and insurance), home-loan interest and more.</li>
        <li>Round total income to the nearest ₹10 (s.288A) and apply the slabs below.</li>
        <li>{`Rebate u/s 87A: in the new regime tax is nil up to ${formatRupees(fresh.rebate.incomeUpTo)} of income (rebate up to ${formatRupees(fresh.rebate.maxRebate)}); just above it, marginal relief caps the tax at the income above that line. Old regime: up to ${formatRupees(old.rebate.maxRebate)} for income up to ${formatRupees(old.rebate.incomeUpTo)}.`}</li>
        <li>Surcharge on the tax: 10% above ₹50 lakh, 15% above ₹1 crore, 25% above ₹2 crore (old regime: 37% above ₹5 crore), with marginal relief so crossing a line never costs more than the income above it.</li>
        <li>{`Health and education cess: ${rules.cessPercent}% of tax + surcharge. Round to the nearest ₹10 (s.288B), then subtract tax already deducted.`}</li>
      </ol>
      <div className="mt-3 grid gap-3 font-body sm:grid-cols-2">
        {[fresh, old].map(regime => (
          <div key={regime.regime} className="rounded-xl border border-line bg-surface p-3">
            <p className="text-[12.5px] font-medium text-ink">{regime.regime === 'new' ? 'New regime slabs' : 'Old regime slabs (below 60)'}</p>
            <table className="mt-1.5 w-full text-[12.5px]">
              <tbody>
                {regime.slabs.below60.map((slab, index, all) => {
                  const from = index ? (all[index - 1].upTo as number) : 0;
                  return (
                    <tr key={from} className="border-t border-line/60 first:border-t-0">
                      <td className="py-1 text-muted">{slabLabel({ from, to: slab.upTo, rate: slab.rate, amount: 0, tax: 0 })}</td>
                      <td className="py-1 text-right text-ink">{rateLabel(slab.rate)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}

const HELP_EXAMPLES = ['Income tax', 'Pay slip for August', 'Compare old and new regime', 'Edit declarations', 'Show the statement', 'Download Excel', 'What format do I need?', 'Download the template'];

function Help({ run }: { run: (action: Action) => void }) {
  return (
    <div>
      <p>I don’t use AI, so I understand a set of plain requests. Upload a salary statement with the paperclip (or drop it anywhere), then try:</p>
      <div className="mt-3 flex flex-wrap gap-2 font-body">
        {HELP_EXAMPLES.map(text => (
          <button key={text} type="button" onClick={() => run({ kind: 'say', text, label: text })} className="rounded-xl border border-line bg-surface px-3 py-1.5 text-[13px] text-ink transition-colors hover:bg-surface-2">
            {text}
          </button>
        ))}
      </div>
      <p className="mt-3">Add an employee’s name to pick one when a file has several, e.g. “tax for Sharma” or “slip for March Sharma”.</p>
    </div>
  );
}

function BlockView({ block, ctx }: { block: Block, ctx: DeskContext }): ReactNode {
  switch (block.type) {
    case 'text':
      return <RichText text={block.text} />;
    case 'file':
      return ctx.files[block.fileId] ? <div className="font-body"><FileReport file={ctx.files[block.fileId]} ctx={ctx} /></div> : null;
    case 'tax':
      return <div className="font-body"><TaxSummary id={block.statementId} ctx={ctx} /></div>;
    case 'compare':
      return <div className="font-body"><TaxSummary id={block.statementId} ctx={ctx} compare /></div>;
    case 'slips':
      return <div className="font-body"><SlipsSummary id={block.statementId} ctx={ctx} /></div>;
    case 'employees':
      return <div className="font-body"><Employees ids={block.statementIds} ctx={ctx} /></div>;
    case 'format':
      return <FormatGuide run={ctx.run} />;
    case 'rules':
      return <RulesExplainer fy={block.fy} />;
    case 'help':
      return <Help run={ctx.run} />;
    case 'actions':
      return <div className="font-body"><ActionButtons actions={block.actions} run={ctx.run} /></div>;
  }
}

export function UserMessage({ message }: { message: Extract<Message, { role: 'user' }> }) {
  return (
    <div className="flex animate-rise flex-col items-end gap-2">
      {message.files?.map(file => (
        <span key={file.name} className="inline-flex max-w-[85%] items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2">
          <span className="grid size-8 place-items-center rounded-lg bg-good/10 text-good"><Icon name="file" className="size-4" /></span>
          <span className="min-w-0">
            <span className="block truncate text-[13.5px] font-medium text-ink">{file.name}</span>
            <span className="block text-[11.5px] text-muted">{`Spreadsheet · ${bytes(file.size)}`}</span>
          </span>
        </span>
      ))}
      {message.text && (
        <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl bg-surface-2 px-4 py-2.5 text-[15px] leading-relaxed text-ink">{message.text}</p>
      )}
    </div>
  );
}

export function AssistantMessage({ message, ctx }: { message: Extract<Message, { role: 'assistant' }>, ctx: DeskContext }) {
  return (
    <div className="flex animate-rise gap-3 sm:gap-4">
      <span aria-hidden className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-accent font-display text-[15px] font-semibold text-accent-ink">₹</span>
      <div className="min-w-0 flex-1" aria-live="polite" aria-busy={Boolean(message.pending)}>
        {message.pending
          ? <p className="text-shimmer pt-1 text-[15px] font-medium">{message.pending}</p>
          : (
            <div className="space-y-3 font-display text-[16.5px] leading-[1.65] text-ink [&_p+p]:mt-3">
              {message.blocks.map((block, index) => <BlockView key={index} block={block} ctx={ctx} />)}
            </div>
            )}
      </div>
    </div>
  );
}
