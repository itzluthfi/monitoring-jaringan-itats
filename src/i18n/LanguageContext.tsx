/**
 * Language Context - Manages app language state and persistence
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { authFetch } from '../lib/authFetch';

interface LanguageContextType {
  language: string;
  changeLanguage: (lang: string) => Promise<void>;
  isLoading: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const { i18n } = useTranslation();
  const [language, setLanguage] = useState<string>('id'); // Default to Indonesian
  const [isLoading, setIsLoading] = useState(true);

  // Load language from server on mount
  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const response = await authFetch('/api/settings/app_language');
        const data = await response.json();

        if (data.value && ['en', 'id'].includes(data.value)) {
          setLanguage(data.value);
          await i18n.changeLanguage(data.value);
          localStorage.setItem('app_language', data.value);
        }
      } catch (error) {
        console.warn('[i18n] Failed to load language from server, using default');
        // Fallback to localStorage or default
        const stored = localStorage.getItem('app_language');
        if (stored && ['en', 'id'].includes(stored)) {
          setLanguage(stored);
          await i18n.changeLanguage(stored);
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadLanguage();
  }, [i18n]);

  const changeLanguage = useCallback(async (lang: string) => {
    if (!['en', 'id'].includes(lang)) {
      console.error('[i18n] Invalid language code:', lang);
      return;
    }

    try {
      // Update i18n immediately for instant feedback
      await i18n.changeLanguage(lang);
      setLanguage(lang);
      localStorage.setItem('app_language', lang);

      // Persist to server
      await authFetch('/api/settings/app_language', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: lang }),
      });

      console.log(`[i18n] Language changed to: ${lang}`);
    } catch (error) {
      console.error('[i18n] Failed to save language to server:', error);
    }
  }, [i18n]);

  return (
    <LanguageContext.Provider value={{ language, changeLanguage, isLoading }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export default LanguageContext;