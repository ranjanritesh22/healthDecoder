# HealthDecode — Developer Guide

> **What this app does:** A user uploads a medical lab report PDF, picks a
> language (English / हिन्दी), and gets back a clean, plain-language explanation
> of every value — viewable on screen and downloadable as a polished PDF.
> No accounts, no database, no history. **Simple. Fast. Trustworthy.**

This README is the **guide for the next developer**. It explains the
architecture, every file, how the AI integration works (and how to swap AI
providers), and how to run, deploy, and extend the app.

---

## Table of contents

1. [How it works (the 10-second mental model)](#how-it-works)
2. [Tech stack & why](#tech-stack)
3. [Project structure — every file explained](#project-structure)
4. [The AI integration (read this before touching AI code)](#ai-integration)
5. [Swapping AI providers (Gemini ↔ Anthropic ↔ anything)](#swapping-providers)
6. [Running locally](#running-locally)
7. [Deploying to Cloudflare Pages + custom domain](#deploying)
8. [How to add a new feature (worked examples)](#extending)
9. [Design system & conventions](#design-system)
10. [Safety & medical disclaimer policy](#safety)
11. [Troubleshooting](#troubleshooting)

---

<a name="how-it-works"></a>
## 1. How it works (the 10-second mental model)

```
 Browser (React SPA)                     Cloudflare (server)              AI provider
 ───────────────────                     ───────────────────             ───────────
 1. Pick language + PDF
 2. PDF → base64
 3. POST /api/analyze  ───────────────►  functions/api/analyze.ts
                                         4. validate size/type
                                         5. getProvider(env)  ─────────►  Gemini / Claude
                                                                          reads the PDF,
                                                                          returns JSON
                                         6. normalize + validate  ◄──────
 7. render <ReportView/>  ◄────────────  return { ok, report }
 8. "Download PDF" → html2canvas
    screenshots the report → jsPDF
```

**The key idea:** the **AI API key never reaches the browser**. The browser only
talks to our own `/api/analyze` endpoint, which runs on Cloudflare's servers and
holds the secret key. This is why we use Cloudflare *Pages Functions* and not a
pure client-side app.

---

<a name="tech-stack"></a>
## 2. Tech stack & why

| Choice | Why |
| --- | --- |
| **React + TypeScript** | Component UI + compile-time safety. Types are shared between frontend and the server Function (`src/types.ts`) so they can never drift. |
| **Vite** | Tiny, fast bundles. Keeps the app lightweight (a core product requirement). |
| **Tailwind CSS v4** | Utility styling with the design tokens defined in one place (`src/index.css` `@theme`). No separate config file to hunt through. |
| **Cloudflare Pages + Functions** | Free static hosting + a serverless function to hide the API key. Same platform as the domain (bought on Cloudflare) = simplest deploy. |
| **Google Gemini (default)** | Has a genuine **free tier** and reads PDFs (including scanned/image PDFs) natively — so we need **no separate OCR library**. |
| **jsPDF + html2canvas-pro** | Generates the downloadable PDF *by screenshotting the rendered report*. This is the only reliable way to get **correct Hindi (Devanagari) rendering** in a PDF (see [AI integration](#ai-integration) and `src/lib/pdf.ts`). |

---

<a name="project-structure"></a>
## 3. Project structure — every file explained

Every source file has a header comment explaining **what** it does and **why**.
This table is the map.

```
healthdecode-realm/
├── index.html                  HTML entry. Loads fonts (Inter + Noto Sans Devanagari) + React.
├── package.json                Scripts & dependencies.
├── vite.config.ts              Build/dev config. Registers React + Tailwind plugins; proxies /api in dev.
├── tsconfig*.json              TypeScript configs (app vs node build tooling).
├── wrangler.toml               Cloudflare Pages project config (build output dir, runtime date).
├── .env.example                Template for secrets. Copy to .dev.vars for local dev.
│
├── public/
│   ├── favicon.svg             Lightweight inline-SVG icon.
│   └── _headers                Security + caching HTTP headers for Cloudflare Pages.
│
├── functions/                  ← SERVER code (runs on Cloudflare, NOT in the browser)
│   └── api/
│       ├── analyze.ts          POST /api/analyze. The endpoint the browser calls. Validates, calls AI, returns JSON.
│       ├── _providers.ts       Provider abstraction. Gemini + Anthropic implementations. **Swap providers here.**
│       ├── _prompt.ts          The AI instructions (tone, safety rules, structure). Tune quality here.
│       └── _schema.ts          JSON schema forcing the AI to return well-formed report data.
│
└── src/                        ← BROWSER code (the React SPA)
    ├── main.tsx                Mounts <App/> into #root.
    ├── App.tsx                 Root state machine: upload → loading → result.
    ├── index.css               Tailwind import + design tokens (@theme) + base styles.
    ├── types.ts                Shared TypeScript types. The contract between AI, server, and UI.
    ├── lib/
    │   ├── analyze.ts          Browser API client: File → base64 → POST /api/analyze → typed report.
    │   ├── pdf.ts              Report DOM → paginated A4 PDF (html2canvas + jsPDF).
    │   └── i18n.ts             All UI strings in English + Hindi.
    └── components/
        ├── LanguageToggle.tsx  English/Hindi segmented control.
        ├── UploadCard.tsx      Drag-and-drop / tap-to-browse PDF upload + validation.
        ├── LoadingState.tsx    Calm pulsing animation while the AI works.
        └── ReportView.tsx      The beautiful report template. Rendered on screen AND captured to PDF.
```

> **Files starting with `_` inside `functions/`** are *not* turned into routes by
> Cloudflare — they are shared modules. Only `analyze.ts` becomes a URL.

---

<a name="ai-integration"></a>
## 4. The AI integration (read this before touching AI code)

This is the heart of the app. It is intentionally split into **four small files**
so each concern can be changed independently:

| File | Responsibility | When you'd edit it |
| --- | --- | --- |
| `functions/api/_prompt.ts` | **What we ask the AI** — tone, safety rules, "explain simply", language. | To improve answer quality, change tone, add a rule. |
| `functions/api/_schema.ts` | **The exact JSON shape** the AI must return. Mirrors `src/types.ts`. | To add/remove a field in the report. |
| `functions/api/_providers.ts` | **How we call each AI** (Gemini, Anthropic). | To add a provider or change models. |
| `functions/api/analyze.ts` | **Orchestration** — validate input, call provider, clean output. | Rarely. |

### Why this design

- **The PDF is read by the AI directly.** Both Gemini and Claude are multimodal
  and accept a PDF as input — *including scanned/image PDFs*. That removed the
  need for a separate OCR step and a heavy OCR dependency. The app stays light.
- **Structured output.** We don't parse free text. We give the model a JSON
  schema (`_schema.ts`) and it returns data in exactly that shape. The UI can
  therefore trust the fields exist. `analyze.ts` still defensively fills missing
  arrays so a partial response degrades gracefully instead of crashing.
- **Low temperature (0.2).** Medical extraction should be faithful, not
  creative. We keep randomness low for consistency.

### Why the PDF download screenshots the page

Pure PDF libraries (jsPDF, pdfkit, etc.) do **not** correctly shape Devanagari
(Hindi) — conjuncts and matras render wrong. The **browser** renders Hindi
perfectly. So `src/lib/pdf.ts` takes a *screenshot* of the already-rendered
report and places it into the PDF. Result: the Hindi PDF looks exactly right,
with zero font-shaping code. Trade-off: PDF text is an image (not selectable) —
an intentional, acceptable choice for a printable patient handout.

---

<a name="swapping-providers"></a>
## 5. Swapping AI providers (Gemini ↔ Anthropic ↔ anything)

**You do not need to change code to switch between the built-in providers.**
Change ONE environment variable:

```bash
# Free tier (default)
AI_PROVIDER=gemini
GEMINI_API_KEY=...

# Highest quality (paid) — just flip the provider and add the key
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=...
```

- **Today (free):** keep `AI_PROVIDER=gemini`. Get a free key at
  <https://aistudio.google.com/apikey>.
- **When you buy an Anthropic key:** set `AI_PROVIDER=anthropic` and add
  `ANTHROPIC_API_KEY`. Everything else — prompt, schema, UI, PDF — stays
  identical. You can switch back to `gemini` at any time. In production these
  are set in **Cloudflare → Pages → Settings → Environment variables**; no
  redeploy of code is needed, just a new deployment to pick up the var.
- **Pick a model** without code changes via `GEMINI_MODEL` / `ANTHROPIC_MODEL`.

### Adding a brand-new provider (e.g. OpenAI)

1. Open `functions/api/_providers.ts`.
2. Add an object that implements the `AIProvider` interface:
   ```ts
   const openai: AIProvider = {
     async analyze(pdfBase64, language, env) {
       // call the API, return the report JSON as a string
     },
   };
   ```
3. Register it: `const providers = { gemini, anthropic, openai };`
4. Set `AI_PROVIDER=openai` and its API key. Done — no other file changes.

The contract every provider must honor: **take the PDF + language, return a JSON
string matching `reportSchema`.** The rest of the app is provider-agnostic.

---

<a name="running-locally"></a>
## 6. Running locally (manual testing)

> **Why two modes?** The AI call runs inside a **Cloudflare Function**, which the
> plain Vite dev server does not execute. So:
> - **UI-only changes** (styling, layout) → use the fast Vite server (Mode B).
> - **Testing the real upload → AI → report → PDF flow** → use Wrangler (Mode A).

### Step 0 — Prerequisites
- Node.js 18+ and npm installed.

### Step-by-step: full manual test (upload a real PDF, get a real report)

This is the path to actually try the app the way a user would.

**1. Install dependencies (first time only):**
```bash
npm install
```

**2. Add your AI key for local dev.** The Functions read secrets from a
git-ignored `.dev.vars` file. Create it (a template `.dev.vars` may already
exist — just edit the key):
```bash
cp .env.example .dev.vars         # if .dev.vars doesn't exist yet
```
Open `.dev.vars` and set your free Gemini key
(get one at <https://aistudio.google.com/apikey>):
```
AI_PROVIDER=gemini
GEMINI_API_KEY=AIza...your-real-key...
GEMINI_MODEL=gemini-2.5-flash
```

**3. Build + start the full local stack (frontend + the `/api` Function):**
```bash
npm run pages:dev
```
This runs `npm run build` then `wrangler pages dev dist`. When it's ready it
prints a local URL, usually:
```
[wrangler] Ready on http://localhost:8788
```

**4. Open it in your browser:** <http://localhost:8788>

**5. Test the flow manually:**
   1. Pick a language (English / हिन्दी).
   2. Upload a medical lab report PDF (a scanned PDF works too). Don't have one?
      Any real blood-test / lab report PDF works; you can also export a sample
      lab report to PDF.
   3. Click **Generate my report** → you should see the loading animation, then
      the explained, color-coded report.
   4. Click **Download PDF** → confirm the downloaded PDF looks right (check
      Hindi renders correctly if you chose हिन्दी).

> ⚠️ `npm run pages:dev` rebuilds first, so after changing code, **stop it
> (Ctrl+C) and run it again** to see your change. For rapid UI work use Mode B.

### Mode B — fast UI-only loop (no real AI)
For pure styling/layout iteration with hot reload:
```bash
npm run dev      # Vite at http://localhost:5173
```
The UI loads instantly and hot-reloads, but the **AI call will fail** here unless
you also run `wrangler pages dev dist --port 8788` in a second terminal (Vite
proxies `/api` → port 8788, configured in `vite.config.ts`). If you only need to
see layout/styling, ignore the upload error.

### Quick endpoint smoke test (no browser)
Confirm the Function is alive without uploading anything:
```bash
curl -X POST http://localhost:8788/api/analyze \
  -H "Content-Type: application/json" -d '{}'
# Expected: {"ok":false,"error":"No PDF was provided."}  → the Function is wired up.
```

### All scripts
```bash
npm run dev         # Vite UI-only dev server (hot reload, no Functions)
npm run pages:dev   # build + full local stack incl. /api Function  ← manual testing
npm run build       # typecheck + production build into dist/
npm run preview     # preview the production build (static only)
npm run typecheck   # types only, no emit
```

### Common local-testing gotchas
| Problem | Fix |
| --- | --- |
| `Server is missing GEMINI_API_KEY` | You skipped step 2, or left the placeholder. Put a real key in `.dev.vars` and restart `npm run pages:dev`. |
| `/api/analyze` returns 404 | You're on `npm run dev` (Vite only). Use `npm run pages:dev` for the AI flow. |
| Changed code but nothing changed | `pages:dev` serves a build. Stop (Ctrl+C) and rerun it. |
| `Gemini API error (429)` | Free-tier rate limit. Wait a bit and retry. |

---

<a name="deploying"></a>
## 7. Deploying to Cloudflare Pages + custom domain

The target is **healthdecode.frontendrealm.com** (domain bought on Cloudflare).

### One-time setup (dashboard route — easiest)
1. Push this repo to GitHub (see below).
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
1. In the Pages project → **Custom domains → Set up a custom domain**.
2. Enter `healthdecode.frontendrealm.com`.
3. Because `frontendrealm.com` is already on Cloudflare, it auto-creates the
   `CNAME` and provisions TLS. Wait a minute for the certificate. Done.

### CLI alternative
```bash
npm run pages:deploy        # builds + `wrangler pages deploy dist`
# set secrets once:
npx wrangler pages secret put GEMINI_API_KEY
```

---

<a name="extending"></a>
## 8. How to add a new feature (worked examples)

**Add a new section to the report (e.g. "Recommended Tests"):**
1. Add the field to `MedicalReport` in `src/types.ts`.
2. Add it to `reportSchema` in `functions/api/_schema.ts` (+ `required` if always present).
3. Mention it in `functions/api/_prompt.ts` so the AI fills it.
4. Add labels in `src/lib/i18n.ts` (both `en` and `hi`).
5. Render it in `src/components/ReportView.tsx` with a `<Section>`.
TypeScript will point you at every spot that needs updating.

**Add a third language (e.g. Tamil):**
1. Extend `Language` in `src/types.ts` (`'en' | 'hi' | 'ta'`).
2. Add a `ta` string pack in `src/lib/i18n.ts`.
3. Add a button in `src/components/LanguageToggle.tsx`.
4. Load a suitable font in `index.html` and add a `.lang-ta` class in `index.css`.
The AI already writes in whatever language `buildPrompt` names.

**Change the AI tone / add a safety rule:** edit `functions/api/_prompt.ts` only.

---

<a name="design-system"></a>
## 9. Design system & conventions

- **Colors/fonts** live in `src/index.css` under `@theme`. `brand-*` is the
  medical teal; `status-*` colors map to lab finding states.
- **Mobile-first:** base styles target phones; `sm:` adds desktop refinements.
- **Bilingual rendering:** add the `lang-hi` class to any Hindi text block so it
  uses the Devanagari font (critical for correct shaping on screen and in PDF).
- **Comment style:** every file starts with a `WHAT / WHY` header; non-obvious
  logic has inline comments. Please keep this up — it's why the codebase is
  approachable.

---

<a name="safety"></a>
## 10. Safety & medical disclaimer policy

This app must **never diagnose**. These rules are enforced in
`functions/api/_prompt.ts` and surfaced in the UI:
- Always frame findings as information, not diagnosis.
- Always advise consulting a real doctor; flag clearly-abnormal values for review.
- A disclaimer is always shown on screen, in the footer, **and** inside every
  generated PDF.
If you change the prompt, **do not weaken these rules.**

---

<a name="troubleshooting"></a>
## 11. Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| `Server is missing GEMINI_API_KEY` | Key not set. Add it to `.dev.vars` (local) or Cloudflare env vars (prod). |
| `/api/analyze` 404 in `npm run dev` | The Vite-only server has no Functions. Use `npm run pages:dev`, or run `wrangler pages dev` on 8788. |
| `Gemini API error (429)` | Free-tier rate limit hit. Wait, or switch `AI_PROVIDER=anthropic`. |
| Hindi looks like boxes in the PDF | The Devanagari font didn't load before capture. Ensure `index.html` font `<link>` is present and online. |
| PDF too big / slow | Lower the JPEG quality or `scale` in `src/lib/pdf.ts`. |
| "PDF is too large (max 15 MB)" | Expected guard. Raise `MAX_PDF_BYTES` in `analyze.ts` + `MAX_BYTES` in `UploadCard.tsx` if needed. |

---

*Built for everyone — from a doctor to a first-time patient in a village.*
*HealthDecode provides general information only and is not a medical diagnosis.*
