import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Google Maps Platform quota & auth failure detectors
(window as any).gm_authFailure = () => {
  window.dispatchEvent(new CustomEvent('gmp-sdk-fallback'));
};

const origConsoleError = console.error;
console.error = (...args: unknown[]) => {
  const msg = args.map((a) => String(a)).join(' ');
  if (msg.includes('OverQuotaMapError') || msg.includes('QuotaExceededError')) {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
    window.dispatchEvent(new CustomEvent('gmp-sdk-fallback'));
  } else if (
    msg.includes('RefererNotAllowedMapError') ||
    msg.includes('ApiNotActivatedMapError') ||
    msg.includes('InvalidKeyMapError') ||
    msg.includes('ApiProjectMapError') ||
    msg.includes('MissingKeyMapError')
  ) {
    window.dispatchEvent(new CustomEvent('gmp-sdk-fallback'));
  }
  origConsoleError.apply(console, args);
};

createRoot(document.getElementById('root')!).render(<App />);
