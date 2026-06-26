// src/lib/analyze.ts
// -----------------------------------------------------------------------------
// WHAT: The browser-side client that talks to our Cloudflare Function.
// WHY:  Components should not know about fetch/base64 details. They call
//       `analyzeReport(file, language)` and get back a typed report (or throw).
//       This isolation means if the backend contract changes, only this file
//       changes — not every component.
// -----------------------------------------------------------------------------

import type { AnalyzeResponse, Language, MedicalReport } from '../types';

/**
 * Convert a File (the uploaded PDF) into a base64 string WITHOUT the
 * "data:application/pdf;base64," prefix (the Function expects raw base64).
 * We use FileReader because it streams efficiently and works on all browsers.
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string; // "data:...;base64,XXXX"
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Upload the PDF to the AI and return the interpreted report.
 * @throws Error with a user-friendly message if anything fails.
 */
export async function analyzeReport(file: File, language: Language): Promise<MedicalReport> {
  const pdfBase64 = await fileToBase64(file);

  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pdfBase64, language }),
  });

  // The Function always returns JSON (even on error). Parse defensively.
  let data: AnalyzeResponse;
  try {
    data = (await res.json()) as AnalyzeResponse;
  } catch {
    throw new Error('The server returned an unexpected response. Please try again.');
  }

  if (!data.ok) throw new Error(data.error);
  return data.report;
}
