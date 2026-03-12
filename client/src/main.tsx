import { createRoot } from 'react-dom/client';

// Import polyfills first
import './lib/polyfills.ts';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import App from './App.tsx';
import './index.css';
import { initAnalytics } from '@/lib/analytics';

// FIXME: a custom font should be used. Eg:
// import '@fontsource-variable/<font-name>';

initAnalytics();

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
