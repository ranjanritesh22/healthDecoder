// functions/api/_providers.ts
// -----------------------------------------------------------------------------
// WHAT: A tiny provider abstraction. Each AI provider implements ONE function:
//         analyze(pdfBase64, language) -> raw JSON string of a MedicalReport.
// WHY:  This is the "swap providers with one env var" design the README talks
//       about. The rest of the app does not know or care which AI is used.
//       To switch from free Gemini to paid Anthropic Claude, you change the
//       AI_PROVIDER env var — no code change. To ADD a new provider (e.g. OpenAI)
//       you add one object here that matches the `AIProvider` interface. That's it.
// -----------------------------------------------------------------------------

import type { Language } from '../../src/types';
import { buildPrompt } from './_prompt';
import { reportSchema } from './_schema';

/** Environment variables available to the Function (set in Cloudflare/.dev.vars). */
export interface Env {
  AI_PROVIDER?: string; // "gemini" | "anthropic"
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL?: string;
}

/** Every provider implements this one method. Keep the surface minimal. */
export interface AIProvider {
  /**
   * Send the PDF + instructions to the AI and return the RAW JSON text of a
   * MedicalReport (still a string; the caller parses + validates it).
   * Throw an Error with a readable message on any failure.
   */
  analyze(pdfBase64: string, language: Language, env: Env): Promise<string>;
}

// -----------------------------------------------------------------------------
// Provider 1: Google Gemini (free tier). Reads PDFs (incl. scanned) natively.
// Docs: https://ai.google.dev/gemini-api/docs/document-processing
// -----------------------------------------------------------------------------
const gemini: AIProvider = {
  async analyze(pdfBase64, language, env) {
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('Server is missing GEMINI_API_KEY.');
    const model = env.GEMINI_MODEL || 'gemini-2.5-flash';

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    // Gemini request: the PDF goes in as inline_data; the prompt as text.
    // responseMimeType + responseSchema force clean JSON back (structured output).
    const body = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: buildPrompt(language) },
            { inline_data: { mime_type: 'application/pdf', data: pdfBase64 } },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2, // low = consistent, faithful extraction (not creative)
        responseMimeType: 'application/json',
        responseSchema: reportSchema,
      },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const detail = await safeText(res);
      throw new Error(`Gemini API error (${res.status}): ${detail}`);
    }

    const data = (await res.json()) as GeminiResponse;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Gemini returned an empty response.');
    return text;
  },
};

// -----------------------------------------------------------------------------
// Provider 2: Anthropic Claude (paid, highest quality). Reads PDFs natively too.
// Docs: https://docs.anthropic.com/en/docs/build-with-claude/pdf-support
// We use a "tool" with an input_schema to get guaranteed-structured JSON back.
// -----------------------------------------------------------------------------
const anthropic: AIProvider = {
  async analyze(pdfBase64, language, env) {
    const apiKey = env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('Server is missing ANTHROPIC_API_KEY.');
    const model = env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

    // Trick for structured output on Anthropic: define a tool whose input_schema
    // is our report schema and force the model to call it. The tool input IS our
    // JSON. This is the documented way to get reliable structured data.
    const body = {
      model,
      max_tokens: 8000,
      temperature: 0.2,
      tools: [
        {
          name: 'return_report',
          description: 'Return the interpreted medical report as structured data.',
          input_schema: reportSchema,
        },
      ],
      tool_choice: { type: 'tool', name: 'return_report' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: buildPrompt(language) },
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
            },
          ],
        },
      ],
    };

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const detail = await safeText(res);
      throw new Error(`Anthropic API error (${res.status}): ${detail}`);
    }

    const data = (await res.json()) as AnthropicResponse;
    // Find the tool_use block; its `input` is our structured report object.
    const toolUse = data.content?.find((b) => b.type === 'tool_use');
    if (!toolUse?.input) throw new Error('Anthropic returned no structured output.');
    return JSON.stringify(toolUse.input);
  },
};

/** Registry of available providers, keyed by the AI_PROVIDER env value. */
const providers: Record<string, AIProvider> = { gemini, anthropic };

/**
 * Pick the active provider based on env. Defaults to Gemini (free tier).
 * Throws a clear error if an unknown provider name is configured.
 */
export function getProvider(env: Env): AIProvider {
  const name = (env.AI_PROVIDER || 'gemini').toLowerCase();
  const provider = providers[name];
  if (!provider) {
    throw new Error(`Unknown AI_PROVIDER "${name}". Use "gemini" or "anthropic".`);
  }
  return provider;
}

// --- helpers + minimal response typings -------------------------------------

/** Read a response body as text without throwing (used for error details). */
async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return '(no details)';
  }
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}

interface AnthropicResponse {
  content?: Array<{ type: string; input?: unknown }>;
}
