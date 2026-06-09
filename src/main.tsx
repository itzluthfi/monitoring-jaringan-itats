import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { SplashScreen } from '@capacitor/splash-screen';
import Router from './Router';
import './index.css';
import './i18n'; // Initialize i18n
import { LanguageProvider } from './i18n/LanguageContext';

// Sembunyikan native splash screen
SplashScreen.hide();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <Router />
    </LanguageProvider>
  </StrictMode>,
);
