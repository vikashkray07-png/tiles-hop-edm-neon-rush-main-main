import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// If anything ever crashes the screen, show a dark recovery screen
// (never a blank white page) with a restart button.
class CrashGuard extends React.Component<
  { children: React.ReactNode },
  { failed: boolean; message: string }
> {
  state = { failed: false, message: '' };

  static getDerivedStateFromError(error: unknown) {
    return {
      failed: true,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidCatch(error: unknown) {
    console.error('Game crashed:', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: '#050a1a',
          color: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          textAlign: 'center',
          fontFamily: 'sans-serif',
        }}
      >
        <h2 style={{ fontSize: '22px', fontWeight: 900, marginBottom: '12px' }}>
          Something went wrong
        </h2>
        <p style={{ fontSize: '12px', opacity: 0.6, marginBottom: '20px', wordBreak: 'break-word' }}>
          {this.state.message}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            background: 'linear-gradient(90deg,#06b6d4,#2563eb)',
            color: '#fff',
            border: 'none',
            borderRadius: '12px',
            padding: '14px 28px',
            fontWeight: 900,
            fontSize: '16px',
          }}
        >
          RESTART GAME
        </button>
      </div>
    );
  }
}

createRoot(document.getElementById('root')!).render(
  <CrashGuard>
    <App />
  </CrashGuard>
);
