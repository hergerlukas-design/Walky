import { useEffect, useState, type FormEvent } from 'react'
import {
  MIN_CODE_LENGTH,
  channelPath,
  generateChannelCode,
  isValidChannelCode,
  normalizeChannelCode,
} from '../../shared/channelCode'
import { useI18n, useTranslations } from '../i18n'
import { randomCallsign, saveDisplayName } from '../lib/callsigns'
import { useInstallPrompt } from '../hooks/useInstallPrompt'
import { LanguageToggle } from './LanguageToggle'
import { WalkyLogo } from './Icons'

interface HomeScreenProps {
  displayName: string
  onNameChange(name: string): void
  onEnter(path: string): void
}

export function HomeScreen({ displayName, onNameChange, onEnter }: HomeScreenProps) {
  const { lang } = useI18n()
  const t = useTranslations()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    saveDisplayName(displayName)
  }, [displayName])

  // Über die Manifest-Verknüpfung ("Neuer Kanal") direkt einen Kanal öffnen.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('neu')) {
      onEnter(channelPath(generateChannelCode()))
    }
  }, [onEnter])

  const join = (event: FormEvent) => {
    event.preventDefault()
    const normalized = normalizeChannelCode(code)

    if (!isValidChannelCode(normalized)) {
      setError(t.home.codeTooShort(MIN_CODE_LENGTH))
      return
    }

    setError(null)
    onEnter(channelPath(normalized))
  }

  return (
    <main className="safe-top safe-bottom mx-auto flex min-h-dvh w-full max-w-md flex-col gap-8 px-5 py-8">
      <div className="flex justify-end">
        <LanguageToggle />
      </div>

      <header className="flex flex-col items-center gap-3 text-center">
        <span className="text-signal-400">
          <WalkyLogo className="h-14 w-14" />
        </span>
        <h1 className="font-display text-3xl tracking-[0.3em] text-shell-200 uppercase">Walky</h1>
        <p className="max-w-xs text-sm text-shell-400">{t.app.tagline}</p>
      </header>

      <div className="flex flex-col gap-3">
        <label
          htmlFor="name"
          className="px-1 font-display text-xs tracking-[0.2em] text-shell-400 uppercase"
        >
          {t.home.callsignLabel}
        </label>
        <div className="flex gap-2">
          <input
            id="name"
            value={displayName}
            maxLength={32}
            onChange={(event) => onNameChange(event.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-shell-700 bg-shell-800 px-4 py-3 text-shell-200 placeholder:text-shell-600"
            placeholder={t.home.callsignPlaceholder}
          />
          <button
            type="button"
            onClick={() => onNameChange(randomCallsign(lang))}
            className="shrink-0 rounded-xl border border-shell-700 px-4 text-sm text-shell-400 transition-colors hover:border-shell-400 hover:text-shell-200"
          >
            {t.home.reroll}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <button
          type="button"
          onClick={() => onEnter(channelPath(generateChannelCode()))}
          className="w-full rounded-2xl bg-signal-500 px-6 py-5 font-display text-lg tracking-[0.15em] text-shell-950 uppercase transition-colors hover:bg-signal-400"
        >
          {t.home.createChannel}
        </button>

        <div className="flex items-center gap-3 text-xs text-shell-600">
          <span className="h-px flex-1 bg-shell-700" />
          {t.home.orJoin}
          <span className="h-px flex-1 bg-shell-700" />
        </div>

        <form onSubmit={join} className="flex flex-col gap-3">
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(event) => {
                setCode(event.target.value)
                setError(null)
              }}
              inputMode="text"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              aria-label={t.home.codeLabel}
              placeholder={t.home.codePlaceholder}
              className="min-w-0 flex-1 rounded-xl border border-shell-700 bg-shell-800 px-4 py-3 font-display tracking-[0.2em] text-shell-200 uppercase placeholder:normal-case placeholder:tracking-normal placeholder:text-shell-600"
            />
            <button
              type="submit"
              className="shrink-0 rounded-xl border border-shell-600 px-5 text-sm tracking-wide text-shell-200 uppercase transition-colors hover:border-signal-400 hover:text-signal-400"
            >
              {t.home.join}
            </button>
          </div>
          {error && <p className="px-1 text-sm text-alert-400">{error}</p>}
        </form>
      </div>

      <InstallHint />

      <footer className="mt-auto pt-6 text-center text-xs leading-relaxed text-shell-600">
        {t.app.privacyNote}
      </footer>
    </main>
  )
}

function InstallHint() {
  const t = useTranslations()
  const { canInstall, isIos, isStandalone, install } = useInstallPrompt()

  if (isStandalone) return null

  if (canInstall) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className="w-full rounded-xl border border-dashed border-shell-600 px-4 py-3 text-sm text-shell-400 transition-colors hover:border-signal-400 hover:text-signal-400"
      >
        {t.install.prompt}
      </button>
    )
  }

  if (isIos) {
    return (
      <p className="rounded-xl border border-dashed border-shell-700 px-4 py-3 text-center text-xs leading-relaxed text-shell-400">
        {t.install.iosHintBefore}
        <span className="text-shell-200">{t.install.iosHintAction}</span>
        {t.install.iosHintAfter}
      </p>
    )
  }

  return null
}
