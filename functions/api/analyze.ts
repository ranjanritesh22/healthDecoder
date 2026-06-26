// functions/api/analyze.ts
// -----------------------------------------------------------------------------
// WHAT: The Cloudflare Pages Function that the browser calls at POST /api/analyze.
//       It receives the uploaded PDF (base64) + language, calls the active AI
//       provider, validates the result, and returns a typed MedicalReport.
// WHY:  This runs on Cloudflare's server (the Workers runtime), NOT in the
//       browser. That is the whole point: the AI API key lives here as a secret
//       env var and is NEVER shipped to users. The frontend only ever talks to
//       this endpoint, so the key cannot leak via dev tools.
//
// HOW CLOUDFLARE FINDS THIS: Pages Functions are file-routed. A file at
//       functions/api/analyze.ts automatically becomes the route /api/analyze.
//       Exporting `onRequestPost` makes it respond to POST requests only.
// -----------------------------------------------------------------------------

import type { AnalyzeRequest, AnalyzeResponse, MedicalReport } from '../../src/types';
import { getProvider, type Env } from './_providers';

/** Max upload size. Keeps the app lightweight and within free-tier inline limits. */
const MAX_PDF_BYTES = 15 * 1024 * 1024; // 15 MB

/** Cloudflare passes this context object to every Function. */
interface PagesContext {
  request: Request;
  env: Env;
}

/** Handle POST /api/analyze. */
export const onRequestPost = async (ctx: PagesContext): Promise<Response> => {
  try {
    // 1) Parse + validate the incoming JSON body.
    const body = (await ctx.request.json()) as Partial<AnalyzeRequest>;
    const pdfBase64 = body.pdfBase64;
    const language = body.language === 'hi' ? 'hi' : 'en';

    if (!pdfBase64 || typeof pdfBase64 !== 'string') {
      return json({ ok: false, error: 'No PDF was provided.' }, 400);
    }

    // base64 inflates size by ~4/3; check the DECODED size against our limit.
    const approxBytes = Math.floor((pdfBase64.length * 3) / 4);
    if (approxBytes > MAX_PDF_BYTES) {
      return json({ ok: false, error: 'PDF is too large (max 15 MB).' }, 413);
    }

    // 2) Ask the configured AI provider to interpret the report.
    const provider = getProvider(ctx.env);
    const rawJson = await provider.analyze(pdfBase64, language, ctx.env);

    // 3) Parse + lightly validate the model output, then attach the language.
    const report = normalizeReport(rawJson, language);

    return json({ ok: true, report });
  } catch (err) {
    // Never leak internals to the browser; log server-side, return a safe message.
    console.error('[analyze] failed:', err);
    const message = err instanceof Error ? err.message : 'Unexpected error.';
    return json({ ok: false, error: message }, 500);
  }
};

/**
 * Turn the model's raw JSON string into a safe MedicalReport.
 * Guarantees every array exists so the UI never has to null-check. If the model
 * wrapped JSON in markdown fences (rare with structured output), we strip them.
 */
function normalizeReport(rawJson: string, language: 'en' | 'hi'): MedicalReport {
  const cleaned = rawJson
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();

  let parsed: Partial<MedicalReport>;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('The AI response was not valid JSON. Please try again.');
  }

  // Defensive defaults — a partial response should degrade gracefully, not crash.
  return {
    language,
    patient: parsed.patient ?? {},
    overallSummary: parsed.overallSummary ?? '',
    overallStatus: parsed.overallStatus ?? 'attention',
    importantFindings: parsed.importantFindings ?? [],
    allFindings: parsed.allFindings ?? [],
    foodRecommendations: parsed.foodRecommendations ?? [],
    foodsToLimit: parsed.foodsToLimit ?? [],
    lifestyleSuggestions: parsed.lifestyleSuggestions ?? [],
    questionsForDoctor: parsed.questionsForDoctor ?? [],
    whenToSeeDoctor: parsed.whenToSeeDoctor ?? '',
    disclaimer:
      parsed.disclaimer ??
      'This report is general information only and is not a medical diagnosis. Please consult a qualified doctor.',
  };
}

/** Small helper to return a JSON response with the right headers + status. */
function json(payload: AnalyzeResponse, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
