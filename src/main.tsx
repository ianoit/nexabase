import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';

// Disable default browser context menu (Reload, Inspect Element) globally
// to provide a clean, professional desktop experience.
// Custom context menus (in Sidebar and DataGrid) will continue to work normally.
window.addEventListener('contextmenu', (e) => {
  e.preventDefault();
}, false);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary fallbackTitle="Nexabase Studio Error">
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

