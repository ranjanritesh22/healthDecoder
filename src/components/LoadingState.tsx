// src/components/LoadingState.tsx
// -----------------------------------------------------------------------------
// WHAT: The animation shown while the AI reads the report.
// WHY:  AI calls take a few seconds. A calm, premium loading state reassures the
//       user that work is happening and keeps the app feeling fast and trusted.
//       Pure CSS animation (no library) keeps the bundle light.
// -----------------------------------------------------------------------------

import type { Language } from '../types';
import { t } from '../lib/i18n';

interface Props {
  language: Language;
}

export default function LoadingState({ language }: Props) {
  const s = t(language);
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-16 text-center">
      {/* Pulsing concentric rings around a heartbeat mark. */}
      <div className="relative flex h-24 w-24 items-center justify-center">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-300 opacity-50" />
        <span className="absolute inline-flex h-16 w-16 animate-pulse rounded-full bg-brand-200" />
        <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-brand-700 text-white">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12h4l2-6 4 12 2-6h6" />
          </svg>
        </span>
      </div>
      <div className={language === 'hi' ? 'lang-hi' : ''}>
        <p className="text-lg font-semibold text-slate-800">{s.analyzing}</p>
        <p className="mt-1 max-w-xs text-sm text-slate-500">{s.analyzingHint}</p>
      </div>
    </div>
  );
}
