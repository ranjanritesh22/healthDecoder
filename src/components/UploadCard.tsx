// src/components/UploadCard.tsx
// -----------------------------------------------------------------------------
// WHAT: The upload surface — drag & drop OR tap-to-browse for a single PDF,
//       plus the "Generate" button. Validates type + size before accepting.
// WHY:  This is the core interaction. We validate on the client first (fast,
//       friendly errors) BEFORE spending an AI call. The parent owns the chosen
//       file and the submit action; this component is purely presentational +
//       validation, which keeps it reusable and easy to test.
// -----------------------------------------------------------------------------

import { useRef, useState } from 'react';
import type { Language } from '../types';
import { t } from '../lib/i18n';

/** Max file size mirrors the server limit (functions/api/analyze.ts). */
const MAX_BYTES = 15 * 1024 * 1024;

interface Props {
  language: Language;
  file: File | null;
  onFileChange: (file: File | null) => void;
  onSubmit: () => void;
}

export default function UploadCard({ language, file, onFileChange, onSubmit }: Props) {
  const s = t(language);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Validate a candidate file and either accept it or show an error. */
  function accept(candidate: File | undefined) {
    setError(null);
    if (!candidate) return;
    if (candidate.type !== 'application/pdf') {
      setError(s.wrongFileType);
      return;
    }
    if (candidate.size > MAX_BYTES) {
      setError(s.fileTooLarge);
      return;
    }
    onFileChange(candidate);
  }

  return (
    <div className="rounded-3xl bg-white/80 p-5 shadow-xl shadow-brand-900/5 ring-1 ring-slate-100 backdrop-blur sm:p-7">
      {!file ? (
        // ---- Empty state: the drop zone -------------------------------------
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            accept(e.dataTransfer.files?.[0]);
          }}
          className={[
            'flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors',
            dragOver ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-brand-300 hover:bg-slate-50',
          ].join(' ')}
        >
          {/* Upload icon (inline SVG = no extra requests, stays lightweight). */}
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-brand-700">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 16V4M5 11l7-7 7 7" />
              <path d="M4 20h16" />
            </svg>
          </span>
          <span className="text-base font-semibold text-slate-800">{s.uploadDrop}</span>
          <span className="text-sm text-slate-500">{s.uploadHint}</span>
        </button>
      ) : (
        // ---- Filled state: show the selected file ---------------------------
        <div className="flex items-center gap-3 rounded-2xl bg-brand-50 p-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-700 text-white">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-800">{file.name}</p>
            <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
          </div>
          <button
            type="button"
            onClick={() => {
              onFileChange(null);
              if (inputRef.current) inputRef.current.value = '';
            }}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-white hover:text-red-600"
          >
            {s.removeFile}
          </button>
        </div>
      )}

      {/* Hidden native input drives both tap-to-browse and accessibility. */}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => accept(e.target.files?.[0])}
      />

      {error && <p className="mt-3 text-center text-sm font-medium text-red-600">{error}</p>}

      <button
        type="button"
        disabled={!file}
        onClick={onSubmit}
        className="mt-5 w-full rounded-2xl bg-brand-700 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-700/20 transition-all hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
      >
        {s.generate}
      </button>
    </div>
  );
}
