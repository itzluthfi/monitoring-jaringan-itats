/**
 * i18n Configuration - Nexus Network Monitor
 * Supports English (en) and Bahasa Indonesia (id)
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translations
import en from './locales/en.json';
import id from './locales/id.json';

export const resources = {
  en: { translation: en },
  id: { translation: id },
} as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: ['en', 'id'],
    debug: false,

    interpolation: {
      escapeValue: false, // React already escapes
    },

    detection: {
      // Language will be loaded from API, but support browser detection as fallback
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'app_language',
    },
  });

export default i18n;

// Supported languages
export const supportedLanguages = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'id', name: 'Bahasa Indonesia', nativeName: 'Bahasa Indonesia' },
] as const;

export type LanguageCode = typeof supportedLanguages[number]['code'];