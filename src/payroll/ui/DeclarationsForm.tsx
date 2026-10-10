'use client';

import { DECLARATION_FIELDS, type DeclarationField, type Declarations } from '../engine/declarations';
import { AGE_GROUP_LABELS, type AgeGroup, FINANCIAL_YEARS, type FinancialYear } from '../rules/taxRules';

const GROUPS: { id: DeclarationField['group'], title: string, note?: string }[] = [
  { id: 'profile', title: 'Regime and settings' },
  { id: 'income', title: 'Other income and previous employer' },
  { id: 'old', title: 'Exemptions and deductions', note: 'These count only in the old regime.' },
  { id: 'relief', title: 'Relief' },
];

function short(label: string): string {
  return label.replace(/\s*\((?:New \/ Old|Yes \/ No|Below 60 \/ 60-79 \/ 80\+)\)/, '').replace(/\s*\(leave blank[^)]*\)/, '');
}

export function DeclarationsForm({ value, statementFy, onChange, onReset }: {
  value: Declarations;
  statementFy: string;
  onChange: (next: Declarations) => void;
  onReset: () => void;
}) {
  const set = <K extends keyof Declarations>(key: K, next: Declarations[K]) => onChange({ ...value, [key]: next });

  const control = (field: DeclarationField) => {
    const id = `decl-${field.key}`;
    switch (field.kind) {
      case 'regime':
        return (
          <div role="radiogroup" aria-label="Tax regime" className="inline-flex rounded-lg border border-line bg-surface-2 p-0.5">
            {(['new', 'old'] as const).map(regime => (
              <button
                key={regime}
                type="button"
                role="radio"
                aria-checked={value.regime === regime}
                onClick={() => set('regime', regime)}
                className={`rounded-md px-3 py-1 text-[13px] transition-colors ${value.regime === regime ? 'bg-surface font-medium text-ink shadow-sm' : 'text-muted hover:text-ink'}`}
              >
                {regime === 'new' ? 'New' : 'Old'}
              </button>
            ))}
          </div>
        );
      case 'age':
        return (
          <select id={id} value={value.ageGroup} onChange={event => set('ageGroup', event.target.value as AgeGroup)} className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] text-ink">
            {(Object.keys(AGE_GROUP_LABELS) as AgeGroup[]).map(age => <option key={age} value={age}>{AGE_GROUP_LABELS[age]}</option>)}
          </select>
        );
      case 'fy':
        return (
          <select id={id} value={value.fyOverride ?? ''} onChange={event => set('fyOverride', (event.target.value || null) as FinancialYear | null)} className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] text-ink">
            <option value="">{`Statement year (${statementFy})`}</option>
            {FINANCIAL_YEARS.map(fy => <option key={fy} value={fy}>{fy}</option>)}
          </select>
        );
      case 'yesno': {
        const on = Boolean(value[field.key]);
        return (
          <button
            id={id}
            type="button"
            role="switch"
            aria-checked={on}
            onClick={() => set(field.key, !on as Declarations[typeof field.key])}
            className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${on ? 'bg-accent' : 'bg-line'}`}
          >
            <span className={`absolute left-0 top-0.5 size-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
          </button>
        );
      }
      case 'amount':
        return (
          <div className="flex items-center rounded-lg border border-line bg-surface focus-within:border-muted/50">
            <span className="pl-2.5 text-[13px] text-muted">₹</span>
            <input
              id={id}
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={Number(value[field.key]) || ''}
              placeholder="0"
              onChange={event => set(field.key, Math.max(0, Number(event.target.value) || 0) as Declarations[typeof field.key])}
              className="tabular w-32 bg-transparent px-2 py-1.5 text-right text-[13px] text-ink outline-none"
            />
          </div>
        );
    }
  };

  return (
    <div className="paper space-y-6 rounded-2xl border border-line bg-surface p-5 shadow-paper sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-[24px] leading-tight text-ink">Declarations</h2>
          <p className="mt-1 text-[13.5px] leading-relaxed text-muted">What the employee declared beyond the salary statement. The tax updates as you type.</p>
        </div>
        <button type="button" onClick={onReset} className="shrink-0 rounded-lg border border-line px-2.5 py-1.5 text-[12.5px] text-muted transition-colors hover:bg-surface-2 hover:text-ink">
          Reset
        </button>
      </div>
      {GROUPS.map(group => (
        <section key={group.id}>
          <h3 className="text-[11.5px] font-semibold uppercase tracking-[0.1em] text-muted">{group.title}</h3>
          {group.note && value.regime === 'new' && <p className="mt-1 text-[12.5px] text-accent-text">{`${group.note} The employee is on the new regime.`}</p>}
          <div className="mt-2 divide-y divide-line/70">
            {DECLARATION_FIELDS.filter(field => field.group === group.id).map(field => (
              <div key={field.key} className="flex items-center justify-between gap-4 py-2.5">
                <label htmlFor={`decl-${field.key}`} className="min-w-0 text-[13.5px] text-ink">
                  {short(field.label)}
                  <span className="mt-0.5 block text-[12px] leading-snug text-muted">{field.help}</span>
                </label>
                {control(field)}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
