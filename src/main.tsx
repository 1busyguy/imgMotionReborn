// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Clean OAuth hash IMMEDIATELY before React starts
if (window.location.hash && window.location.hash.includes('access_token')) {
  console.log('OAuth callback detected, cleaning URL immediately...');
  const newUrl = window.location.pathname + window.location.search;
  window.history.replaceState(null, '', newUrl);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
