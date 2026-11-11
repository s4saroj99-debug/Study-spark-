import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Automatically register and update the PWA service worker
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(<App />);

