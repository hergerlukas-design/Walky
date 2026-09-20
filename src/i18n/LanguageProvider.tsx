import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { readStored, writeStored } from '../lib/storage'
import { LANGUAGES, translations, type Language, type Translations } from './translations'

const LANGUAGE_KEY = 'walky:lang'

interface LanguageContextValue {
  lang: Language
  t: Translations
  setLang(lang: Language): void
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

function isLanguage(value: string | null): value is Language {
  return value !== null && (LANGUAGES as readonly string[]).includes(value)
}

/**
 * Einmal gewählt, bleibt die Sprache gespeichert. Ohne Auswahl entscheidet
 * die Browsersprache — Deutsch nur bei ausdrücklich deutscher Einstellung,
 * sonst Englisch als die breitere Vorgabe.
 */
export function detectLanguage(
  stored: string | null,
  preferred: readonly string[],
): Language {
  if (isLanguage(stored)) return stored
  return preferred.some((tag) => tag.toLowerCase().startsWith('de')) ? 'de' : 'en'
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() =>
    detectLanguage(readStored(LANGUAGE_KEY), navigator.languages ?? [navigator.language]),
  )

  // Screenreader und die Silbentrennung des Browsers richten sich danach.
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const setLang = useCallback((next: Language) => {
    writeStored(LANGUAGE_KEY, next)
    setLangState(next)
  }, [])

  const value = useMemo<LanguageContextValue>(
    () => ({ lang, t: translations[lang], setLang }),
    [lang, setLang],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useI18n(): LanguageContextValue {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useI18n benötigt einen LanguageProvider')
  return context
}

/** Kurzform für Komponenten, die nur Texte brauchen. */
export function useTranslations(): Translations {
  return useI18n().t
}
