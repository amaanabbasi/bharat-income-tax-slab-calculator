'use client';

import { type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { Icon, type IconName } from './icons';

export interface Suggestion {
  text: string;
  icon: IconName;
}

interface ComposerProps {
  inputRef: RefObject<HTMLTextAreaElement>;
  fileInputRef: RefObject<HTMLInputElement>;
  busy: boolean;
  hasData: boolean;
  /** Where suggestions open: below on the landing view, above once the composer sits at the bottom. */
  placement: 'below' | 'above';
  suggestions: Suggestion[];
  onSubmit: (text: string) => void;
  onFiles: (files: File[]) => void;
  onSkill: (skill: 'slips' | 'tax') => void;
}

export default function Composer({ inputRef, fileInputRef, busy, hasData, placement, suggestions, onSubmit, onFiles, onSkill }: ComposerProps) {
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const shown = useMemo(() => {
    const query = value.trim().toLowerCase();
    return query ? suggestions.filter(item => item.text.toLowerCase().includes(query)) : suggestions;
  }, [suggestions, value]);
  const panelOpen = open && !busy && shown.length > 0;

  useEffect(() => setActive(-1), [value, open]);

  useEffect(() => {
    if (!open)
      return;
    const close = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node))
        setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input)
      return;
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 200)}px`;
  }, [value, inputRef]);

  const submit = (text = value) => {
    const trimmed = text.trim();
    if (!trimmed || busy)
      return;
    onSubmit(trimmed);
    setValue('');
    setOpen(false);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (panelOpen && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive(index => (index + step + shown.length) % shown.length);
      return;
    }
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit(panelOpen && active >= 0 ? shown[active].text : value);
    }
  };

  const onPaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(event.clipboardData.files);
    if (files.length) {
      event.preventDefault();
      onFiles(files);
    }
  };

  const skill = (name: 'slips' | 'tax', icon: IconName, label: string) => (
    <button
      type="button"
      onClick={() => onSkill(name)}
      disabled={busy}
      title={hasData ? `Show ${label.toLowerCase()} for the loaded statement` : `Upload a statement to get ${label.toLowerCase()}`}
      className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-[13px] text-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-50"
    >
      <Icon name={icon} className="size-3.5" />
      {label}
    </button>
  );

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="rounded-[22px] border border-line bg-surface shadow-composer transition-colors focus-within:border-muted/40">
        <textarea
          ref={inputRef}
          rows={1}
          value={value}
          onChange={event => setValue(event.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onFocus={() => setOpen(true)}
          placeholder={hasData ? 'Ask for a pay slip, the tax, a comparison… or add another file' : 'Upload a salary statement, or type “sample” to try one'}
          aria-label="Message"
          role="combobox"
          aria-expanded={panelOpen}
          aria-controls="desk-suggestions"
          aria-autocomplete="list"
          aria-activedescendant={panelOpen && active >= 0 ? `desk-suggestion-${active}` : undefined}
          className="block max-h-[200px] w-full resize-none bg-transparent px-5 pt-4 text-[16px] leading-6 text-ink outline-none placeholder:text-muted focus-visible:outline-none"
        />
        <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
              aria-label="Upload .xlsx"
              className="inline-flex items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-1.5 text-[13px] font-medium text-ink transition-colors hover:bg-line disabled:opacity-50"
            >
              <Icon name="paperclip" className="size-3.5" />
              <span className="hidden sm:inline">Upload .xlsx</span>
            </button>
            {skill('slips', 'receipt', 'Salary slips')}
            {skill('tax', 'calculator', 'Income tax')}
          </div>
          <button
            type="button"
            onClick={() => submit()}
            disabled={busy || !value.trim()}
            aria-label="Send"
            className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-accent-ink transition-all hover:brightness-110 active:scale-95 disabled:cursor-default disabled:bg-surface-2 disabled:text-muted disabled:hover:brightness-100 disabled:active:scale-100"
          >
            <Icon name="arrowUp" className="size-[18px]" strokeWidth={2.5} />
          </button>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = '';
          if (files.length)
            onFiles(files);
        }}
      />

      {panelOpen && (
        <div className={`absolute inset-x-0 z-30 animate-rise overflow-hidden rounded-2xl border border-line bg-surface shadow-composer ${placement === 'below' ? 'top-full mt-2' : 'bottom-full mb-2'}`}>
          <p className="flex items-center gap-1.5 px-4 pb-1 pt-3 text-[13px] text-muted">
            <Icon name="zap" className="size-3.5" />
            Suggestions
          </p>
          <ul id="desk-suggestions" role="listbox" aria-label="Suggestions" className="p-1.5">
            {shown.map((item, index) => (
              <li
                key={item.text}
                id={`desk-suggestion-${index}`}
                role="option"
                aria-selected={index === active}
                onMouseEnter={() => setActive(index)}
                onMouseDown={event => event.preventDefault()}
                onClick={() => submit(item.text)}
                className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition-colors ${index === active ? 'bg-surface-2 text-ink' : 'text-ink/85'}`}
              >
                <Icon name={item.icon} className="size-4 shrink-0 text-muted" />
                {item.text}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
