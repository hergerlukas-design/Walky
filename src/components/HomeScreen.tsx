import { useEffect, useState, type FormEvent } from 'react'
import {
  MIN_CODE_LENGTH,
  channelPath,
  generateChannelCode,
  isValidChannelCode,
  normalizeChannelCode,
} from '../../shared/channelCode'
import { loadDisplayName, randomCallsign, saveDisplayName } from '../lib/callsigns'
import { useInstallPrompt } from '../hooks/useInstallPrompt'
import { WalkyLogo } from './Icons'

interface HomeScreenProps {
  onEnter(path: string): void
}

export function HomeScreen({ onEnter }: HomeScreenProps) {
  const [name, setName] = useState(loadDisplayName)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    saveDisplayName(name)
  }, [name])

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
      setError(`Bitte einen Code mit mindestens ${MIN_CODE_LENGTH} Zeichen eingeben.`)
      return
    }

    setError(null)
    onEnter(channelPath(normalized))
  }

  return (
    <main className="safe-top safe-bottom mx-auto flex min-h-dvh w-full max-w-md flex-col gap-8 px-5 py-8">
      <header className="flex flex-col items-center gap-3 pt-6 text-center">
        <span className="text-signal-400">
          <WalkyLogo className="h-14 w-14" />
        </span>
        <h1 className="font-display text-3xl tracking-[0.3em] text-shell-200 uppercase">
          Walky
        </h1>
        <p className="max-w-xs text-sm text-shell-400">
          Kanal aufmachen, Link teilen, Knopf drücken. Kein Anruf, kein
          Klingeln, keine Installation nötig.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        <label htmlFor="name" className="px-1 font-display text-xs tracking-[0.2em] text-shell-400 uppercase">
          Dein Rufzeichen
        </label>
        <div className="flex gap-2">
          <input
            id="name"
            value={name}
            maxLength={32}
            onChange={(event) => setName(event.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-shell-700 bg-shell-800 px-4 py-3 text-shell-200 placeholder:text-shell-600"
            placeholder="z. B. Blauer Falke"
          />
          <button
            type="button"
            onClick={() => setName(randomCallsign())}
            className="shrink-0 rounded-xl border border-shell-700 px-4 text-sm text-shell-400 transition-colors hover:border-shell-400 hover:text-shell-200"
          >
            Würfeln
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <button
          type="button"
          onClick={() => onEnter(channelPath(generateChannelCode()))}
          className="w-full rounded-2xl bg-signal-500 px-6 py-5 font-display text-lg tracking-[0.15em] text-shell-950 uppercase transition-colors hover:bg-signal-400"
        >
          Kanal eröffnen
        </button>

        <div className="flex items-center gap-3 text-xs text-shell-600">
          <span className="h-px flex-1 bg-shell-700" />
          oder beitreten
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
              aria-label="Kanal-Code oder Link"
              placeholder="Code oder Link einfügen"
              className="min-w-0 flex-1 rounded-xl border border-shell-700 bg-shell-800 px-4 py-3 font-display tracking-[0.2em] text-shell-200 uppercase placeholder:normal-case placeholder:tracking-normal placeholder:text-shell-600"
            />
            <button
              type="submit"
              className="shrink-0 rounded-xl border border-shell-600 px-5 text-sm tracking-wide text-shell-200 uppercase transition-colors hover:border-signal-400 hover:text-signal-400"
            >
              Los
            </button>
          </div>
          {error && <p className="px-1 text-sm text-alert-400">{error}</p>}
        </form>
      </div>

      <InstallHint />

      <footer className="mt-auto pt-6 text-center text-xs leading-relaxed text-shell-600">
        Sprache läuft direkt zwischen den Geräten (WebRTC). Der Server vermittelt
        nur den Verbindungsaufbau und hört nichts mit.
      </footer>
    </main>
  )
}

function InstallHint() {
  const { canInstall, isIos, isStandalone, install } = useInstallPrompt()

  if (isStandalone) return null

  if (canInstall) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className="w-full rounded-xl border border-dashed border-shell-600 px-4 py-3 text-sm text-shell-400 transition-colors hover:border-signal-400 hover:text-signal-400"
      >
        Als App installieren — startet dann ohne Browserleiste
      </button>
    )
  }

  if (isIos) {
    return (
      <p className="rounded-xl border border-dashed border-shell-700 px-4 py-3 text-center text-xs leading-relaxed text-shell-400">
        Auf dem iPhone: Teilen-Symbol antippen und{' '}
        <span className="text-shell-200">„Zum Home-Bildschirm"</span> wählen. Als
        installierte App fragt Walky eigenständig nach dem Mikrofon.
      </p>
    )
  }

  return null
}
