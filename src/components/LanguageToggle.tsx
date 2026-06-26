// src/components/LanguageToggle.tsx
// -----------------------------------------------------------------------------
// WHAT: A two-option segmented control to pick English or Hindi.
// WHY:  Language is the user's first decision and affects the AI output, so it
//       deserves a clear, tappable control. Kept as a "controlled component":
//       the parent owns the `value` and gets changes via `onChange`. This makes
//       the selected language a single source of truth in App.
// -----------------------------------------------------------------------------

import type { Language } from '../types';
import { t } from '../lib/i18n';

interface Props {
  value: Language;
  onChange: (lang: Language) => void;
}

export default function LanguageToggle({ value, onChange }: Props) {
  const s = t(value);

  // Small helper so both buttons share identical styling logic.
  const btn = (lang: Language, label: string) => {
    const active = value === lang;
    return (
      <button
        type="button"
        onClick={() => onChange(lang)}
        aria-pressed={active}
        className={[
          'flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all',
          active
            ? 'bg-brand-700 text-white shadow-sm'
            : 'bg-white text-slate-600 hover:bg-slate-50',
        ].join(' ')}
      >
        {label}
      </button>
    );
  };

  return (
    <div>
      <p className="mb-2 text-center text-sm font-medium text-slate-500">{s.chooseLanguage}</p>
      <div className="flex gap-2 rounded-2xl bg-slate-100 p-1.5">
        {btn('en', s.english)}
        {btn('hi', s.hindi)}
      </div>
    </div>
  );
}
