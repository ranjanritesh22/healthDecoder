// src/components/ReportView.tsx
// -----------------------------------------------------------------------------
// WHAT: Renders a complete, beautiful, printable HEALTH REPORT from a
//       MedicalReport object. This same DOM is what src/lib/pdf.ts screenshots
//       into the downloadable PDF — so this component is BOTH the on-screen
//       result AND the PDF template (one source of truth).
// WHY:  A single template keeps screen + PDF perfectly in sync and easy to edit.
//       It is built to be readable by ANYONE — clear sections, color-coded
//       statuses, large friendly type — matching the product goal of helping
//       even low-literacy patients understand their health.
//
// HOW PDF CAPTURE WORKS: App passes a `ref` to the outer <div>. The PDF helper
//       rasterizes that node. Everything visible here ends up in the PDF, so keep
//       it self-contained (no external/lazy images that might not be loaded yet).
// -----------------------------------------------------------------------------

import { forwardRef } from 'react';
import type { Finding, FindingStatus, MedicalReport } from '../types';
import { t } from '../lib/i18n';

interface Props {
  report: MedicalReport;
}

/** Maps a finding status to its display color + label. Central so it's consistent. */
function statusStyle(status: FindingStatus, lang: MedicalReport['language']) {
  const s = t(lang);
  switch (status) {
    case 'normal':
      return { color: 'text-status-normal', bg: 'bg-green-50', dot: 'bg-status-normal', label: s.statusNormal };
    case 'high':
      return { color: 'text-status-high', bg: 'bg-red-50', dot: 'bg-status-high', label: s.statusHigh };
    case 'low':
      return { color: 'text-status-low', bg: 'bg-blue-50', dot: 'bg-status-low', label: s.statusLow };
    case 'watch':
    default:
      return { color: 'text-status-watch', bg: 'bg-amber-50', dot: 'bg-status-watch', label: s.statusWatch };
  }
}

/** The colored banner summarizing overall status. */
function StatusBanner({ report }: { report: MedicalReport }) {
  const s = t(report.language);
  const map = {
    good: { bg: 'bg-green-50', ring: 'ring-green-200', text: 'text-green-800', msg: s.bannerGood },
    attention: { bg: 'bg-amber-50', ring: 'ring-amber-200', text: 'text-amber-800', msg: s.bannerAttention },
    'see-doctor': { bg: 'bg-red-50', ring: 'ring-red-200', text: 'text-red-800', msg: s.bannerSeeDoctor },
  }[report.overallStatus];

  return (
    <div className={`rounded-2xl ${map.bg} px-5 py-4 ring-1 ${map.ring}`}>
      <p className={`text-sm font-semibold ${map.text}`}>{map.msg}</p>
    </div>
  );
}

/** A titled section wrapper with consistent spacing + heading style. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-800">
        <span className="h-4 w-1.5 rounded-full bg-brand-600" />
        {title}
      </h3>
      {children}
    </section>
  );
}

/** A single finding row used in the findings table. */
function FindingRow({ f, lang }: { f: Finding; lang: MedicalReport['language'] }) {
  const st = statusStyle(f.status, lang);
  return (
    <div className={`rounded-xl ${st.bg} p-4`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="font-semibold text-slate-800">{f.parameter}</span>
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <span className={`inline-block h-2 w-2 rounded-full ${st.dot}`} />
          <span className={st.color}>{st.label}</span>
        </span>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-4 text-sm text-slate-600">
        <span>
          <strong className="text-slate-800">{f.value}</strong> {f.unit}
        </span>
        {f.referenceRange && <span className="text-slate-400">({f.referenceRange})</span>}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-slate-700">{f.explanation}</p>
    </div>
  );
}

/** Renders a bullet list, or nothing if empty. */
function BulletList({ items, accent }: { items: string[]; accent: string }) {
  if (items.length === 0) return null;
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-slate-700">
          <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${accent}`} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

// `forwardRef` lets the parent (App) hand this node to the PDF helper.
const ReportView = forwardRef<HTMLDivElement, Props>(({ report }, ref) => {
  const s = t(report.language);
  const { patient } = report;

  return (
    <div
      ref={ref}
      // `lang-hi` swaps to the Devanagari font for correct Hindi shaping (screen + PDF).
      className={`mx-auto w-full max-w-3xl bg-white p-6 sm:p-9 ${report.language === 'hi' ? 'lang-hi' : ''}`}
    >
      {/* ---- Header / branding ------------------------------------------- */}
      <header className="flex items-center justify-between border-b border-slate-100 pb-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-700 text-white">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12h4l2-6 4 12 2-6h6" />
            </svg>
          </span>
          <div className="leading-tight">
            <p className="text-sm font-bold text-slate-800">HealthDecode</p>
            <p className="text-xs text-slate-400">{s.yourReport}</p>
          </div>
        </div>
        {patient.reportDate && <p className="text-xs text-slate-400">{patient.reportDate}</p>}
      </header>

      {/* ---- Patient info (only render fields that exist) ----------------- */}
      {(patient.name || patient.age || patient.sex || patient.referredBy) && (
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
          {patient.name && <span><span className="text-slate-400">Name:</span> <strong className="text-slate-800">{patient.name}</strong></span>}
          {patient.age && <span><span className="text-slate-400">Age:</span> <strong className="text-slate-800">{patient.age}</strong></span>}
          {patient.sex && <span><span className="text-slate-400">Sex:</span> <strong className="text-slate-800">{patient.sex}</strong></span>}
          {patient.referredBy && <span><span className="text-slate-400">Lab:</span> <strong className="text-slate-800">{patient.referredBy}</strong></span>}
        </div>
      )}

      {/* ---- Overall summary + status banner ----------------------------- */}
      <Section title={s.overallSummary}>
        <StatusBanner report={report} />
        {report.overallSummary && (
          <p className="mt-3 text-sm leading-relaxed text-slate-700">{report.overallSummary}</p>
        )}
      </Section>

      {/* ---- Important findings (highlighted first) ---------------------- */}
      {report.importantFindings.length > 0 && (
        <Section title={s.importantFindings}>
          <div className="space-y-2.5">
            {report.importantFindings.map((f, i) => (
              <FindingRow key={i} f={f} lang={report.language} />
            ))}
          </div>
        </Section>
      )}

      {/* ---- Every parameter explained ----------------------------------- */}
      {report.allFindings.length > 0 && (
        <Section title={s.allParameters}>
          <div className="space-y-2.5">
            {report.allFindings.map((f, i) => (
              <FindingRow key={i} f={f} lang={report.language} />
            ))}
          </div>
        </Section>
      )}

      {/* ---- Food recommendations + foods to limit (two columns on wide) -- */}
      <div className="grid gap-x-8 sm:grid-cols-2">
        <Section title={s.foodRecommendations}>
          <BulletList items={report.foodRecommendations} accent="bg-status-normal" />
        </Section>
        <Section title={s.foodsToLimit}>
          <BulletList items={report.foodsToLimit} accent="bg-status-high" />
        </Section>
      </div>

      {/* ---- Lifestyle suggestions --------------------------------------- */}
      <Section title={s.lifestyle}>
        <BulletList items={report.lifestyleSuggestions} accent="bg-brand-500" />
      </Section>

      {/* ---- Questions to ask the doctor --------------------------------- */}
      <Section title={s.questionsForDoctor}>
        <BulletList items={report.questionsForDoctor} accent="bg-status-low" />
      </Section>

      {/* ---- When to see a doctor ---------------------------------------- */}
      {report.whenToSeeDoctor && (
        <Section title={s.whenToSeeDoctor}>
          <div className="rounded-xl bg-brand-50 p-4 text-sm leading-relaxed text-slate-700 ring-1 ring-brand-100">
            {report.whenToSeeDoctor}
          </div>
        </Section>
      )}

      {/* ---- Disclaimer (always shown) ----------------------------------- */}
      <div className="mt-8 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100">
        <p className="text-xs font-semibold text-slate-500">{s.disclaimer}</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">{report.disclaimer}</p>
      </div>

      <p className="mt-5 text-center text-[11px] text-slate-300">
        Generated by HealthDecode · healthdecode.frontendrealm.com
      </p>
    </div>
  );
});

ReportView.displayName = 'ReportView';
export default ReportView;
