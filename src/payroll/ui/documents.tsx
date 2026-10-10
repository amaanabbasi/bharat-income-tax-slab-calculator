import type { ReactNode } from 'react';
import { Icon } from './icons';
import { formatAmount, formatRupees } from '../engine/money';
import type { PaySlip, SlipLine } from '../engine/slip';
import type { StatementTax } from '../engine/statementTax';
import { type Line, type TaxComputation, rateLabel, slabLabel } from '../engine/tax';
import { COLUMNS, PAY_KEYS } from '../format/salaryStatement';
import type { SalaryStatement } from '../model';

export function SectionTag({ children }: { children: ReactNode }) {
  return (
    <span className="ml-1.5 inline-block whitespace-nowrap rounded border border-line px-1.5 py-px align-middle text-[10.5px] font-medium tracking-wide text-muted">
      {children}
    </span>
  );
}

function Paper({ children }: { children: ReactNode }) {
  return <article className="paper rounded-2xl border border-line bg-surface p-5 shadow-paper sm:p-7">{children}</article>;
}

function DocHeader({ statement, title, subtitle }: { statement: SalaryStatement, title: string, subtitle: string }) {
  return (
    <header className="border-b border-line pb-4 text-center">
      {statement.organisation && <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{statement.organisation}</p>}
      <h2 className="mt-1.5 font-display text-[26px] leading-tight text-ink">{title}</h2>
      <p className="mt-1 text-[13px] text-muted">{subtitle}</p>
      <p className="mt-3 text-[15px] font-medium text-ink">
        {statement.employeeName}
        {statement.designation && <span className="font-normal text-muted">{` · ${statement.designation}`}</span>}
      </p>
    </header>
  );
}

/** "Less: standard deduction" → "Standard deduction"; the sign column says add or less. */
function plain(label: string): string {
  const text = label.replace(/^(Add|Less):\s*/, '');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function Row({ label, amount, section, op, detail, total, strong, decimals = 0, accent }: {
  label: ReactNode;
  amount?: number;
  section?: string;
  op?: Line['op'];
  detail?: { label: string, amount: number }[];
  total?: boolean;
  strong?: boolean;
  decimals?: 0 | 2;
  accent?: boolean;
}) {
  const sign = !amount ? '' : op === 'add' ? '+' : op === 'less' ? '−' : '';
  return (
    <div className={`py-2 ${total ? 'border-t border-line' : ''}`}>
      <div className="flex items-baseline justify-between gap-4">
        <span className={`text-[14px] leading-snug ${strong ? 'font-semibold text-ink' : 'text-ink/90'}`}>
          {label}
          {section && <SectionTag>{section}</SectionTag>}
        </span>
        {amount !== undefined && (
          <span className={`tabular shrink-0 text-[14px] ${strong ? 'font-semibold' : ''} ${accent ? 'text-accent-text' : 'text-ink'}`}>
            {sign && <span className="mr-1 text-muted">{sign}</span>}
            {formatAmount(amount, decimals)}
          </span>
        )}
      </div>
      {detail && detail.length > 0 && (
        <ul className="mt-1 space-y-0.5 border-l border-line pl-3 text-[12.5px] text-muted">
          {detail.map(item => (
            <li key={item.label} className="flex justify-between gap-4">
              <span>{item.label}</span>
              <span className="tabular">{formatAmount(item.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string, children: ReactNode }) {
  return (
    <section className="mt-6">
      <h3 className="mb-1 text-[11.5px] font-semibold uppercase tracking-[0.1em] text-muted">{title}</h3>
      {children}
    </section>
  );
}

function KeyFigures({ items }: { items: { label: string, value: number, accent?: boolean }[] }) {
  return (
    <dl className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
      {items.map(item => (
        <div key={item.label} className={`rounded-xl px-3 py-2.5 ${item.accent ? 'bg-accent/10' : 'bg-surface-2'}`}>
          <dt className="text-[11.5px] leading-tight text-muted">{item.label}</dt>
          <dd className={`tabular mt-1 font-display text-[19px] leading-none sm:text-[22px] ${item.accent ? 'text-accent-text' : 'text-ink'}`}>{formatRupees(item.value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function Notes({ notes }: { notes: string[] }) {
  if (!notes.length)
    return null;
  return (
    <section className="mt-6 rounded-xl bg-surface-2 px-4 py-3">
      <h3 className="text-[11.5px] font-semibold uppercase tracking-[0.1em] text-muted">How the rules applied</h3>
      <ul className="mt-2 space-y-1.5 text-[13px] leading-relaxed text-ink/85">
        {notes.map(note => (
          <li key={note} className="flex gap-2">
            <span aria-hidden className="mt-[7px] size-1 shrink-0 rounded-full bg-accent-bright" />
            <span>{note}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Signatures({ names }: { names: string[] }) {
  if (!names.length)
    return null;
  return (
    <footer className="mt-10 flex justify-between gap-4 text-[12.5px] font-medium text-muted">
      {names.slice(0, 3).map(name => (
        <span key={name} className="border-t border-line pt-1.5">{name}</span>
      ))}
    </footer>
  );
}

export function balanceLabel(c: TaxComputation): string {
  return c.balance >= 0 ? 'Balance to recover' : 'Deducted in excess';
}

export function recoveryText(tax: StatementTax): string | null {
  if (!tax.recovery)
    return null;
  const { perMonth, months } = tax.recovery;
  return months.length === 1
    ? `Recover ${formatRupees(perMonth)} from the ${months[0]} salary.`
    : `Recover ${formatRupees(perMonth)} a month from the salaries of ${months.join(', ')}.`;
}

export function TaxDocument({ statement, tax }: { statement: SalaryStatement, tax: StatementTax }) {
  const c = tax.chosen;
  const recovery = recoveryText(tax);
  const [gross, ...salaryLines] = c.salaryLines;
  return (
    <Paper>
      <DocHeader statement={statement} title="Calculation of income tax" subtitle={`${c.rules.label} · ${c.regimeRules.title}`} />
      <KeyFigures items={[
        { label: 'Tax payable', value: c.taxPayable },
        { label: 'Deducted so far', value: c.tdsDeducted + c.previousEmployerTds },
        { label: balanceLabel(c), value: Math.abs(c.balance), accent: true },
      ]}
      />
      {(recovery || c.balance < 0) && (
        <p className="mt-3 rounded-xl border border-accent/30 bg-accent/5 px-3.5 py-2.5 text-[13.5px] text-ink">
          {recovery ?? `Tax deducted is ${formatRupees(-c.balance)} more than the tax due; stop further deductions, and the employee can claim the refund in the return.`}
        </p>
      )}

      <Group title="Income">
        <Row label="Gross income from salary" amount={gross.amount} detail={gross.detail} />
        {salaryLines.map(line => (
          <Row key={line.label} label={plain(line.label)} section={line.section ? `u/s ${line.section}` : undefined} amount={line.amount} op={line.op} detail={line.detail} />
        ))}
        <Row label="Income under the head “Salaries”" amount={c.incomeFromSalary} total strong />
        {c.otherLines.map(line => (
          <Row key={line.label} label={line.label} section={line.section ? `u/s ${line.section}` : undefined} amount={line.amount} op={line.op} />
        ))}
        {c.otherLines.length > 0 && <Row label="Gross total income" amount={c.grossTotalIncome} total strong />}
      </Group>

      {c.deductionLines.length > 0 && (
        <Group title="Deductions (Chapter VI-A)">
          {c.deductionLines.map(line => (
            <Row key={line.label} label={line.label} section={line.section} amount={line.amount} op="less" detail={line.detail} />
          ))}
          <Row label="Total deductions" amount={c.totalDeductions} total />
        </Group>
      )}

      <Group title="Total income">
        <Row label="Total taxable income" amount={c.totalIncome} />
        <Row label="Rounded off to the nearest ₹10" section="u/s 288A" amount={c.taxableIncome} strong />
      </Group>

      <Group title="Tax, slab by slab">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-[13.5px]">
            <thead>
              <tr className="text-left text-[12px] text-muted">
                <th className="py-1.5 font-medium">Slab</th>
                <th className="py-1.5 text-right font-medium">Rate</th>
                <th className="py-1.5 text-right font-medium">Income in slab</th>
                <th className="py-1.5 text-right font-medium">Tax</th>
              </tr>
            </thead>
            <tbody>
              {c.slabs.map(slab => (
                <tr key={slab.from} className={`border-t border-line/70 ${slab.amount ? 'text-ink' : 'text-muted'}`}>
                  <td className="py-1.5 pr-3">{slabLabel(slab)}</td>
                  <td className="py-1.5 text-right">{rateLabel(slab.rate)}</td>
                  <td className="tabular py-1.5 text-right">{formatAmount(slab.amount)}</td>
                  <td className="tabular py-1.5 text-right">{formatAmount(slab.tax)}</td>
                </tr>
              ))}
              <tr className="border-t border-line font-semibold">
                <td className="py-2" colSpan={3}>Tax on total income</td>
                <td className="tabular py-2 text-right">{formatAmount(c.taxOnIncome)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Group>

      <Group title="Tax payable">
        <Row label="Tax on total income" amount={c.taxOnIncome} />
        <Row
          label={`Rebate${c.rebate.kind === 'marginal' ? ' (marginal relief)' : ''}: income up to ${formatRupees(c.rebate.incomeUpTo)}`}
          section="u/s 87A"
          amount={c.rebate.amount}
          op="less"
        />
        <Row label="Income tax" amount={c.taxAfterRebate} total />
        <Row
          label={c.surcharge.rate ? `Surcharge @ ${c.surcharge.rate}%` : 'Surcharge (only above ₹50 lakh)'}
          amount={c.surcharge.amount}
          op="add"
          detail={c.surcharge.relief ? [{ label: `${c.surcharge.rate}% of income tax`, amount: c.surcharge.beforeRelief }, { label: 'Less: marginal relief', amount: c.surcharge.relief }] : undefined}
        />
        <Row label={`Health and education cess @ ${c.cessPercent}%`} amount={c.cess} op="add" decimals={2} />
        <Row label="Tax payable" amount={c.grossTax} decimals={2} total />
        {c.relief89 > 0 && <Row label="Relief for arrears" section="u/s 89" amount={c.relief89} op="less" />}
        <Row label="Rounded off to the nearest ₹10" section="u/s 288B" amount={c.taxPayable} strong />
        <Row label={`Tax deducted${tax.annual.tdsPeriod ? ` (${tax.annual.tdsPeriod})` : ''}`} amount={c.tdsDeducted} op="less" />
        {c.previousEmployerTds > 0 && <Row label="Tax deducted by previous employer" amount={c.previousEmployerTds} op="less" />}
        <Row label={balanceLabel(c)} amount={Math.abs(c.balance)} total strong accent />
      </Group>

      <Notes notes={[...tax.notes, ...c.notes]} />
      <Signatures names={statement.signatures} />
    </Paper>
  );
}

function SlipColumn({ title, lines, totalLabel, total }: { title: string, lines: SlipLine[], totalLabel: string, total: number }) {
  return (
    <section>
      <h3 className="mb-1 text-[11.5px] font-semibold uppercase tracking-[0.1em] text-muted">{title}</h3>
      {lines.map(line => (
        <div key={line.label} className="flex items-baseline justify-between gap-4 border-b border-line/60 py-1.5">
          <span className="text-[13.5px] text-ink/90">
            {line.label}
            {line.note && <span className="block text-[11.5px] text-muted">{line.note}</span>}
          </span>
          <span className="tabular text-[13.5px] text-ink">{formatAmount(line.amount, 2)}</span>
        </div>
      ))}
      <div className="flex items-baseline justify-between gap-4 py-2 font-semibold">
        <span className="text-[13.5px]">{totalLabel}</span>
        <span className="tabular text-[13.5px]">{formatAmount(total, 2)}</span>
      </div>
    </section>
  );
}

export function SlipCard({ statement, slip }: { statement: SalaryStatement, slip: PaySlip }) {
  return (
    <Paper>
      <DocHeader statement={statement} title={slip.title} subtitle={`Financial year ${statement.financialYear}`} />
      <div className="mt-5 grid gap-6 sm:grid-cols-2">
        <SlipColumn title="Earnings" lines={slip.earnings} totalLabel="Gross pay" total={slip.gross} />
        <SlipColumn title="Deductions" lines={slip.deductions} totalLabel="Total deductions" total={slip.totalDeductions} />
      </div>
      <div className="mt-4 rounded-xl bg-surface-2 px-4 py-3.5">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-[13px] font-medium text-muted">Net pay</span>
          <span className="tabular font-display text-[26px] leading-none text-ink">{formatRupees(slip.net, 2)}</span>
        </div>
        <p className="mt-1.5 text-[12.5px] text-muted">{slip.netInWords}</p>
      </div>
      {slip.employerNps > 0 && (
        <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
          {`Government NPS contribution (14%): ${formatRupees(slip.employerNps)}. It goes to the employee’s NPS account, not the bank, and counts as taxable salary.`}
        </p>
      )}
      <p className="mt-6 text-[11.5px] text-muted">{`From ${statement.fileName}, sheet “${statement.sheetName}”.`}</p>
    </Paper>
  );
}

export function StatementTable({ statement, tax }: { statement: SalaryStatement, tax: StatementTax }) {
  const rows = statement.rows;
  const totals = PAY_KEYS.map(key => rows.reduce((sum, row) => sum + row.values[key], 0));
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[1080px] text-[12.5px]">
          <thead className="bg-surface-2 text-muted">
            <tr>
              {COLUMNS.map(column => (
                <th key={column.key} className={`whitespace-nowrap px-2.5 py-2 font-medium ${column.key === 'month' ? 'sticky left-0 bg-surface-2 text-left' : 'text-right'}`}>{column.header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="tabular">
            {rows.map(row => (
              <tr key={`${row.sheetRow}-${row.label}`} className="border-t border-line/70">
                <td className="sticky left-0 whitespace-nowrap bg-surface px-2.5 py-1.5 font-medium text-ink">{row.label}</td>
                {PAY_KEYS.map(key => (
                  <td key={key} className={`px-2.5 py-1.5 text-right ${key === 'gross' ? 'font-semibold text-ink' : 'text-ink/85'}`}>
                    {key === 'incomeTax' && row.taxPending ? <span className="text-muted">—</span> : formatAmount(row.values[key])}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="border-t border-line bg-surface-2 font-semibold">
              <td className="sticky left-0 bg-surface-2 px-2.5 py-2">TOTAL</td>
              {totals.map((total, index) => (
                <td key={PAY_KEYS[index]} className="px-2.5 py-2 text-right">{formatAmount(total)}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      {tax.annual.projectedMonths.length > 0 && (
        <p className="text-[12.5px] text-muted">
          {`Not drawn yet: ${tax.annual.projectedMonths.join(', ')}. The tax estimate repeats the latest month for these.`}
        </p>
      )}
    </div>
  );
}

export function CompareView({ tax, onEditDeclarations }: { tax: StatementTax, onEditDeclarations: () => void }) {
  const [first, second] = tax.chosen.regime === 'new' ? [tax.chosen, tax.alternative] : [tax.alternative, tax.chosen];
  const lower = first.taxPayable <= second.taxPayable ? first : second;
  const difference = Math.abs(first.taxPayable - second.taxPayable);
  const rows: [string, (c: TaxComputation) => number][] = [
    ['Income from salary', c => c.incomeFromSalary],
    ['Gross total income', c => c.grossTotalIncome],
    ['Deductions', c => c.totalDeductions],
    ['Total income (288A)', c => c.taxableIncome],
    ['Tax on total income', c => c.taxOnIncome],
    ['Rebate u/s 87A', c => c.rebate.amount],
    ['Surcharge', c => c.surcharge.amount],
    ['Cess', c => c.cess],
    ['Tax payable (288B)', c => c.taxPayable],
  ];
  return (
    <Paper>
      <h2 className="font-display text-[24px] leading-tight text-ink">New or old regime?</h2>
      <p className="mt-2 text-[14px] leading-relaxed text-ink/85">
        {difference === 0
          ? 'Both regimes come to the same tax with the current declarations.'
          : `The ${lower.regime} regime is lower by ${formatRupees(difference)} with the current declarations.`}
        {' '}
        {`The employee is set to the ${tax.chosen.regime} regime.`}
      </p>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[380px] text-[13.5px]">
          <thead>
            <tr className="text-[12px] text-muted">
              <th className="py-1.5 text-left font-medium" />
              {[first, second].map(c => (
                <th key={c.regime} className="py-1.5 text-right font-medium">
                  {c.regime === 'new' ? 'New regime' : 'Old regime'}
                  {c.regime === tax.chosen.regime && <span className="ml-1 text-accent-text">· chosen</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="tabular">
            {rows.map(([label, value]) => (
              <tr key={label} className={`border-t border-line/70 ${label.startsWith('Tax payable') ? 'font-semibold' : ''}`}>
                <td className="py-1.5 pr-3 font-body">{label}</td>
                {[first, second].map(c => (
                  <td key={c.regime} className={`py-1.5 text-right ${label.startsWith('Tax payable') && c === lower && difference ? 'text-accent-text' : ''}`}>
                    {formatAmount(value(c), label === 'Cess' ? 2 : 0)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-5 text-[13px] leading-relaxed text-muted">
        The old regime only comes out lower with large deductions: rent paid (HRA exemption), 80C investments, health insurance, home-loan interest. CGHS, GIS and the employee’s NPS from the statement are already counted.
      </p>
      <button type="button" onClick={onEditDeclarations} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[13px] text-ink transition-colors hover:bg-surface-2">
        <Icon name="sliders" className="size-3.5" />
        Add declarations
      </button>
    </Paper>
  );
}
