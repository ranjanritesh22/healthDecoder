// src/App.tsx
// -----------------------------------------------------------------------------
// WHAT: The root component. It is a small STATE MACHINE driving the whole flow:
//         'upload'  -> choose language + pick PDF
//         'loading' -> AI is analyzing
//         'result'  -> show report + download PDF
//       Errors are held alongside and shown inline.
// WHY:  A single-page app with no routing/auth/history is the product spec
//       ("Simple. Fast. Trustworthy."). Modeling the flow as one explicit
//       `phase` value (instead of scattered booleans) makes the UI predictable
//       and easy to extend — to add a step, add a phase.
// -----------------------------------------------------------------------------

import { useRef, useState } from 'react';
import type { Language, MedicalReport } from './types';
import { t } from './lib/i18n';
import { analyzeReport } from './lib/analyze';
import LanguageToggle from './components/LanguageToggle';
import UploadCard from './components/UploadCard';
import LoadingState from './components/LoadingState';
import ReportView from './components/ReportView';

type Phase = 'upload' | 'loading' | 'result';

export default function App() {
  // --- Core state ----------------------------------------------------------
  const [phase, setPhase] = useState<Phase>('upload');
  const [language, setLanguage] = useState<Language>('en');
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<MedicalReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  // Ref to the rendered report DOM, handed to the PDF helper for capture.
  const reportRef = useRef<HTMLDivElement>(null);

  const s = t(language);

  /** Kick off analysis: upload -> loading -> result (or back to upload on error). */
  async function handleGenerate() {
    if (!file) return;
    setError(null);
    setPhase('loading');
    try {
      const result = await analyzeReport(file, language);
      setReport(result);
      setPhase('result');
    } catch (err) {
      // Show the real error if we have one, else a friendly fallback.
      setError(err instanceof Error ? err.message : s.genericError);
      setPhase('upload');
    }
  }

  /** Generate + download the PDF of the currently shown report. */
  async function handleDownload() {
    if (!reportRef.current || !report) return;
    setDownloading(true);
    try {
      // Lazy-load the heavy PDF libraries (jsPDF + html2canvas) ONLY when the
      // user actually downloads. This keeps the initial page load lightweight —
      // most of the bundle weight lives behind this dynamic import.
      const { downloadReportPdf } = await import('./lib/pdf');
      const name = report.patient.name
        ? `HealthDecode-${report.patient.name.replace(/\s+/g, '-')}`
        : 'HealthDecode-Report';
      await downloadReportPdf(reportRef.current, name);
    } catch (err) {
      setError(err instanceof Error ? err.message : s.genericError);
    } finally {
      setDownloading(false);
    }
  }

  /** Reset everything back to the start. */
  function handleReset() {
    setReport(null);
    setFile(null);
    setError(null);
    setPhase('upload');
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-6 sm:py-10">
      {/* ---- App header --------------------------------------------------- */}
      <header className="mb-8 text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-1.5 text-sm font-semibold text-brand-700 ring-1 ring-brand-100">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-700 text-white">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12h4l2-6 4 12 2-6h6" />
            </svg>
          </span>
          {s.appName}
        </div>
        <p className={`text-sm text-slate-500 ${language === 'hi' ? 'lang-hi' : ''}`}>{s.tagline}</p>
      </header>

      {/* ---- Main content (switches on phase) ----------------------------- */}
      <main className="flex-1">
        {phase === 'upload' && (
          <div className={`space-y-6 ${language === 'hi' ? 'lang-hi' : ''}`}>
            <div className="text-center">
              <h1 className="text-2xl font-bold leading-tight text-slate-900 sm:text-3xl">{s.heroTitle}</h1>
              <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{s.heroSubtitle}</p>
            </div>

            <LanguageToggle value={language} onChange={setLanguage} />
            <UploadCard language={language} file={file} onFileChange={setFile} onSubmit={handleGenerate} />

            {error && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-center text-sm font-medium text-red-700 ring-1 ring-red-100">
                {error}
              </p>
            )}
          </div>
        )}

        {phase === 'loading' && <LoadingState language={language} />}

        {phase === 'result' && report && (
          <div className="space-y-5">
            {/* Action bar (NOT part of the PDF capture target). */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleReset}
                className="rounded-xl px-3 py-2 text-sm font-medium text-slate-500 hover:bg-white hover:text-slate-800"
              >
                ← {s.startOver}
              </button>
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-700/20 hover:bg-brand-800 disabled:opacity-60"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
                </svg>
                {downloading ? s.preparingPdf : s.downloadPdf}
              </button>
            </div>

            {/* The report itself — also the PDF capture target via reportRef. */}
            <div className="overflow-hidden rounded-3xl shadow-xl shadow-brand-900/5 ring-1 ring-slate-100">
              <ReportView ref={reportRef} report={report} />
            </div>
          </div>
        )}
      </main>

      {/* ---- Footer disclaimer (always visible, builds trust) ------------- */}
      <footer className="mt-10 text-center">
        <p className={`mx-auto max-w-md text-xs leading-relaxed text-slate-400 ${language === 'hi' ? 'lang-hi' : ''}`}>
          {s.footerDisclaimer}
        </p>
      </footer>
    </div>
  );
}
