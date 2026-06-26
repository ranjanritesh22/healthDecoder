# HealthDecode — The Ultimate Developer Guide

> **What this app does:** A user uploads a medical report PDF, picks a language
> (English / हिन्दी), and gets back a clean, plain-language explanation of every
> value — viewable on screen and downloadable as a polished PDF.
> No accounts, no database, no history. **Simple. Fast. Trustworthy.**

This README is written so that **anyone can rebuild this app from scratch** — and,
more importantly, so that anyone who has *never integrated AI into an app before*
can learn exactly how it is done here: how we call an AI model, how we make it
read a PDF, how we force it to return clean data, how we turn that data into a
beautiful PDF, and how we deploy the whole thing for free.

It is intentionally long. Read it top-to-bottom once and you will understand
every file and every function in the project.

---

## Table of contents

### Part A — Concepts
*Read this if AI / serverless is new to you.*

- **1.** [The big picture in plain words](#big-picture)
- **2.** [Key concepts & vocabulary (AI wrapper, serverless, base64, …)](#vocabulary)

### Part B — The app, end to end

- **3.** [The complete request flow (click-by-click, function-by-function)](#flow)
- **4.** [Tech stack & why each piece exists](#tech-stack)
- **5.** [Project structure — every file explained](#project-structure)

### Part C — The two hard parts, explained slowly

- **6.** [AI integration deep dive (how we talk to Gemini & Claude)](#ai-integration)
- **7.** [PDF generation deep dive (how the download is built)](#pdf-deep-dive)

### Part D — Reference

- **8.** [Function-by-function reference (every function in the codebase)](#function-reference)
- **9.** [Swapping / adding AI providers](#swapping-providers)
- **10.** [Running locally (Wrangler explained)](#running-locally)
- **11.** [Deploying to Cloudflare Pages + custom domain](#deploying)
- **12.** [How to add a new feature (worked examples)](#extending)
- **13.** [Design system & conventions](#design-system)
- **14.** [Safety & medical disclaimer policy](#safety)
- **15.** [Troubleshooting](#troubleshooting)
- **16.** [Glossary (quick definitions)](#glossary)

---

<a name="big-picture"></a>
## 1. The big picture in plain words

HealthDecode is an **"AI wrapper"**. That phrase just means: *most of the hard
thinking is done by an AI model that someone else built and hosts (Google's
Gemini or Anthropic's Claude). Our app's job is to wrap a nice, safe, useful
experience around that model.*

Concretely, our app does only four things:

1. **Collect input** — let the user pick a language and upload a PDF.
2. **Send it to an AI** — over the internet, with careful instructions.
3. **Receive structured data back** — a predictable JSON object.
4. **Present it beautifully** — on screen, and as a downloadable PDF.

That's the entire app. There is no database, no login, nothing stored. Every
report is generated fresh and forgotten.

**The one rule that shapes the whole architecture:** the AI provider charges
money per request and authenticates with a **secret API key**. If we put that key
in the browser, anyone could open dev-tools, steal it, and run up our bill. So
the key must live on a **server** that we control. That is why this app is not
"just React" — it has a tiny server piece (a Cloudflare *Pages Function*) whose
only job is to hold the key and forward the request to the AI.

```
  Browser (anyone can see this code)        Our server (key hidden here)        The AI
  ──────────────────────────────────        ───────────────────────────        ──────
  React app  ──── /api/analyze ────►  Cloudflare Function (has the key) ──►  Gemini/Claude
             ◄──── JSON report ─────                                    ◄──
```

---

<a name="vocabulary"></a>
## 2. Key concepts & vocabulary

If these are familiar, skip to [the flow](#flow). If not, this section makes the
rest of the guide click.

| Term | Plain-English meaning | Where it shows up here |
| --- | --- | --- |
| **API** | A web address you send data to and get data back from. | We call the Gemini/Anthropic API; the browser calls *our* API at `/api/analyze`. |
| **API key** | A secret password that proves *you* are allowed to use a paid API. | `GEMINI_API_KEY` / `ANTHROPIC_API_KEY`. Must never reach the browser. |
| **Serverless function** | A small piece of backend code that runs on demand in the cloud — you don't manage a server, the platform runs it when a request comes in. | `functions/api/analyze.ts` on Cloudflare. |
| **Cloudflare Pages** | A free service that hosts static websites **and** can run serverless functions next to them. | Our host. |
| **AI wrapper** | An app whose core value comes from calling an AI model with a good prompt + a nice UI. | This whole project. |
| **Multimodal model** | An AI that accepts more than just text — e.g. images or PDFs as input. | Both Gemini & Claude read the PDF *directly*. |
| **Prompt** | The written instructions you give the AI. | `functions/api/_prompt.ts`. |
| **Structured output / JSON schema** | Telling the AI "don't write prose, return data in *exactly* this shape." | `functions/api/_schema.ts`. |
| **base64** | A way to turn a binary file (like a PDF) into plain text so it can travel inside a JSON request. | We base64-encode the PDF before sending it. |
| **OCR** | "Optical Character Recognition" — reading text out of a scanned image. | We need **none** — the AI does it for us. |
| **SPA** | "Single-Page App" — one HTML page where JavaScript swaps the content. No page reloads. | The React frontend. |
| **State machine** | Code that is always in exactly one named "state" and moves between them on events. | `App.tsx` flips between `upload → loading → result`. |

---

<a name="flow"></a>
## 3. The complete request flow (click-by-click, function-by-function)

This is the most important section. Follow one report from the first click to the
downloaded PDF. Every numbered step names the **file and function** doing the work
so you can open it and read along.

```
USER ACTION                     CODE THAT RUNS                                    FILE
───────────                     ──────────────                                    ────
Opens the site            →     main.tsx mounts <App/>                            src/main.tsx
Sees the upload screen     →     App renders phase='upload'                        src/App.tsx
Taps "English / हिन्दी"     →     LanguageToggle onChange → setLanguage()           src/components/LanguageToggle.tsx
Drops/selects a PDF        →     UploadCard.accept() validates type+size           src/components/UploadCard.tsx
Clicks "Generate"          →     App.handleGenerate()  → phase='loading'           src/App.tsx
                                  └─ analyzeReport(file, language)                  src/lib/analyze.ts
                                      ├─ fileToBase64(file)   (PDF → text)          src/lib/analyze.ts
                                      └─ fetch POST /api/analyze                    (network)
─────────────────────────────────  crosses to the server  ──────────────────────────────────
Server receives the call   →     onRequestPost(ctx)                                functions/api/analyze.ts
                                  ├─ validates body + size limit
                                  ├─ getProvider(env)  (gemini or anthropic)        functions/api/_providers.ts
                                  ├─ buildPrompt(language)  (the instructions)      functions/api/_prompt.ts
                                  ├─ provider.analyze(...)  → calls Gemini/Claude    functions/api/_providers.ts
                                  │     using reportSchema to force clean JSON       functions/api/_schema.ts
                                  └─ normalizeReport(rawJson, language)             functions/api/analyze.ts
                                  returns { ok:true, report }
─────────────────────────────────  back to the browser  ─────────────────────────────────────
Loading ends               →     analyzeReport resolves → setReport(); phase='result'  src/App.tsx
Sees the report            →     <ReportView report={...}/> renders the template   src/components/ReportView.tsx
Clicks "Download PDF"      →     App.handleDownload()                              src/App.tsx
                                  └─ downloadReportPdf(reportRef, name)             src/lib/pdf.ts
                                      ├─ html2canvas() screenshots the report
                                      ├─ computeSegments() decides page breaks
                                      └─ jsPDF builds + saves the file
PDF downloads              ✓
```

### The same flow in words

1. **Page loads.** [src/main.tsx](src/main.tsx) finds the `<div id="root">` in
   [index.html](index.html) and renders the React `<App/>` into it. That's the
   whole bootstrap.

2. **Upload screen.** [src/App.tsx](src/App.tsx) is a *state machine* with a
   single `phase` variable. It starts at `'upload'`, so it shows the
   `LanguageToggle` and `UploadCard`.

3. **Language choice.** [LanguageToggle.tsx](src/components/LanguageToggle.tsx) is
   a "controlled component": it doesn't store the choice itself, it calls
   `onChange(lang)` and `App` stores it in `language`. One source of truth.

4. **File pick + validation.** [UploadCard.tsx](src/components/UploadCard.tsx)'s
   `accept()` function checks the file is a PDF and ≤ 15 MB **before** anything is
   sent. Validating on the client gives instant, friendly errors and avoids
   wasting a paid AI call.

5. **Generate.** `App.handleGenerate()` flips `phase` to `'loading'` (so
   [LoadingState.tsx](src/components/LoadingState.tsx) shows its calm animation),
   then awaits [analyzeReport()](src/lib/analyze.ts).

6. **Browser → base64 → server.** `analyzeReport` first calls `fileToBase64()` to
   turn the binary PDF into a text string (because JSON can only carry text), then
   `fetch`es `POST /api/analyze` with `{ pdfBase64, language }`.

7. **Server validates.** On Cloudflare,
   [onRequestPost()](functions/api/analyze.ts) parses the JSON, rejects an empty
   body, and checks the decoded size against `MAX_PDF_BYTES`.

8. **Server picks the AI.** `getProvider(env)` reads the `AI_PROVIDER` env var and
   returns either the `gemini` or `anthropic` implementation
   ([_providers.ts](functions/api/_providers.ts)).

9. **Server builds the prompt + calls the AI.** `provider.analyze()` combines
   `buildPrompt(language)` ([_prompt.ts](functions/api/_prompt.ts)) with the PDF
   and the `reportSchema` ([_schema.ts](functions/api/_schema.ts)), sends it to the
   model, and gets back a **JSON string** describing the report.

10. **Server cleans the result.** `normalizeReport()` parses that JSON, strips any
    stray markdown fences, and fills in safe defaults for any missing field, so the
    UI never crashes on a partial answer. It returns `{ ok: true, report }`.

11. **Back in the browser.** `analyzeReport` returns the typed `MedicalReport`;
    `App` stores it and flips `phase` to `'result'`.

12. **Render the report.** [ReportView.tsx](src/components/ReportView.tsx) turns
    the data into the on-screen, color-coded template. **This same DOM is the PDF
    template** — there is only one design to maintain.

13. **Download.** `App.handleDownload()` lazy-imports
    [src/lib/pdf.ts](src/lib/pdf.ts) (so the heavy PDF libraries don't slow the
    first page load) and calls `downloadReportPdf()`, which screenshots the report
    and assembles a paginated A4 PDF.

That's the entire app. Everything else is detail on these steps.

---

<a name="tech-stack"></a>
## 4. Tech stack & why each piece exists

| Choice | Why it's here |
| --- | --- |
| **React + TypeScript** | Component UI + compile-time safety. The report's shape lives in one type (`src/types.ts`) shared by frontend *and* server, so they can never drift apart. |
| **Vite** | Near-instant dev server and tiny production bundles. Keeps the app lightweight (a core product requirement). |
| **Tailwind CSS v4** | Utility styling with all design tokens in one file (`src/index.css` `@theme`). In v4 there is **no** `tailwind.config.js` — theming is CSS. |
| **Cloudflare Pages + Functions** | Free static hosting **plus** a serverless function next to it to hide the API key. Same platform the domain is on = simplest possible deploy. |
| **Google Gemini (default)** | Has a real **free tier** and reads PDFs (including scanned/image PDFs) natively — so we need **no OCR library**. |
| **Anthropic Claude (optional)** | Paid, highest-quality alternative. One env var swaps to it. |
| **jsPDF + html2canvas-pro** | Build the downloadable PDF by *screenshotting* the rendered report. This is the only reliable way to get **correct Hindi (Devanagari) rendering** in a PDF (explained in §7). |

---

<a name="project-structure"></a>
## 5. Project structure — every file explained

Every source file starts with a `WHAT / WHY` header comment. This table is the map.

```
healthdecode-realm/
├── index.html                  HTML entry. Loads fonts (Inter + Noto Sans Devanagari) + the React bundle.
├── package.json                Scripts & dependencies (the "control panel" of the project).
├── vite.config.ts              Build/dev config. Registers React + Tailwind plugins; proxies /api in dev.
├── tsconfig*.json              TypeScript configs (app code vs node build-tooling, split for correctness).
├── wrangler.toml               Cloudflare Pages config (build output dir, runtime date, node compat).
├── .env.example                Template for secrets. Copy to .dev.vars for local dev.
│
├── public/                     Files copied as-is to the site root.
│   ├── favicon.svg             Lightweight inline-SVG icon.
│   └── _headers                Security + caching HTTP headers Cloudflare Pages applies.
│
├── functions/                  ← SERVER code (runs on Cloudflare, NEVER in the browser)
│   └── api/
│       ├── analyze.ts          POST /api/analyze — the endpoint the browser calls. Validates, calls AI, cleans output.
│       ├── _providers.ts       Provider abstraction. Gemini + Anthropic implementations. **Swap/add providers here.**
│       ├── _prompt.ts          The AI instructions (tone, safety rules, structure). Tune answer quality here.
│       └── _schema.ts          JSON schema that forces the AI to return well-formed report data.
│
└── src/                        ← BROWSER code (the React SPA)
    ├── main.tsx                Mounts <App/> into #root. The bootstrap.
    ├── App.tsx                 Root state machine: upload → loading → result. Owns all top-level state.
    ├── index.css               Tailwind import + design tokens (@theme) + base styles.
    ├── types.ts                Shared TypeScript types. The contract between AI, server, and UI.
    ├── lib/
    │   ├── analyze.ts          Browser API client: File → base64 → POST /api/analyze → typed report.
    │   ├── pdf.ts              Report DOM → paginated A4 PDF (html2canvas + jsPDF).
    │   └── i18n.ts             All UI strings in English + Hindi (the report *content* is AI-generated).
    └── components/
        ├── LanguageToggle.tsx  English/Hindi segmented control.
        ├── UploadCard.tsx      Drag-and-drop / tap-to-browse PDF upload + client-side validation.
        ├── LoadingState.tsx    Calm pulsing animation while the AI works.
        └── ReportView.tsx      The report template. Rendered on screen AND captured into the PDF.
```

> **Why the `_` prefix?** Cloudflare Pages turns each file in `functions/` into a
> URL route — **except** files starting with `_`. So `analyze.ts` becomes
> `/api/analyze`, but `_prompt.ts`, `_schema.ts`, `_providers.ts` are just shared
> helper modules, not routes. This is a Cloudflare convention, not a TypeScript one.

---

<a name="ai-integration"></a>
## 6. AI integration deep dive (how we talk to Gemini & Claude)

This is the part you came for. We split the AI work into **four small files** so
each concern can change independently:

| File | Responsibility | Edit it when you want to… |
| --- | --- | --- |
| `_prompt.ts` | **What we ask** — tone, safety rules, "explain simply", language. | Improve answers, change tone, add a rule. |
| `_schema.ts` | **The exact JSON shape** the AI must return (mirrors `src/types.ts`). | Add/remove a report field. |
| `_providers.ts` | **How we call each AI** (the network + structured-output mechanics). | Add a provider, change models. |
| `analyze.ts` | **Orchestration** — validate input, call provider, clean output. | Rarely. |

### 6.1 The three ideas that make AI integration work here

**Idea 1 — The AI reads the PDF directly (no OCR).**
Both Gemini and Claude are *multimodal*: you can hand them a PDF as input and they
read it — even scanned/photographed reports. That single fact removed an entire
category of code (an OCR engine) and kept the app lightweight. We just base64-encode
the PDF and attach it to the request.

**Idea 2 — Structured output (we never parse prose).**
Left alone, an LLM replies in paragraphs. Paragraphs are a nightmare to turn back
into reliable UI. So we give the model a **JSON schema** (`_schema.ts`) and tell it
"fill this shape." The model returns data, not prose. Each provider has its own
mechanism for this (see 6.3), but the schema is shared.

**Idea 3 — Low temperature (faithful, not creative).**
`temperature: 0.2` tells the model to be consistent and literal. Medical extraction
must be faithful to the report, not imaginative. High temperature = creative
writing; low temperature = "just read what's there."

### 6.2 Anatomy of the Gemini request (the free-tier default)

From [_providers.ts](functions/api/_providers.ts), the `gemini.analyze()` function
builds this and POSTs it to Google:

```jsonc
// POST https://generativelanguage.googleapis.com/v1beta/models/<model>:generateContent?key=<KEY>
{
  "contents": [{
    "role": "user",
    "parts": [
      { "text": "<the entire prompt from buildPrompt()>" },          // the instructions
      { "inline_data": { "mime_type": "application/pdf",
                         "data": "<base64 of the PDF>" } }            // the report itself
    ]
  }],
  "generationConfig": {
    "temperature": 0.2,                       // be faithful, not creative
    "responseMimeType": "application/json",   // "reply with JSON, not prose"
    "responseSchema": <reportSchema>          // "...and use exactly this shape"
  }
}
```

The response comes back nested; we dig out the text with
`data.candidates?.[0]?.content?.parts?.[0]?.text` and return it as a string. The
`?.` (optional chaining) means "if any link in this chain is missing, give
`undefined` instead of crashing" — then we throw a clean error if it's empty.

### 6.3 Anatomy of the Anthropic (Claude) request

Claude gets structured output a different way — via a **tool**. We define a tool
whose `input_schema` is our report schema, then *force* the model to call it. The
arguments the model passes to that tool **are** our JSON. From `anthropic.analyze()`:

```jsonc
// POST https://api.anthropic.com/v1/messages   (headers: x-api-key, anthropic-version)
{
  "model": "claude-sonnet-4-6",
  "max_tokens": 8000,
  "temperature": 0.2,
  "tools": [{
    "name": "return_report",
    "description": "Return the interpreted medical report as structured data.",
    "input_schema": <reportSchema>           // same schema as Gemini uses
  }],
  "tool_choice": { "type": "tool", "name": "return_report" },  // MUST call it
  "messages": [{
    "role": "user",
    "content": [
      { "type": "text", "text": "<buildPrompt()>" },
      { "type": "document",
        "source": { "type": "base64", "media_type": "application/pdf", "data": "<base64>" } }
    ]
  }]
}
```

We then find the `tool_use` block in the response and `JSON.stringify` its `input`
so both providers return the same thing to the caller: **a JSON string**. This is
the key design win — `analyze.ts` doesn't know or care which AI ran.

> The exact model IDs and the latest Claude options live in Anthropic's docs; this
> project defaults to `gemini-2.5-flash` and `claude-sonnet-4-6`, both overridable
> via the `GEMINI_MODEL` / `ANTHROPIC_MODEL` env vars with **no code change**.

### 6.4 What the prompt actually does ([_prompt.ts](functions/api/_prompt.ts))

`buildPrompt(language)` returns one big instruction string. Its structure, and
*why* each part exists:

- **Role + audience** — "you explain to ordinary people with NO medical
  background." Sets the tone.
- **"Any kind of report"** — lab, dental, eye, imaging, prescription. Makes the app
  general, not just blood-tests.
- **The job, step by step** — read everything → identify report type → extract every
  finding → classify each as normal/high/low/watch → explain simply.
- **"Write for everyone"** — short sentences, no jargon, reassuring, never scary.
- **SAFETY RULES (critical)** — never diagnose, never state a disease as certain,
  always say "consult a doctor," flag serious values calmly. These are repeated on
  purpose.
- **Output language** — all human-readable text in the chosen language.
- **Output format** — "return ONLY JSON matching the schema; fill arrays even if
  short; tailor food/lifestyle tips to the report type."
- **`overallStatus` rubric** — exact rules for choosing `good` / `attention` /
  `see-doctor`.

To improve answer quality or change behavior, **this is usually the only file you
touch.**

### 6.5 What the schema enforces ([_schema.ts](functions/api/_schema.ts))

`reportSchema` is an OpenAPI-subset JSON-schema object that both providers accept.
It declares every field (`overallSummary`, `importantFindings[]`, `foodsToLimit[]`,
…), the `findingSchema` shape for each finding, and a `required` list. The model is
*constrained* to emit exactly these fields. Note `language` is intentionally **not**
requested from the model — we already know it, so the server injects it afterward in
`normalizeReport`.

> **Golden rule:** `src/types.ts` (the TypeScript contract), `_schema.ts` (what the
> AI must return), and `ReportView.tsx` (what gets rendered) must always agree. Change
> one → change all three. TypeScript will point you at most of the spots.

---

<a name="pdf-deep-dive"></a>
## 7. PDF generation deep dive (how the download is built)

The downloadable PDF is produced entirely **in the browser** by
[src/lib/pdf.ts](src/lib/pdf.ts). No server, no PDF service.

### 7.1 Why we screenshot the page instead of "drawing" a PDF

Pure PDF libraries (jsPDF's text API, pdfkit, etc.) lay out text glyph-by-glyph.
They do **not** correctly *shape* Devanagari (Hindi): conjuncts and matras come out
wrong or as boxes. The **browser**, on the other hand, renders Hindi perfectly using
the `Noto Sans Devanagari` font we load in `index.html`.

So the trick is: let the browser do what it's great at (render beautiful, correct
HTML), then **photograph** that rendering with `html2canvas-pro` and place the photo
into a `jsPDF` page.

- ✅ Hindi looks exactly right — zero font-shaping code.
- ✅ The PDF is pixel-identical to the on-screen report (one template, one source of
  truth — see `ReportView.tsx`).
- ⚠️ Trade-off: the PDF text is an **image** (not selectable / not copy-pasteable).
  For a printable patient handout, that's a deliberate, acceptable choice.

### 7.2 The hard part: page breaks that don't cut cards in half

A report is one tall image, but a PDF is fixed A4 pages. A naïve approach slices the
tall image every "one page height" of pixels — which cuts straight through whatever
sits on the fold (a card's title on page 1, its value on page 2). Ugly.

Our solution reads the **geometry of the content** and only breaks pages in the gaps
*between* blocks. Here's how the pieces fit:

**Step 1 — Mark the blocks (in `ReportView.tsx`).**
Elements that should stay whole carry a `data-pdf-block` attribute. The `Section`
component supports three modes:
- `'atomic'` (default) — the whole section is one unbreakable block (short sections).
- `'split'` — the heading is its own block marked `data-pdf-keep="next"` (so it never
  gets orphaned at the bottom of a page), and each child card marks its own block —
  used for long lists like findings, so pages can break *between* cards.
- `'none'` — no markers (the parent already wraps it in a block).

**Step 2 — Capture (`downloadReportPdf`).**
`html2canvas(element, { scale: 2, backgroundColor: '#ffffff', useCORS: true })`
renders the report to a canvas at 2× resolution (crisp on print/retina). `useCORS`
lets the Google-hosted font be captured.

**Step 3 — Read block positions (`readBlocks`).**
For every `data-pdf-block`, record its top/bottom in *canvas pixels* (relative to the
report's top), plus whether it wants to "keep with next."

**Step 4 — Decide page breaks (`computeSegments`).**
Walk the blocks. If a block would spill past the current page's bottom, set a page
break at that block's top — and if a "keep-with-next" heading sits just above, move
the break up to *before* the heading so it travels with its content. A block taller
than a whole page is hard-split as a last resort so nothing is ever lost. The result
is a list of `[top, bottom]` pixel segments, one per page.

**Step 5 — Build the PDF.**
For each segment, copy that slice of the big canvas onto its own small canvas, export
it as JPEG (quality `0.92` keeps the file small), and `pdf.addImage(...)` it onto a
fresh A4 page. Finally `pdf.save('<name>.pdf')` triggers the browser download.

### 7.3 Why the import is lazy

In `App.handleDownload`, the PDF module is loaded with
`await import('./lib/pdf')` **only when the user clicks Download**. jsPDF +
html2canvas are the heaviest dependencies in the app; lazy-loading them keeps the
initial page fast. Most of the bundle weight lives behind that one click.

---

<a name="function-reference"></a>
## 8. Function-by-function reference

Every function in the project, what it takes, what it returns, and what it does.

### Server — `functions/api/`

**`analyze.ts`**
- `onRequestPost(ctx)` → `Promise<Response>` — the route handler for
  `POST /api/analyze`. Parses the body, validates the PDF + size, calls the provider,
  normalizes the result, returns JSON. Catches all errors and returns a safe message
  (never leaks internals).
- `normalizeReport(rawJson, language)` → `MedicalReport` — `JSON.parse`s the model's
  string, strips stray ```` ```json ```` fences, and fills safe defaults for every
  field so a partial answer degrades gracefully instead of crashing.
- `json(payload, status)` → `Response` — tiny helper that returns JSON with the right
  headers + HTTP status.

**`_providers.ts`**
- `getProvider(env)` → `AIProvider` — reads `AI_PROVIDER`, returns the matching
  provider (`gemini` default), throws on unknown names.
- `gemini.analyze(pdfBase64, language, env)` → `Promise<string>` — calls Google's
  API with the PDF + prompt + `responseSchema`; returns the JSON text.
- `anthropic.analyze(pdfBase64, language, env)` → `Promise<string>` — calls Claude
  with a forced tool whose `input_schema` is our schema; returns the tool input as a
  JSON string.
- `safeText(res)` → `Promise<string>` — reads an error response body without throwing
  (used to surface useful API error details).

**`_prompt.ts`**
- `buildPrompt(language)` → `string` — assembles the full instruction string in the
  requested language. The single biggest lever on quality + safety.

**`_schema.ts`**
- `reportSchema` (const) — the JSON schema both providers use to force structured
  output. `findingSchema` is the reusable per-finding fragment.

### Browser — `src/`

**`main.tsx`** — mounts `<App/>` into `#root` (throws if `#root` is missing).

**`App.tsx`** (the state machine)
- `handleGenerate()` — `upload → loading`, calls `analyzeReport`, then `→ result`
  (or back to `upload` with an error).
- `handleDownload()` — lazy-imports the PDF helper and calls `downloadReportPdf` on
  the live report DOM (`reportRef`).
- `handleReset()` — clears everything back to the `upload` phase.

**`lib/analyze.ts`**
- `fileToBase64(file)` → `Promise<string>` — reads the File via `FileReader` and
  strips the `data:...;base64,` prefix (the server wants raw base64).
- `analyzeReport(file, language)` → `Promise<MedicalReport>` — encodes the PDF,
  POSTs to `/api/analyze`, parses the response, throws on `{ ok: false }`.

**`lib/pdf.ts`**
- `downloadReportPdf(element, fileName)` → `Promise<void>` — the orchestrator
  (capture → segment → assemble → save).
- `readBlocks(element, canvasScale)` — measures every `data-pdf-block` in canvas px.
- `computeSegments(blocks, canvasHeight, pageHeightPx)` → `Segment[]` — the
  page-break algorithm (never splits a block; keeps headings with their content).

**`lib/i18n.ts`**
- `t(lang)` → `Strings` — returns the English or Hindi string pack. `Strings` is a
  TypeScript interface, so both packs are forced to stay in sync.

**Components**
- `LanguageToggle({ value, onChange })` — controlled English/Hindi segmented control.
- `UploadCard({ language, file, onFileChange, onSubmit })` — drop zone + validation
  (`accept()` checks PDF type and 15 MB limit) + the Generate button.
- `LoadingState({ language })` — pure-CSS pulsing animation shown during the AI call.
- `ReportView` (forwardRef) — renders the full report template; the forwarded `ref`
  is what the PDF helper photographs. Internal helpers: `statusStyle` (status →
  color), `StatusBanner`, `Section`, `FindingRow`, `BulletList`.

---

<a name="swapping-providers"></a>
## 9. Swapping / adding AI providers

**Switching between the built-in providers needs zero code changes** — flip one env
var:

```bash
# Free tier (default)
AI_PROVIDER=gemini
GEMINI_API_KEY=...

# Highest quality (paid)
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=...
```

- **Free key:** <https://aistudio.google.com/apikey>
- **Pick a model** without code: `GEMINI_MODEL` / `ANTHROPIC_MODEL`.
- In production these live in **Cloudflare → Pages → Settings → Environment
  variables**.

### Adding a brand-new provider (e.g. OpenAI)

1. Open `functions/api/_providers.ts`.
2. Add an object implementing the `AIProvider` interface:
   ```ts
   const openai: AIProvider = {
     async analyze(pdfBase64, language, env) {
       // 1. build the request (attach buildPrompt(language) + the PDF + reportSchema)
       // 2. fetch the API
       // 3. return the report JSON as a STRING
     },
   };
   ```
3. Register it: `const providers = { gemini, anthropic, openai };`
4. Set `AI_PROVIDER=openai` and its key. **No other file changes.**

The contract every provider honors: *take the PDF + language, return a JSON string
matching `reportSchema`.* The rest of the app is provider-agnostic.

---

<a name="running-locally"></a>
## 10. Running locally (Wrangler explained)

> **Why two modes?** The AI call runs inside a **Cloudflare Function**. The plain
> Vite dev server (`npm run dev`) serves the React UI but does **not** run Functions.
> **Wrangler** is Cloudflare's CLI that *does* run them locally, simulating the real
> production runtime. So:
> - **UI-only work** (styling, layout) → fast Vite server (Mode B).
> - **The real upload → AI → report → PDF flow** → Wrangler (Mode A).

### Step 0 — Prerequisites
- Node.js 18+ and npm.

### Mode A — full manual test (upload a real PDF, get a real report)

**1. Install (first time only):**
```bash
npm install
```

**2. Add your AI key for local dev.** Functions read secrets from a git-ignored
`.dev.vars` file (Wrangler's equivalent of `.env`):
```bash
cp .env.example .dev.vars
```
Edit `.dev.vars` and set a real free Gemini key
(<https://aistudio.google.com/apikey>):
```
AI_PROVIDER=gemini
GEMINI_API_KEY=AIza...your-real-key...
GEMINI_MODEL=gemini-2.5-flash
```

**3. Build + start the full local stack (frontend + the `/api` Function):**
```bash
npm run pages:dev      # = npm run build && wrangler pages dev dist
```
When ready it prints a local URL, usually `http://localhost:8788`.

**4. Open it:** <http://localhost:8788>

**5. Test the flow:** pick a language → upload a lab report PDF (scanned works) →
**Generate** → see the explained report → **Download PDF** (check Hindi renders right
if you chose हिन्दी).

> ⚠️ `pages:dev` builds first, so after a code change **stop it (Ctrl+C) and rerun**.
> For rapid UI work use Mode B.

### Mode B — fast UI-only loop (no real AI)
```bash
npm run dev      # Vite at http://localhost:5173, hot reload
```
The UI loads instantly and hot-reloads, but the AI call will fail here unless you
also run `wrangler pages dev dist --port 8788` in a second terminal — Vite proxies
`/api` → port 8788 (configured in `vite.config.ts`). For pure layout work, ignore the
upload error.

### Quick endpoint smoke test (no browser)
```bash
curl -X POST http://localhost:8788/api/analyze \
  -H "Content-Type: application/json" -d '{}'
# Expected: {"ok":false,"error":"No PDF was provided."}  → the Function is wired up.
```

### All scripts
```bash
npm run dev         # Vite UI-only dev server (hot reload, no Functions)
npm run pages:dev   # build + full local stack incl. /api Function  ← manual testing
npm run build       # typecheck (tsc -b) + production build into dist/
npm run preview     # preview the production build (static only)
npm run typecheck   # types only, no emit
npm run pages:deploy# build + deploy to Cloudflare Pages
```

### Common local-testing gotchas
| Problem | Fix |
| --- | --- |
| `Server is missing GEMINI_API_KEY` | No real key in `.dev.vars`; add it and restart `pages:dev`. |
| `/api/analyze` returns 404 | You're on `npm run dev` (Vite only). Use `npm run pages:dev`. |
| Changed code but nothing changed | `pages:dev` serves a build. Stop (Ctrl+C) and rerun. |
| `Gemini API error (429)` | Free-tier rate limit. Wait and retry, or switch to Anthropic. |

---

<a name="deploying"></a>
## 11. Deploying to Cloudflare Pages + custom domain

Target: **healthdecode.frontendrealm.com** (domain on Cloudflare).

### One-time setup (dashboard route — easiest)
1. Push this repo to GitHub.
2. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**.
3. Pick the repo. Build settings:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. **Settings → Environment variables**, add:
   - `AI_PROVIDER` = `gemini`
   - `GEMINI_API_KEY` = *your key* (mark as **encrypted/secret**)
   - *(optional)* `GEMINI_MODEL`, or the Anthropic vars if you switch later.
5. **Deploy.** Every push to `main` now auto-builds and deploys.

### Point the custom domain
1. Pages project → **Custom domains → Set up a custom domain**.
2. Enter `healthdecode.frontendrealm.com`.
3. Since `frontendrealm.com` is already on Cloudflare, it auto-creates the `CNAME`
   and provisions TLS. Wait a minute for the certificate. Done.

### CLI alternative
```bash
npm run pages:deploy
npx wrangler pages secret put GEMINI_API_KEY   # set the secret once
```

---

<a name="extending"></a>
## 12. How to add a new feature (worked examples)

**Add a new section to the report (e.g. "Recommended Tests"):**
1. Add the field to `MedicalReport` in `src/types.ts`.
2. Add it to `reportSchema` in `functions/api/_schema.ts` (+ `required` if always present).
3. Mention it in `functions/api/_prompt.ts` so the AI fills it.
4. Add labels in `src/lib/i18n.ts` (both `en` and `hi`).
5. Render it in `src/components/ReportView.tsx` with a `<Section>`.
TypeScript will flag every spot that still needs updating.

**Add a third language (e.g. Tamil):**
1. Extend `Language` in `src/types.ts` (`'en' | 'hi' | 'ta'`).
2. Add a `ta` string pack in `src/lib/i18n.ts`.
3. Add a button in `src/components/LanguageToggle.tsx`.
4. Load a suitable font in `index.html` and add a `.lang-ta` class in `index.css`.
The AI already writes in whatever language `buildPrompt` names.

**Change the AI tone / add a safety rule:** edit `functions/api/_prompt.ts` only.

---

<a name="design-system"></a>
## 13. Design system & conventions

- **Colors/fonts** live in `src/index.css` under `@theme`. `brand-*` is the medical
  teal; `status-*` colors map to lab finding states (normal/high/low/watch).
- **Mobile-first:** base styles target phones; `sm:` adds desktop refinements.
- **Bilingual rendering:** add the `lang-hi` class to any Hindi text block so it uses
  the Devanagari font (critical for correct shaping on screen *and* in the PDF).
- **Comment style:** every file starts with a `WHAT / WHY` header; non-obvious logic
  has inline comments. Please keep this up — it's why the codebase is approachable.

---

<a name="safety"></a>
## 14. Safety & medical disclaimer policy

This app must **never diagnose**. These rules are enforced in
`functions/api/_prompt.ts` and surfaced in the UI:
- Always frame findings as information, not diagnosis.
- Always advise consulting a real doctor; flag clearly-abnormal values for review.
- A disclaimer is always shown on screen, in the footer, **and** inside every
  generated PDF.

If you change the prompt, **do not weaken these rules.**

---

<a name="troubleshooting"></a>
## 15. Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| `Server is missing GEMINI_API_KEY` | Key not set. Add to `.dev.vars` (local) or Cloudflare env vars (prod). |
| `/api/analyze` 404 in `npm run dev` | Vite-only server has no Functions. Use `npm run pages:dev`. |
| `Gemini API error (429)` | Free-tier rate limit. Wait, or switch `AI_PROVIDER=anthropic`. |
| Hindi looks like boxes in the PDF | The Devanagari font didn't load before capture. Ensure the `index.html` font `<link>` is present and online. |
| PDF too big / slow | Lower the JPEG quality or `scale` in `src/lib/pdf.ts`. |
| "PDF is too large (max 15 MB)" | Expected guard. Raise `MAX_PDF_BYTES` in `analyze.ts` + `MAX_BYTES` in `UploadCard.tsx`. |
| "The AI response was not valid JSON" | Rare. Usually a transient model hiccup — retry. If persistent, check the schema matches `types.ts`. |

---

<a name="glossary"></a>
## 16. Glossary (quick definitions)

- **Base64** — text encoding of binary data so it fits inside JSON.
- **CORS** — browser security rules about loading cross-origin resources (why
  `useCORS: true` matters for the font during PDF capture).
- **Devanagari** — the script Hindi is written in; needs special *shaping* (why we
  screenshot instead of drawing PDF text).
- **forwardRef** — a React feature letting a parent get a direct handle to a child's
  DOM node (how `App` hands `ReportView` to the PDF helper).
- **Optional chaining (`?.`)** — "read this property only if the thing before it
  exists, else give `undefined`" — used to safely dig into AI responses.
- **Pages Function** — Cloudflare's name for a serverless function that lives next to
  a static site; file-routed from `functions/`.
- **Structured output** — constraining an LLM to return data in a fixed JSON shape
  instead of free text.
- **Temperature** — an LLM setting from 0 (consistent/literal) to ~1 (creative); we
  use 0.2 for faithful extraction.

---

*Built for everyone — from a doctor to a first-time patient in a village.*
*HealthDecode provides general information only and is not a medical diagnosis.*
