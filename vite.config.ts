// vite.config.ts
// -----------------------------------------------------------------------------
// WHAT: Vite build/dev configuration for the HealthDecode single-page app.
// WHY:  Vite gives us an extremely fast dev server and a tiny, tree-shaken
//       production bundle (important — the app must stay lightweight). We keep
//       this file deliberately small: the fewer build-time moving parts, the
//       easier it is for the next developer to reason about the pipeline.
// -----------------------------------------------------------------------------

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // `react()`      -> enables JSX/TSX, Fast Refresh in dev.
  // `tailwindcss()`-> Tailwind v4's first-party Vite plugin. In v4 there is no
  //                   tailwind.config.js by default; theming lives in CSS
  //                   (see src/index.css `@theme`). This keeps config in one place.
  plugins: [react(), tailwindcss()],

  build: {
    // Modern browsers only — smaller output, no legacy polyfills.
    target: 'es2020',
    // Emit a manifest is unnecessary for static hosting on Cloudflare Pages.
    sourcemap: false,
  },

  server: {
    // During `npm run dev` the Cloudflare Function in /functions is NOT running
    // (that needs `wrangler pages dev`). For pure-frontend iteration we proxy
    // /api/* to a locally running `wrangler pages dev` if you start one on 8788.
    // If you are not running wrangler, the upload call will fail with a clear
    // network error — that is expected; use `npm run pages:dev` for full E2E.
    proxy: {
      '/api': 'http://localhost:8788',
    },
  },
});
