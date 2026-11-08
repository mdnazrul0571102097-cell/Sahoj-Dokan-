import React, { Component, ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class RootErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, errorMessage: error?.message || 'অজানা ত্রুটি' };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('RootErrorBoundary caught error:', error, errorInfo);
  }

  handleReload = () => {
    try {
      window.location.reload();
    } catch (_) {}
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          backgroundColor: '#F8FAFC',
          fontFamily: 'system-ui, sans-serif',
          color: '#102A43',
          textAlign: 'center'
        }}>
          <div style={{
            maxWidth: '420px',
            width: '100%',
            backgroundColor: '#ffffff',
            borderRadius: '24px',
            padding: '28px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
            border: '1px solid #E2E8F0'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '20px',
              backgroundColor: '#E0F2F1',
              color: '#0E6B6B',
              fontSize: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              🏪
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: '900', color: '#102A43', marginBottom: '8px' }}>
              Sahoj Dokan - সহজ দোকান
            </h2>
            <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '20px', lineHeight: '1.5' }}>
              অ্যাপটি চালু হতে সাময়িক সমস্যা হয়েছে। আপনার কোনো তথ্য বা হিসাব ডিলিট হয়নি। নিচের বাটনে চাপ দিয়ে পুনরায় অ্যাপ চালু করুন।
            </p>
            <button
              onClick={this.handleReload}
              style={{
                width: '100%',
                padding: '12px 20px',
                borderRadius: '16px',
                backgroundColor: '#0E6B6B',
                color: '#ffffff',
                fontWeight: '800',
                fontSize: '14px',
                border: 'none',
                cursor: 'pointer',
                marginBottom: '10px'
              }}
            >
              🔄 পুনরায় অ্যাপ চালু করুন
            </button>
            <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '12px' }}>
              ত্রুটির বিবরণ: {this.state.errorMessage}
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootEl = document.getElementById('root');
if (rootEl) {
  try {
    const root = createRoot(rootEl);
    root.render(
      <RootErrorBoundary>
        <App />
      </RootErrorBoundary>
    );
  } catch (err) {
    console.error('Fatal mount error:', err);
    if (rootEl) {
      rootEl.innerHTML = `
        <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;font-family:sans-serif;text-align:center;background:#f8fafc;">
          <div style="max-width:380px;background:#fff;border-radius:20px;padding:24px;border:1px solid #e2e8f0;box-shadow:0 4px 12px rgba(0,0,0,0.06);">
            <h3 style="color:#0E6B6B;margin-bottom:8px;">সহজ দোকান</h3>
            <p style="color:#64748b;font-size:13px;margin-bottom:16px;">অ্যাপটি চালু করতে নিচের বাটনে চাপ দিন।</p>
            <button onclick="window.location.reload()" style="padding:10px 20px;background:#0E6B6B;color:#fff;border:none;border-radius:12px;font-weight:bold;cursor:pointer;">রিলোড করুন</button>
          </div>
        </div>
      `;
    }
  }
}
