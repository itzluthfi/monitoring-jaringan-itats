import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { SplashScreen } from '@capacitor/splash-screen';
import Router from './Router';
import './index.css';

// 1. Langsung sembunyikan native splash agar animasi HTML di index.html muncul instan
SplashScreen.hide();

// 2. Kontrol penghapusan overlay HTML setelah 3.5 detik
const hideBootscreen = () => {
  const overlay = document.getElementById('bootscreen-overlay');
  if (overlay) {
    overlay.style.opacity = '0';
    setTimeout(() => {
      overlay.remove();
    }, 800); // Tunggu transisi opacity selesai
  }
};

// Start the countdown
setTimeout(hideBootscreen, 3500);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router />
  </StrictMode>,
);
