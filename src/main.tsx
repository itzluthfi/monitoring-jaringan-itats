import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { SplashScreen } from '@capacitor/splash-screen';
import Router from './Router';
import './index.css';
import './i18n'; // Initialize i18n
import { LanguageProvider } from './i18n/LanguageContext';

// 1. Langsung sembunyikan native splash agar animasi HTML di index.html muncul instan
SplashScreen.hide();

// 2. Kontrol penghapusan overlay HTML
const hideBootscreen = () => {
  const overlay = document.getElementById('bootscreen-overlay');
  if (overlay) {
    overlay.style.opacity = '0';
    setTimeout(() => {
      overlay.remove();
    }, 400); // Tunggu transisi opacity selesai (lebih cepat: 400ms)
  }
};

// Expose to window so React Router / Components can trigger it dynamically when ready
(window as any).hideBootscreen = hideBootscreen;

// Fallback countdown in case React crashes or takes too long to load
setTimeout(hideBootscreen, 3000);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <Router />
    </LanguageProvider>
  </StrictMode>,
);
