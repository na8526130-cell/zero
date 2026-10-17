import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

const rootEl = document.getElementById('root');
if (rootEl) {
  try {
    const root = createRoot(rootEl);
    root.render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>
    );
  } catch (err: any) {
    console.error('Fatal mount error:', err);
    rootEl.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#171717;color:white;font-family:sans-serif;padding:20px;text-align:center;">
        <div style="max-width:400px;background:#262626;padding:24px;border-radius:16px;border:1px solid #404040;">
          <h2 style="font-size:16px;font-weight:bold;margin-bottom:8px;">起動エラーが発生しました</h2>
          <p style="font-size:12px;color:#a3a3a3;margin-bottom:16px;word-break:break-all;">${err?.message || String(err)}</p>
          <button onclick="localStorage.clear();location.reload();" style="padding:8px 16px;background:#ef4444;color:white;border:none;border-radius:8px;font-size:12px;cursor:pointer;font-weight:bold;">再読み込み</button>
        </div>
      </div>
    `;
  }
}
