// src/main.tsx
// -----------------------------------------------------------------------------
// WHAT: The JavaScript entry point. Mounts the React <App/> into #root.
// WHY:  Vite loads this from index.html. Kept to the bare minimum — all logic
//       lives in App and components. StrictMode surfaces accidental bugs in dev.
// -----------------------------------------------------------------------------

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found in index.html');

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
