// types.ts
// -----------------------------------------------------------------------------
// WHAT: The single source of truth for the shape of an interpreted report.
// WHY:  Three different layers must agree on this shape:
//         1. The Cloudflare Function asks the AI to return JSON in EXACTLY this
//            shape (the JSON schema in functions/api/_schema.ts mirrors it).
//         2. The frontend API client (src/lib/analyze.ts) types the response.
//         3. The report UI / PDF (src/components/ReportView.tsx) renders it.
//       Keeping it here means a change to the report's contents is a single,
//       traceable edit — change this type and TypeScript shows you every place
//       that must be updated.
// -----------------------------------------------------------------------------

/** The two languages the app supports. Used for UI and for the AI output. */
export type Language = 'en' | 'hi';

/**
 * Status of a single lab parameter relative to its reference range.
 * 'normal' = within range, 'high'/'low' = out of range, 'watch' = borderline or
 * needs attention but not clearly abnormal. We keep this small + fixed so the UI
 * can map each value to a color and icon reliably.
 */
export type FindingStatus = 'normal' | 'high' | 'low' | 'watch';

/** One lab value, interpreted in plain language. */
export interface Finding {
  /** e.g. "Hemoglobin", "Fasting Blood Sugar". */
  parameter: string;
  /** The measured value as printed on the report, e.g. "10.2". */
  value: string;
  /** Unit, e.g. "g/dL". May be empty if not present on the report. */
  unit: string;
  /** Normal reference range as printed/known, e.g. "13.0 – 17.0". */
  referenceRange: string;
  /** Classification used for color-coding. See FindingStatus. */
  status: FindingStatus;
  /** Plain-language meaning of THIS value for THIS person. 1–3 sentences. */
  explanation: string;
}

/** Patient identity block — every field optional (reports vary widely). */
export interface PatientInfo {
  name?: string;
  age?: string;
  sex?: string;
  /** Date printed on the report, kept as a string (formats vary by lab). */
  reportDate?: string;
  /** Lab / hospital name if present. */
  referredBy?: string;
}

/**
 * The complete interpreted report. This is what the AI returns and what we
 * render + turn into a PDF. Arrays are always present (possibly empty) so the
 * UI never has to null-check.
 */
export interface MedicalReport {
  /** Output language — echoes the user's choice; used to set the PDF font. */
  language: Language;
  patient: PatientInfo;
  /** 2–4 sentence overall picture in reassuring, plain language. */
  overallSummary: string;
  /**
   * Coarse overall signal so the UI can show one calm banner.
   * 'good' = mostly normal, 'attention' = some values need lifestyle action,
   * 'see-doctor' = at least one finding warrants professional review soon.
   */
  overallStatus: 'good' | 'attention' | 'see-doctor';
  /** The most important out-of-range / noteworthy findings, highlighted first. */
  importantFindings: Finding[];
  /** Every extracted parameter, explained. Superset of importantFindings. */
  allFindings: Finding[];
  /** Foods that help, given this report. Short, concrete, everyday items. */
  foodRecommendations: string[];
  /** Foods/drinks to limit, given this report. */
  foodsToLimit: string[];
  /** General lifestyle suggestions (sleep, activity, hydration, etc.). */
  lifestyleSuggestions: string[];
  /** Specific questions the user can ask their doctor. */
  questionsForDoctor: string[];
  /** Plain guidance on whether/when to consult a professional. */
  whenToSeeDoctor: string;
  /** Safety disclaimer text (localized). Always shown, never diagnostic. */
  disclaimer: string;
}

/** Request body sent from the browser to our Cloudflare Function. */
export interface AnalyzeRequest {
  /** The uploaded PDF, base64-encoded (no data: prefix). */
  pdfBase64: string;
  /** Desired output language. */
  language: Language;
}

/** Successful Function response. */
export interface AnalyzeSuccess {
  ok: true;
  report: MedicalReport;
}

/** Failed Function response — `error` is a user-safe, localized-ish message. */
export interface AnalyzeError {
  ok: false;
  error: string;
}

export type AnalyzeResponse = AnalyzeSuccess | AnalyzeError;
