'use client';

import { useEffect, useMemo, useRef } from 'react';
import { DeclarationsForm } from './DeclarationsForm';
import { CompareView, SlipCard, StatementTable, TaxDocument } from './documents';
import { Icon, type IconName } from './icons';
import type { PanelState, PanelView } from './types';
import type { Declarations } from '../engine/declarations';
import { buildSlip } from '../engine/slip';
import type { StatementTax } from '../engine/statementTax';
import { MONTH_NAMES, type SalaryStatement } from '../model';

const TABS: { view: PanelView, label: string, icon: IconName }[] = [
  { view: 'tax', label: 'Income tax', icon: 'calculator' },
  { view: 'slips', label: 'Pay slips', icon: 'receipt' },
  { view: 'statement', label: 'Statement', icon: 'table' },
  { view: 'declarations', label: 'Declarations', icon: 'sliders' },
  { view: 'compare', label: 'Compare', icon: 'scale' },
];

interface PanelProps {
  panel: PanelState;
  statements: SalaryStatement[];
  statement: SalaryStatement;
  tax: StatementTax;
  declarations: Declarations;
  onChange: (next: PanelState) => void;
  onClose: () => void;
  onDeclarations: (next: Declarations) => void;
  onResetDeclarations: () => void;
  onExport: () => void;
  onPrint: (what: 'tax' | 'slips' | 'slip' | 'statement', slipKey?: string) => void;
}

export default function Panel({ panel, statements, statement, tax, declarations, onChange, onClose, onDeclarations, onResetDeclarations, onExport, onPrint }: PanelProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const slips = useMemo(() => statement.rows.map(buildSlip), [statement]);
  const slip = slips.find(item => item.key === panel.slipKey) ?? [...slips].reverse().find(item => item.kind === 'month' && item.gross > 0) ?? slips[0];

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [panel.view, panel.statementId, panel.slipKey]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape')
        onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const printWhat = panel.view === 'slips' ? 'slip' : panel.view === 'statement' ? 'statement' : 'tax';

  return (
    <div className="flex h-full flex-col bg-bg lg:bg-surface/60">
      <div className="border-b border-line bg-surface/80 px-4 pt-3 backdrop-blur-md sm:px-5">
        <div className="flex items-center justify-between gap-3">
          {statements.length > 1
            ? (
              <select
                value={statement.id}
                onChange={event => onChange({ ...panel, statementId: event.target.value, slipKey: undefined })}
                aria-label="Employee"
                className="min-w-0 max-w-[60%] truncate rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[14px] font-medium text-ink"
              >
                {statements.map(item => <option key={item.id} value={item.id}>{item.employeeName}</option>)}
              </select>
              )
            : <p className="min-w-0 truncate text-[14px] font-medium text-ink">{statement.employeeName}</p>}
          <div className="flex shrink-0 items-center gap-1">
            {panel.view !== 'declarations' && panel.view !== 'compare' && (
              <button type="button" onClick={() => onPrint(printWhat, slip?.key)} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] text-muted transition-colors hover:bg-surface-2 hover:text-ink">
                <Icon name="printer" className="size-4" />
                <span className="hidden sm:inline">{panel.view === 'slips' ? 'Print slip' : 'Print'}</span>
              </button>
            )}
            <button type="button" onClick={onExport} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] text-muted transition-colors hover:bg-surface-2 hover:text-ink">
              <Icon name="download" className="size-4" />
              <span className="hidden sm:inline">Excel</span>
            </button>
            <button type="button" onClick={onClose} aria-label="Close panel" className="grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink">
              <Icon name="x" className="size-4" />
            </button>
          </div>
        </div>
        <nav aria-label="Views" className="-mb-px mt-2 flex gap-1 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.view}
              type="button"
              onClick={() => onChange({ ...panel, view: tab.view })}
              aria-current={panel.view === tab.view ? 'page' : undefined}
              className={`inline-flex shrink-0 items-center gap-1.5 border-b-2 px-2.5 pb-2.5 pt-1 text-[13px] transition-colors ${panel.view === tab.view ? 'border-accent-bright font-medium text-ink' : 'border-transparent text-muted hover:text-ink'}`}
            >
              <Icon name={tab.icon} className="size-3.5" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div ref={bodyRef} className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <div key={`${panel.view}-${panel.statementId}`} className="mx-auto max-w-[760px] animate-slide-in">
          {panel.view === 'tax' && <TaxDocument statement={statement} tax={tax} />}
          {panel.view === 'slips' && slip && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-1.5">
                {slips.map((item, index) => {
                  const row = statement.rows[index];
                  const label = row.kind === 'month' && row.month && row.year ? `${MONTH_NAMES[row.month - 1]} ’${String(row.year).slice(2)}` : item.period;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => onChange({ ...panel, slipKey: item.key })}
                      aria-pressed={item.key === slip.key}
                      className={`rounded-lg border px-2.5 py-1 text-[12.5px] transition-colors ${item.key === slip.key ? 'border-ink bg-ink text-bg' : 'border-line bg-surface text-ink hover:bg-surface-2'}`}
                    >
                      {label}
                    </button>
                  );
                })}
                <button type="button" onClick={() => onPrint('slips')} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1 text-[12.5px] text-ink transition-colors hover:bg-surface-2">
                  <Icon name="printer" className="size-3.5" />
                  All slips
                </button>
              </div>
              <SlipCard statement={statement} slip={slip} />
            </div>
          )}
          {panel.view === 'statement' && <StatementTable statement={statement} tax={tax} />}
          {panel.view === 'declarations' && (
            <DeclarationsForm value={declarations} statementFy={statement.financialYear} onChange={onDeclarations} onReset={onResetDeclarations} />
          )}
          {panel.view === 'compare' && <CompareView tax={tax} onEditDeclarations={() => onChange({ ...panel, view: 'declarations' })} />}
        </div>
      </div>
    </div>
  );
}
