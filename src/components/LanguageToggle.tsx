import { useI18n } from '../i18n'

interface LanguageToggleProps {
  className?: string
}

/**
 * Zwei Sprachen brauchen kein Auswahlmenü — ein Knopf, der umschaltet und
 * dabei anzeigt, wohin er führt.
 */
export function LanguageToggle({ className = '' }: LanguageToggleProps) {
  const { lang, t, setLang } = useI18n()
  const next = lang === 'de' ? 'en' : 'de'

  return (
    <button
      type="button"
      onClick={() => setLang(next)}
      lang={next}
      aria-label={t.language.switchTo}
      title={t.language.switchTo}
      className={`rounded-lg border border-shell-700 px-3 py-2 font-display text-xs tracking-widest text-shell-400 uppercase transition-colors hover:border-shell-400 hover:text-shell-200 ${className}`}
    >
      {next}
    </button>
  )
}
