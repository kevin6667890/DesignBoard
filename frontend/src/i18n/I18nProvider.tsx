import { createContext, useMemo, useState, type ReactNode } from 'react';
import { translations, type Language, type TranslationKey } from './translations';

const UI_KEY = 'designboard_ui_language';
const INTERVIEW_KEY = 'designboard_interview_language';

interface I18nContextValue {
  uiLanguage: Language;
  interviewLanguage: Language;
  setUiLanguage: (language: Language) => void;
  setInterviewLanguage: (language: Language) => void;
  t: (key: TranslationKey) => string;
}

export const I18nContext = createContext<I18nContextValue | null>(null);

function readLanguage(key: string): Language {
  const value = localStorage.getItem(key);
  return value === 'zh' ? 'zh' : 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [uiLanguage, setUiLanguageState] = useState<Language>(() => readLanguage(UI_KEY));
  const [interviewLanguage, setInterviewLanguageState] = useState<Language>(() => readLanguage(INTERVIEW_KEY));

  const setUiLanguage = (language: Language) => {
    localStorage.setItem(UI_KEY, language);
    setUiLanguageState(language);
  };

  const setInterviewLanguage = (language: Language) => {
    localStorage.setItem(INTERVIEW_KEY, language);
    setInterviewLanguageState(language);
  };

  const value = useMemo<I18nContextValue>(() => ({
    uiLanguage,
    interviewLanguage,
    setUiLanguage,
    setInterviewLanguage,
    t: (key) => translations[uiLanguage][key] ?? translations.en[key],
  }), [interviewLanguage, uiLanguage]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
